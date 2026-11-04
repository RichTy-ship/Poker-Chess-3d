import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const PORT = process.env.PORT || 3001;
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const distDir = join(__dirname, '../dist');

// MIME types for static asset serving in production
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2'
};

// HTTP Server: Serves API healthcheck and production static build files
const server = createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlPath = req.url.split('?')[0];

  // Health check endpoint
  if (urlPath === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      onlinePlayers: clients.size,
      activeMatches: matches.size,
      queuedPlayers: matchmakingQueue.length,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: Date.now()
    }));
    return;
  }

  // Static files serving if dist/ exists
  if (existsSync(distDir)) {
    let filePath = join(distDir, urlPath === '/' ? 'index.html' : urlPath);
    if (!existsSync(filePath)) {
      // SPA Fallback to index.html
      filePath = join(distDir, 'index.html');
    }

    try {
      const ext = extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const fileData = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(fileData);
      return;
    } catch {
      res.writeHead(500);
      res.end('Internal Server Error');
      return;
    }
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    service: 'Poker Chess 3D Realtime Multiplayer Server (100 CCU Engine)',
    status: 'running',
    onlinePlayers: clients.size,
    activeMatches: matches.size,
    queuedPlayers: matchmakingQueue.length
  }));
});

// WebSocket Server attached to HTTP server
const wss = new WebSocketServer({ server });

/**
 * Client Store & Matchmaking State
 */
const clients = new Map(); // ws -> playerState
const matchmakingQueue = []; // array of playerState
const matches = new Map(); // matchId -> matchState
const customRooms = new Map(); // roomCode -> roomState

function generateId(prefix = 'p') {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

function sendMsg(ws, type, data = {}) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, ...data }));
  }
}

function broadcastServerStats() {
  const statsPayload = {
    type: 'SERVER_STATS',
    onlinePlayers: clients.size,
    activeMatches: matches.size,
    queuedPlayers: matchmakingQueue.length
  };
  const jsonStr = JSON.stringify(statsPayload);
  for (const [ws] of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(jsonStr);
    }
  }
}

/**
 * Matchmaking & Pair Allocation Logic
 */
function attemptMatchmaking() {
  if (matchmakingQueue.length < 2) return;

  // Sort queue by Elo for balanced fair-play matchmaking
  matchmakingQueue.sort((a, b) => a.elo - b.elo);

  let i = 0;
  while (i < matchmakingQueue.length - 1) {
    const p1 = matchmakingQueue[i];
    const p2 = matchmakingQueue[i + 1];

    const eloDiff = Math.abs(p1.elo - p2.elo);
    const waitTime = Math.max(Date.now() - p1.queueTime, Date.now() - p2.queueTime);

    // Dynamic Elo range expansion: Expands by 50 Elo for every 4 seconds waited
    const maxEloDiffAllowed = 120 + Math.floor(waitTime / 4000) * 80;

    if (eloDiff <= maxEloDiffAllowed || waitTime > 15000) {
      // Remove pair from queue
      matchmakingQueue.splice(i, 2);
      createMatchSession(p1, p2, 'ranked_match');
    } else {
      i++;
    }
  }
}

/**
 * Creates a synchronized 1v1 match between two players
 */
function createMatchSession(playerA, playerB, matchType = 'ranked_match', roomCode = null) {
  const matchId = generateId('m');

  // Randomize who plays White (w) and who plays Black (b)
  const isAWhite = Math.random() < 0.5;
  const whitePlayer = isAWhite ? playerA : playerB;
  const blackPlayer = isAWhite ? playerB : playerA;

  whitePlayer.color = 'w';
  blackPlayer.color = 'b';
  whitePlayer.matchId = matchId;
  blackPlayer.matchId = matchId;

  // Turn time bank: 90s initial per player, +5s increment per move
  const matchState = {
    matchId,
    matchType,
    roomCode,
    createdAt: Date.now(),
    whitePlayer,
    blackPlayer,
    turn: 'w',
    turnStartTime: Date.now(),
    whiteTimeLeftMs: 120000, // 2 minutes
    blackTimeLeftMs: 120000,
    turnCount: 1,
    status: 'ACTIVE',
    movesHistory: []
  };

  matches.set(matchId, matchState);

  // Notify White player
  sendMsg(whitePlayer.ws, 'MATCH_FOUND', {
    matchId,
    matchType,
    yourColor: 'w',
    yourRole: 'TRẮNG (Đi trước)',
    opponent: {
      name: blackPlayer.name,
      elo: blackPlayer.elo,
      rankName: blackPlayer.rankName,
      skinId: blackPlayer.skinId,
      avatar: blackPlayer.avatar
    },
    initialTimeMs: 120000
  });

  // Notify Black player
  sendMsg(blackPlayer.ws, 'MATCH_FOUND', {
    matchId,
    matchType,
    yourColor: 'b',
    yourRole: 'ĐEN (Đi sau)',
    opponent: {
      name: whitePlayer.name,
      elo: whitePlayer.elo,
      rankName: whitePlayer.rankName,
      skinId: whitePlayer.skinId,
      avatar: whitePlayer.avatar
    },
    initialTimeMs: 120000
  });

  broadcastServerStats();
}

