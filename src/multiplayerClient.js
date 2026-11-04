/**
 * Poker Chess 3D - Realtime Multiplayer Client Controller
 * Manages WebSocket connection, Matchmaking, Custom 1v1 Rooms & Lockstep Move Sync
 */

class MultiplayerClient {
  constructor() {
    this.ws = null;
    this.playerId = null;
    this.isConnected = false;
    this.isQueued = false;
    this.currentMatch = null;
    this.serverStats = { onlinePlayers: 0, activeMatches: 0, queuedPlayers: 0 };
    this.listeners = new Map();
    this.reconnectTimer = null;
    this.serverUrl = null;
    this.cachedProfile = null;
  }

  getDefaultServerUrl() {
    if (typeof window === 'undefined') return 'ws://localhost:3001';
    
    // Check custom override in localStorage
    const customWs = localStorage.getItem('poker_chess_ws_url');
    if (customWs) return customWs;

    const hostname = window.location.hostname;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'ws://localhost:3001';
    }

    // In production, connect to current host or configured backend
    return `${protocol}//${window.location.host}`;
  }

  connect(profile = {}, serverUrl = null) {
    this.serverUrl = serverUrl || this.getDefaultServerUrl();
    this.cachedProfile = profile;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.emit('connected', { serverUrl: this.serverUrl });

        // Synchronize player commercial profile (Name, Elo, Skin)
        this.updateProfile(this.cachedProfile);
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
        this.isConnected = false;
        this.isQueued = false;
        this.emit('disconnected');

        // Attempt silent reconnection after 4s
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (!this.isConnected) {
              this.connect(this.cachedProfile, this.serverUrl);
            }
          }, 4000);
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
      name: profile.name || profile.displayName,
      elo: profile.elo || 1050,
      rankName: profile.rankName,
      skinId: profile.equippedSkinId,
      avatar: profile.avatar
    });
  }

  joinMatchmaking() {
    this.isQueued = true;
    this.send('JOIN_QUEUE');
    this.emit('queue_status', { isQueued: true });
  }

  leaveMatchmaking() {
    this.isQueued = false;
    this.send('LEAVE_QUEUE');
    this.emit('queue_status', { isQueued: false });
  }

  createCustomRoom(roomCode = null) {
    this.send('CREATE_CUSTOM_ROOM', { roomCode });
  }

  joinCustomRoom(roomCode) {
    this.send('JOIN_CUSTOM_ROOM', { roomCode });
  }

  sendChessMove(moveData) {
    // moveData: { from: {r, c}, to: {r, c}, pieceType, targetPiece, combatData }
    return this.send('CHESS_MOVE', moveData);
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
        this.serverStats.onlinePlayers = msg.onlinePlayers || 1;
        this.emit('stats', this.serverStats);
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
        this.currentMatch = {
          matchId: msg.matchId,
          matchType: msg.matchType,
          myColor: msg.yourColor,
          myRole: msg.yourRole,
          opponent: msg.opponent,
          initialTimeMs: msg.initialTimeMs
        };
        this.emit('match_found', this.currentMatch);
        break;

      case 'OPPONENT_MOVED':
        this.emit('opponent_move', msg);
        break;

      case 'OPPONENT_BUFF_APPLIED':
        this.emit('opponent_buff', msg);
        break;

      case 'OPPONENT_EMOTE':
        this.emit('opponent_emote', msg);
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
