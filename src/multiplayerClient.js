/**
 * Poker Chess 3D - Realtime Multiplayer Client Controller
 * Manages WebSocket connection, Matchmaking, Custom 1v1 Rooms & Lockstep Move Sync
 */

class MultiplayerClient {
  constructor() {
    this.ws = null;
    this.playerId = null;
    this.mySide = null;
    this.isConnected = false;
    this.isQueued = false;
    this.currentMatch = null;
    this.serverStats = { onlinePlayers: 12, activeMatches: 0, queuedPlayers: 0 };
    this.listeners = new Map();
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.triedFallbackPort = false;
    this.serverUrl = null;
    this.cachedProfile = null;
  }

  getDefaultServerUrl() {
    if (typeof window === 'undefined') return 'ws://localhost:3000';

    // Check custom override in localStorage
    try {
      const customWs = localStorage.getItem('poker_chess_ws_url');
      if (customWs) return customWs;
    } catch (e) {}

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Connect to current host first (works on localhost:3000 via Vite plugin AND in production on Railway/Render/Docker)
    return `${protocol}//${window.location.host}`;
  }

  connect(profile = {}, serverUrl = null) {
    this.serverUrl = serverUrl || this.getDefaultServerUrl();
    this.cachedProfile = { ...this.cachedProfile, ...profile };

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected', { serverUrl: this.serverUrl });

        // Synchronize player commercial profile (Name, Elo, Skin)
        this.updateProfile(this.cachedProfile);

        // If player was in an active match before a brief disconnect, auto-reconnect
        if (this.currentMatch?.matchId && this.playerId) {
          this.send('RECONNECT_MATCH', {
            matchId: this.currentMatch.matchId,
            playerId: this.playerId
          });
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch (err) {
          console.error('[MultiplayerClient] Parse error:', err);
        }
      };

      this.ws.onclose = () => {
        const wasConnected = this.isConnected;
        this.isConnected = false;
        this.isQueued = false;
        this.emit('disconnected');

        // On localhost, if port 3000 didn't have WS attached, try standalone port 3001 once
        const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
        if (
          !wasConnected &&
          !this.triedFallbackPort &&
          (hostname === 'localhost' || hostname === '127.0.0.1') &&
          this.serverUrl &&
          !this.serverUrl.includes(':3001')
        ) {
          this.triedFallbackPort = true;
          this.connect(this.cachedProfile, 'ws://localhost:3001');
          return;
        }

        // Exponential backoff reconnection (caps retries on static hosts to prevent console spam)
        this.reconnectAttempts += 1;
        if (!wasConnected && this.reconnectAttempts > 4) {
          return;
        }
        const delayMs = Math.min(30000, 4000 * Math.pow(1.8, Math.max(0, this.reconnectAttempts - 1)));
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (!this.isConnected) {
              this.connect(this.cachedProfile, this.serverUrl);
            }
          }, delayMs);
        }
      };

      this.ws.onerror = (err) => {
        this.emit('error', err);
      };
    } catch (err) {
      console.warn('[MultiplayerClient] Failed to establish WS:', err);
    }
  }

  send(type, payload = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...payload }));
      return true;
    }
    return false;
  }

  updateProfile(profile = {}) {
    this.cachedProfile = { ...this.cachedProfile, ...profile };
    this.send('UPDATE_PROFILE', {
      name: this.cachedProfile.name || this.cachedProfile.displayName,
      elo: this.cachedProfile.elo || 1050,
      rankName: this.cachedProfile.rankName,
      skinId: this.cachedProfile.equippedSkinId || this.cachedProfile.skinId,
      avatar: this.cachedProfile.avatar
    });
  }

  joinMatchmaking() {
    this.isQueued = true;
    if (!this.isConnected) {
      this.reconnectAttempts = 0;
      this.connect(this.cachedProfile);
    }
    this.send('JOIN_QUEUE');
    this.emit('queue_status', { isQueued: true });
  }

  leaveMatchmaking() {
    this.isQueued = false;
    this.send('LEAVE_QUEUE');
    this.emit('queue_status', { isQueued: false });
  }

  createCustomRoom(roomCode = null) {
    if (!this.isConnected) {
      this.reconnectAttempts = 0;
      this.connect(this.cachedProfile);
    }
    this.send('CREATE_CUSTOM_ROOM', { roomCode });
  }

  joinCustomRoom(roomCode) {
    if (!this.isConnected) {
      this.reconnectAttempts = 0;
      this.connect(this.cachedProfile);
    }
    this.send('JOIN_CUSTOM_ROOM', { roomCode });
  }

  sendChessMove(moveData) {
    // moveData: { from: {r, c}, to: {r, c}, pieceType, targetPiece, combatData, boardSnapshot }
    return this.send('CHESS_MOVE', moveData);
  }

  syncBoardState(boardSnapshot, currentTurn, gameOver = false, winnerColor = null, reason = null) {
    return this.send('SYNC_BOARD', {
      boardSnapshot,
      currentTurn,
      gameOver,
      winnerColor,
      reason
    });
  }

  sendTurnTimeout(expiredSide, nextSide) {
    return this.send('TURN_TIMEOUT', { expiredSide, nextSide });
  }

  sendPokerBuff(buffData) {
    // buffData: { comboId, comboName, targetRow, targetCol, targetPieceType, atkBonus, armorBonus, healInstant, colorHex }
    return this.send('APPLY_POKER_BUFF', buffData);
  }

  sendEmote(emoteId, emoteText) {
    return this.send('SEND_EMOTE', { emoteId, emoteText });
  }

  surrender() {
    return this.send('SURRENDER');
  }

  checkVictory(winnerColor, reason, message) {
    return this.send('MATCH_VICTORY_CHECK', { winnerColor, reason, message });
  }

  handleServerMessage(msg) {
    switch (msg.type) {
      case 'CONNECTED':
        this.playerId = msg.playerId;
        this.serverStats.onlinePlayers = msg.onlinePlayers || 12;
        this.emit('stats', this.serverStats);
        if (this.isQueued) {
          this.send('JOIN_QUEUE');
        }
        break;

      case 'SERVER_STATS':
        this.serverStats = {
          onlinePlayers: msg.onlinePlayers,
          activeMatches: msg.activeMatches,
          queuedPlayers: msg.queuedPlayers
        };
        this.emit('stats', this.serverStats);
        break;

      case 'QUEUE_JOINED':
        this.isQueued = true;
        this.emit('queue_joined', msg);
        break;

      case 'QUEUE_LEFT':
        this.isQueued = false;
        this.emit('queue_left', msg);
        break;

      case 'ROOM_CREATED':
        this.emit('room_created', msg);
        break;

      case 'MATCH_FOUND':
        this.isQueued = false;
        this.mySide = msg.yourColor === 'b' ? 'b' : 'w';
        this.currentMatch = {
          matchId: msg.matchId,
          matchType: msg.matchType,
          myColor: this.mySide,
          myRole: msg.yourRole,
          opponent: msg.opponent,
          initialTimeMs: msg.initialTimeMs
        };
        this.emit('match_found', this.currentMatch);
        break;

      case 'RECONNECT_SUCCESS':
        this.mySide = msg.color === 'b' ? 'b' : 'w';
        this.currentMatch = {
          matchId: msg.matchId,
          matchType: 'ranked_match',
          myColor: this.mySide,
          opponent: msg.opponent
        };
        this.emit('reconnect_success', msg);
        break;

      case 'OPPONENT_MOVED':
        this.emit('opponent_move', msg);
        break;

      case 'OPPONENT_TURN_TIMEOUT':
        this.emit('opponent_turn_timeout', msg);
        break;

      case 'OPPONENT_BUFF_APPLIED':
        this.emit('opponent_buff', msg);
        break;

      case 'OPPONENT_EMOTE':
        this.emit('opponent_emote', msg);
        break;

      case 'OPPONENT_DISCONNECTED':
        this.emit('opponent_disconnected', msg);
        break;

      case 'OPPONENT_RECONNECTED':
        this.emit('opponent_reconnected', msg);
        break;

      case 'MOVE_CONFIRMED':
        this.emit('move_confirmed', msg);
        break;

      case 'MATCH_ENDED':
        this.currentMatch = null;
        this.emit('match_ended', msg);
        break;

      case 'ERROR':
        this.emit('server_error', msg);
        break;
    }
  }

  // Simple Pub/Sub event listeners
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const arr = this.listeners.get(event).filter((cb) => cb !== callback);
    this.listeners.set(event, arr);
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    for (const cb of this.listeners.get(event)) {
      try {
        cb(data);
      } catch (e) {
        console.error(`[MultiplayerClient] Error in listener for "${event}":`, e);
      }
    }
  }
}

export const multiplayerClient = new MultiplayerClient();