/**
 * WebSocket Connection Handler
 */
wss.on('connection', (ws, req) => {
  const playerId = generateId('usr');
  const player = {
    playerId,
    ws,
    name: `Kỳ Thủ #${Math.floor(1000 + Math.random() * 9000)}`,
    elo: 1050,
    peakElo: 1050,
    rankName: 'Tập Sự',
    skinId: 'classic_sanctum',
    avatar: '♟️',
    matchId: null,
    queueTime: 0,
    isAlive: true
  };

  clients.set(ws, player);

  // Initial welcome message
  sendMsg(ws, 'CONNECTED', {
    playerId,
    serverTime: Date.now(),
    onlinePlayers: clients.size,
    activeMatches: matches.size
  });

  broadcastServerStats();

  ws.on('pong', () => {
    player.isAlive = true;
  });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      handleClientMessage(ws, player, msg);
    } catch (err) {
      console.error('Malformed WS message:', err);
    }
  });

  ws.on('close', () => {
    handlePlayerDisconnect(player);
    clients.delete(ws);
    broadcastServerStats();
  });
});

/**
 * Client Message Router
 */
function handleClientMessage(ws, player, msg) {
  switch (msg.type) {
    case 'UPDATE_PROFILE': {
      if (msg.name) player.name = String(msg.name).slice(0, 30);
      if (typeof msg.elo === 'number') player.elo = Math.round(msg.elo);
      if (msg.rankName) player.rankName = String(msg.rankName);
      if (msg.skinId) player.skinId = String(msg.skinId);
      if (msg.avatar) player.avatar = String(msg.avatar);
      sendMsg(ws, 'PROFILE_UPDATED', { ok: true, player: { name: player.name, elo: player.elo, skinId: player.skinId } });
      break;
    }

    case 'JOIN_QUEUE': {
      if (player.matchId) {
        sendMsg(ws, 'ERROR', { message: 'Bạn đang trong trận đấu!' });
        return;
      }
      if (!matchmakingQueue.includes(player)) {
        player.queueTime = Date.now();
        matchmakingQueue.push(player);
        sendMsg(ws, 'QUEUE_JOINED', { queuePosition: matchmakingQueue.length, estimatedWaitSec: 4 });
        broadcastServerStats();
        attemptMatchmaking();
      }
      break;
    }

    case 'LEAVE_QUEUE': {
      const idx = matchmakingQueue.indexOf(player);
      if (idx !== -1) {
        matchmakingQueue.splice(idx, 1);
        sendMsg(ws, 'QUEUE_LEFT', { ok: true });
        broadcastServerStats();
      }
      break;
    }

    case 'CREATE_CUSTOM_ROOM': {
      const code = (msg.roomCode || generateId('R').slice(2, 8)).toUpperCase();
      if (customRooms.has(code)) {
        sendMsg(ws, 'ERROR', { message: 'Mã phòng đã tồn tại! Vui lòng chọn mã khác.' });
        return;
      }
      const room = {
        code,
        host: player,
        guest: null,
        createdAt: Date.now()
      };
      customRooms.set(code, room);
      player.customRoomCode = code;
      sendMsg(ws, 'ROOM_CREATED', { roomCode: code, isHost: true });
      break;
    }

    case 'JOIN_CUSTOM_ROOM': {
      const code = String(msg.roomCode || '').trim().toUpperCase();
      const room = customRooms.get(code);
      if (!room) {
        sendMsg(ws, 'ERROR', { message: `Không tìm thấy phòng "${code}"!` });
        return;
      }
      if (room.guest) {
        sendMsg(ws, 'ERROR', { message: `Phòng "${code}" đã đầy (đủ 2 người)!` });
        return;
      }
      if (room.host === player) {
        sendMsg(ws, 'ERROR', { message: 'Bạn là chủ phòng này!' });
        return;
      }

      room.guest = player;
      customRooms.delete(code); // Room is now paired into match

      createMatchSession(room.host, room.guest, 'custom_room', code);
      break;
    }

    case 'CHESS_MOVE': {
      if (!player.matchId) return;
      const match = matches.get(player.matchId);
      if (!match || match.status !== 'ACTIVE') return;

      if (match.turn !== player.color) {
        sendMsg(ws, 'ERROR', { message: 'Chưa tới lượt đi của bạn!' });
        return;
      }

      // Record move
      match.movesHistory.push({
        playerColor: player.color,
        from: msg.from,
        to: msg.to,
        pieceType: msg.pieceType,
        targetPiece: msg.targetPiece,
        combatData: msg.combatData,
        timestamp: Date.now()
      });

      // Switch turn
      match.turn = match.turn === 'w' ? 'b' : 'w';
      match.turnCount++;

      const opponent = player.color === 'w' ? match.blackPlayer : match.whitePlayer;

      // Broadcast move to opponent
      sendMsg(opponent.ws, 'OPPONENT_MOVED', {
        from: msg.from,
        to: msg.to,
        pieceType: msg.pieceType,
        targetPiece: msg.targetPiece,
        combatData: msg.combatData,
        nextTurn: match.turn,
        turnCount: match.turnCount
      });

      // Acknowledge move to sender
      sendMsg(ws, 'MOVE_CONFIRMED', {
        nextTurn: match.turn,
        turnCount: match.turnCount
      });
      break;
    }

    case 'APPLY_POKER_BUFF': {
      if (!player.matchId) return;
      const match = matches.get(player.matchId);
      if (!match || match.status !== 'ACTIVE') return;

      const opponent = player.color === 'w' ? match.blackPlayer : match.whitePlayer;

      // Broadcast opponent's Poker Buff deployment in real-time
      sendMsg(opponent.ws, 'OPPONENT_BUFF_APPLIED', {
        comboId: msg.comboId,
        comboName: msg.comboName,
        targetRow: msg.targetRow,
        targetCol: msg.targetCol,
        targetPieceType: msg.targetPieceType,
        atkBonus: msg.atkBonus,
        armorBonus: msg.armorBonus,
        healInstant: msg.healInstant,
        colorHex: msg.colorHex
      });
      break;
    }

    case 'SEND_EMOTE': {
      if (!player.matchId) return;
      const match = matches.get(player.matchId);
      if (!match) return;
      const opponent = player.color === 'w' ? match.blackPlayer : match.whitePlayer;
      sendMsg(opponent.ws, 'OPPONENT_EMOTE', {
        emoteId: msg.emoteId,
        emoteText: msg.emoteText,
        senderName: player.name
      });
      break;
    }

    case 'SURRENDER': {
      if (!player.matchId) return;
      endMatch(player.matchId, player.color === 'w' ? 'b' : 'w', 'SURRENDER', `${player.name} đã đầu hàng.`);
      break;
    }

    case 'MATCH_VICTORY_CHECK': {
      if (!player.matchId) return;
      if (msg.winnerColor) {
        endMatch(player.matchId, msg.winnerColor, msg.reason || 'CHECKMATE', msg.message || 'Chiếu bí / Tiêu diệt Vua!');
      }
      break;
    }
  }
}

/**
 * Match Termination & Elo Update Handling
 */
function endMatch(matchId, winnerColor, reason, detailMessage) {
  const match = matches.get(matchId);
  if (!match || match.status === 'ENDED') return;

  match.status = 'ENDED';

  const isWhiteWinner = winnerColor === 'w';
  const winner = isWhiteWinner ? match.whitePlayer : match.blackPlayer;
  const loser = isWhiteWinner ? match.blackPlayer : match.whitePlayer;

  // Elo rating adjustment calculation (K=32)
  const expectedWinner = 1 / (1 + Math.pow(10, (loser.elo - winner.elo) / 400));
  const eloGain = Math.max(12, Math.min(45, Math.round(32 * (1 - expectedWinner))));
  const eloLoss = Math.round(eloGain * 0.75);

  winner.elo += eloGain;
  loser.elo = Math.max(100, loser.elo - eloLoss);

  // Notify winner
  sendMsg(winner.ws, 'MATCH_ENDED', {
    result: 'VICTORY',
    winnerColor,
    reason,
    detailMessage,
    eloChange: `+${eloGain}`,
    newElo: winner.elo,
    goldReward: 150
  });

  // Notify loser
  sendMsg(loser.ws, 'MATCH_ENDED', {
    result: 'DEFEAT',
    winnerColor,
    reason,
    detailMessage,
    eloChange: `-${eloLoss}`,
    newElo: loser.elo,
    goldReward: 50
  });

  winner.matchId = null;
  loser.matchId = null;
  matches.delete(matchId);
  broadcastServerStats();
}

function handlePlayerDisconnect(player) {
  // Remove from matchmaking queue if waiting
  const qIdx = matchmakingQueue.indexOf(player);
  if (qIdx !== -1) {
    matchmakingQueue.splice(qIdx, 1);
  }

  // Remove from custom rooms if hosting
  if (player.customRoomCode) {
    customRooms.delete(player.customRoomCode);
  }

  // Forfeit ongoing match on disconnection
  if (player.matchId) {
    const match = matches.get(player.matchId);
    if (match && match.status === 'ACTIVE') {
      const winnerColor = player.color === 'w' ? 'b' : 'w';
      endMatch(player.matchId, winnerColor, 'DISCONNECTED', `${player.name} đã ngắt kết nối.`);
    }
  }
}

// Heartbeat interval to prune stale connections (every 25 seconds)
setInterval(() => {
  for (const [ws, player] of clients) {
    if (!player.isAlive) {
      ws.terminate();
      continue;
    }
    player.isAlive = false;
    ws.ping();
  }
  // Periodically match queued players
  attemptMatchmaking();
}, 20000);

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`================================================================`);
  console.log(`🚀 Poker Chess 3D Realtime Multiplayer Engine Started!`);
  console.log(`🌐 Port: ${PORT} (Supports 100+ Concurrent 1v1 Matches)`);
  console.log(`⚡ WebSocket: ws://localhost:${PORT}`);
  console.log(`📡 Healthcheck API: http://localhost:${PORT}/api/health`);
  console.log(`================================================================`);
});
