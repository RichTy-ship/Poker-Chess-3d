import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { recordTrafficEvent, getTrafficSummary, renderTrafficDashboardHtml } from './traffic.js';
import { createInitialBoard, selectBestBotMove, selectBotBuffTarget } from './chessAi.js';

// Pool of 12 Realistic Online Matchmaking Bots with diverse Elo & Skins
const ONLINE_BOT_POOL = [
  { name: 'Thần Cờ Gia Định', elo: 1120, rankName: 'Hiệp Sĩ Bạc', skinId: 'emerald_emperor', avatar: '🧙' },
  { name: 'DragonSlayer_VN', elo: 1240, rankName: 'Chiến Tướng Vàng', skinId: 'molten_basalt', avatar: '🐉' },
  { name: 'Vua Phép Thuật', elo: 1080, rankName: 'Tân Binh Đồng', skinId: 'nebula_archmage', avatar: '⚡' },
  { name: 'Bạch Long Kiếm', elo: 1190, rankName: 'Hiệp Sĩ Bạc', skinId: 'glacial_quartz', avatar: '🗡️' },
  { name: 'Grandmaster_Bao', elo: 1320, rankName: 'Đại Kiện Tướng Bạch Kim', skinId: 'solar_champion', avatar: '👑' },
  { name: 'ShadowQueen_99', elo: 1150, rankName: 'Hiệp Sĩ Bạc', skinId: 'crypt_undead', avatar: '🧝‍♀️' },
  { name: 'Kỳ Vương Phố Cổ', elo: 1280, rankName: 'Chiến Tướng Vàng', skinId: 'damascus_judgment', avatar: '🏆' },
  { name: 'CyberKnight_Pro', elo: 1060, rankName: 'Tân Binh Đồng', skinId: 'classic_sanctum', avatar: '🤖' },
  { name: 'Thần Bài Poker VN', elo: 1220, rankName: 'Chiến Tướng Vàng', skinId: 'imperial_ivory', avatar: '🃏' },
  { name: 'DarkSanctum_Master', elo: 1170, rankName: 'Hiệp Sĩ Bạc', skinId: 'cosmic_midnight', avatar: '🌌' },
  { name: 'QueenGambit_HN', elo: 1260, rankName: 'Chiến Tướng Vàng', skinId: 'emerald_emperor', avatar: '👸' },
  { name: 'Phong Vân Vô Song', elo: 1350, rankName: 'Đại Kiện Tướng Bạch Kim', skinId: 'solar_champion', avatar: '⚔️' }
];

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

  // Interactive Realtime Traffic Dashboard
  if (urlPath === '/traffic' || urlPath === '/admin/traffic') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderTrafficDashboardHtml(clients.size, matches.size));
    return;
  }

  // Traffic Stats JSON API
  if (urlPath === '/api/traffic') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getTrafficSummary(clients.size, matches.size)));
    return;
  }

  // Telemetry event ingestion endpoint
  if (urlPath === '/api/track' && req.method === 'POST') {
    let bodyData = '';
    req.on('data', chunk => {
      bodyData += chunk;
      if (bodyData.length > 20000) req.destroy();
    });
    req.on('end', () => {
      try {
        const payload = bodyData ? JSON.parse(bodyData) : {};
        recordTrafficEvent(req, payload);
      } catch (e) {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    });
    return;
  }

  // Auto-record page view on root route
  if (urlPath === '/' || urlPath === '/index.html') {
    recordTrafficEvent(req, { event: 'PAGE_VIEW' });
  }

  // Static files serving if dist/ exists
  if (existsSync(distDir)) {
    let filePath = join(distDir, urlPath === '/' ? 'index.html' : urlPath);

    if (!existsSync(filePath)) {
      // If requesting a specific asset that doesn't exist, return 404 rather than HTML
      if (urlPath.startsWith('/assets/') || extname(urlPath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Asset Not Found');
        return;
      }
      // SPA Fallback to index.html for client-side routing
      filePath = join(distDir, 'index.html');
    }

    try {
      const ext = extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const fileData = readFileSync(filePath);

      // Cache policies: 1 year for Vite hashed assets, no-cache for index.html, sw.js and non-hashed dynamic assets
      const isSw = urlPath === '/sw.js';
      const isHashed = urlPath.includes('-') && (urlPath.endsWith('.js') || urlPath.endsWith('.css') || urlPath.endsWith('.png'));
      const cacheControl = (ext === '.html' || isSw)
        ? 'no-cache, no-store, must-revalidate'
        : (isHashed ? 'public, max-age=31536000, immutable' : 'no-cache, must-revalidate');

      const headers = {
        'Content-Type': contentType,
        'Cache-Control': cacheControl
      };
      if (isSw) {
        headers['Service-Worker-Allowed'] = '/';
      }

      res.writeHead(200, headers);
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
    onlinePlayers: clients.size + ONLINE_BOT_POOL.length,
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
 * Matchmaking & Pair Allocation Logic (Human vs Human priority, fallback to Online Bot)
 */
function attemptMatchmaking() {
  // 1. If 2 or more real human players are queued, match them together
  if (matchmakingQueue.length >= 2) {
    matchmakingQueue.sort((a, b) => a.elo - b.elo);

    let i = 0;
    while (i < matchmakingQueue.length - 1) {
      const p1 = matchmakingQueue[i];
      const p2 = matchmakingQueue[i + 1];

      const eloDiff = Math.abs(p1.elo - p2.elo);
      const waitTime = Math.max(Date.now() - p1.queueTime, Date.now() - p2.queueTime);
      const maxEloDiffAllowed = 120 + Math.floor(waitTime / 4000) * 80;

      if (eloDiff <= maxEloDiffAllowed || waitTime > 15000) {
        matchmakingQueue.splice(i, 2);
        createMatchSession(p1, p2, 'ranked_match');
      } else {
        i++;
      }
    }
  }

  // 2. If a human player has waited >= 3.5 seconds with no other human, match them with an Online Bot!
  const now = Date.now();
  for (let i = matchmakingQueue.length - 1; i >= 0; i--) {
    const player = matchmakingQueue[i];
    const waitTime = now - (player.queueTime || now);
    if (waitTime >= 3500) {
      matchmakingQueue.splice(i, 1);
      createBotMatchSession(player);
    }
  }
}

// Active queue polling watchdog every 1s so bots trigger reliably
setInterval(attemptMatchmaking, 1000);

/**
 * Creates an Online Match session against one of the ~10 Online Bots
 */
function createBotMatchSession(humanPlayer) {
  const matchId = generateId('m');

  // Select a bot closest to the human's current Elo
  const sortedBots = [...ONLINE_BOT_POOL].sort((a, b) => Math.abs(a.elo - humanPlayer.elo) - Math.abs(b.elo - humanPlayer.elo));
  const candidateBot = sortedBots[Math.floor(Math.random() * Math.min(3, sortedBots.length))];

  const botPlayer = {
    playerId: generateId('bot'),
    isBot: true,
    ws: null,
    name: candidateBot.name,
    elo: candidateBot.elo,
    rankName: candidateBot.rankName,
    skinId: candidateBot.skinId,
    avatar: candidateBot.avatar,
    matchId
  };

  const isHumanWhite = Math.random() < 0.5;
  const whitePlayer = isHumanWhite ? humanPlayer : botPlayer;
  const blackPlayer = isHumanWhite ? botPlayer : humanPlayer;

  whitePlayer.color = 'w';
  blackPlayer.color = 'b';
  humanPlayer.matchId = matchId;

  const matchState = {
    matchId,
    matchType: 'ranked_bot_match',
    isBotMatch: true,
    botPlayer,
    humanPlayer,
    virtualBoard: createInitialBoard(),
    createdAt: Date.now(),
    whitePlayer,
    blackPlayer,
    turn: 'w',
    turnStartTime: Date.now(),
    whiteTimeLeftMs: 120000,
    blackTimeLeftMs: 120000,
    turnCount: 1,
    status: 'ACTIVE',
    movesHistory: []
  };

  matches.set(matchId, matchState);

  // Notify human player with rich opponent profile
  sendMsg(humanPlayer.ws, 'MATCH_FOUND', {
    matchId,
    matchType: 'ranked_match',
    yourColor: humanPlayer.color,
    yourRole: humanPlayer.color === 'w' ? 'TRẮNG (Đi trước)' : 'ĐEN (Đi sau)',
    opponent: {
      name: botPlayer.name,
      elo: botPlayer.elo,
      rankName: botPlayer.rankName,
      skinId: botPlayer.skinId,
      avatar: botPlayer.avatar
    },
    initialTimeMs: 120000
  });

  broadcastServerStats();

  // If the bot plays White, schedule its opening move!
  if (botPlayer.color === 'w') {
    scheduleBotTurn(matchState);
  }
}

/**
 * Schedules and executes the Online Bot's turn with human-like deliberation
 */
function scheduleBotTurn(matchState) {
  if (!matchState || matchState.status !== 'ACTIVE') return;
  const bot = matchState.botPlayer;
  const human = matchState.humanPlayer;
  if (!bot || !human) return;

  // Human-like deliberation time: 1.4s - 2.8s
  const thinkDelay = 1400 + Math.random() * 1400;

  matchState.botTimer = setTimeout(() => {
    matchState.botTimer = null;
    if (matchState.status !== 'ACTIVE' || matchState.turn !== bot.color) return;

    // 1. Bot occasionally deploys a Poker Buff (every 2-3 turns)
    if (Math.random() < 0.45 || matchState.turnCount <= 2) {
      const buff = selectBotBuffTarget(matchState.virtualBoard, bot.color);
      if (buff) {
        sendMsg(human.ws, 'OPPONENT_BUFF_APPLIED', buff);
      }
    }

    // 2. Select optimal chess move
    const move = selectBestBotMove(matchState.virtualBoard, bot.color);
    if (!move) {
      // Checkmate or no moves
      endMatch(matchState.matchId, human.color, 'CHECKMATE', `${bot.name} bị chiếu bí!`);
      return;
    }

    // Update server virtual board
    const movingPiece = matchState.virtualBoard[move.from.r][move.from.c];
    matchState.virtualBoard[move.to.r][move.to.c] = movingPiece;
    matchState.virtualBoard[move.from.r][move.from.c] = null;

    // Switch turn
    matchState.turn = human.color;
    matchState.turnCount++;

    // Broadcast move to human player
    sendMsg(human.ws, 'OPPONENT_MOVED', {
      from: move.from,
      to: move.to,
      pieceType: move.pieceType,
      targetPiece: move.targetPiece,
      combatData: null,
      nextTurn: matchState.turn,
      turnCount: matchState.turnCount
    });
  }, thinkDelay);
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

      // If Bot match, update server's virtual board
      if (match.isBotMatch && match.virtualBoard && msg.from && msg.to) {
        const piece = match.virtualBoard[msg.from.r]?.[msg.from.c];
        if (piece) {
          match.virtualBoard[msg.to.r][msg.to.c] = piece;
          match.virtualBoard[msg.from.r][msg.from.c] = null;
        }
        if (msg.targetPiece && msg.targetPiece.type === 'king') {
          endMatch(player.matchId, player.color, 'KING_CAPTURE', `${player.name} đã bắt Vua đối thủ!`);
          return;
        }
      }

      const opponent = player.color === 'w' ? match.blackPlayer : match.whitePlayer;

      // Broadcast move to opponent (if real socket)
      if (opponent && opponent.ws) {
        sendMsg(opponent.ws, 'OPPONENT_MOVED', {
          from: msg.from,
          to: msg.to,
          pieceType: msg.pieceType,
          targetPiece: msg.targetPiece,
          combatData: msg.combatData,
          nextTurn: match.turn,
          turnCount: match.turnCount
        });
      }

      // Acknowledge move to sender
      sendMsg(ws, 'MOVE_CONFIRMED', {
        nextTurn: match.turn,
        turnCount: match.turnCount
      });

      // If it is now Bot's turn, trigger Bot response!
      if (match.isBotMatch && match.turn === match.botPlayer?.color) {
        scheduleBotTurn(match);
      }
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
      const match = matches.get(player.matchId);
      if (match?.disconnectTimeout) {
        clearTimeout(match.disconnectTimeout);
        match.disconnectTimeout = null;
      }
      endMatch(player.matchId, player.color === 'w' ? 'b' : 'w', 'SURRENDER', `${player.name} đã chủ động đầu hàng.`);
      break;
    }

    case 'RECONNECT_MATCH': {
      const match = matches.get(msg.matchId);
      if (match && match.status === 'ACTIVE') {
        const isWhite = match.whitePlayer.id === msg.playerId;
        const isBlack = match.blackPlayer.id === msg.playerId;
        if (isWhite || isBlack) {
          const reconPlayer = isWhite ? match.whitePlayer : match.blackPlayer;
          const otherPlayer = isWhite ? match.blackPlayer : match.whitePlayer;

          reconPlayer.ws = ws;
          reconPlayer.isAlive = true;
          clients.set(ws, reconPlayer);

          if (match.disconnectTimeout) {
            clearTimeout(match.disconnectTimeout);
            match.disconnectTimeout = null;
          }

          sendMsg(reconPlayer.ws, 'RECONNECT_SUCCESS', {
            matchId: match.id,
            color: reconPlayer.color,
            opponent: { name: otherPlayer.name, elo: otherPlayer.elo, skinId: otherPlayer.skinId }
          });
          sendMsg(otherPlayer.ws, 'OPPONENT_RECONNECTED', {
            opponentName: reconPlayer.name,
            message: `${reconPlayer.name} đã kết nối lại! Trận đấu tiếp tục.`
          });
          return;
        }
      }
      sendMsg(ws, 'ERROR', { message: 'Trận đấu đã kết thúc hoặc không tồn tại.' });
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

  if (match.botTimer) {
    clearTimeout(match.botTimer);
    match.botTimer = null;
  }

  if (match.disconnectTimeout) {
    clearTimeout(match.disconnectTimeout);
    match.disconnectTimeout = null;
  }

  match.status = 'ENDED';

  const isWhiteWinner = winnerColor === 'w';
  const winner = isWhiteWinner ? match.whitePlayer : match.blackPlayer;
  const loser = isWhiteWinner ? match.blackPlayer : match.whitePlayer;
  const defeatedColor = isWhiteWinner ? 'b' : 'w';

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
    defeatedColor,
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
    defeatedColor,
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

  // Forfeit ongoing match on disconnection after a 20-second grace window
  if (player.matchId) {
    const match = matches.get(player.matchId);
    if (match && match.status === 'ACTIVE') {
      const isWhite = player.color === 'w';
      const opponent = isWhite ? match.blackPlayer : match.whitePlayer;
      const winnerColor = isWhite ? 'b' : 'w';

      if (match.disconnectTimeout) {
        clearTimeout(match.disconnectTimeout);
        match.disconnectTimeout = null;
      }

      const GRACE_SECONDS = 20;

      // Notify the remaining opponent with countdown
      if (opponent && opponent.ws) {
        sendMsg(opponent.ws, 'OPPONENT_DISCONNECTED', {
          opponentName: player.name,
          opponentColor: player.color,
          reconnectWindowSec: GRACE_SECONDS,
          reason: 'Đối thủ đã mất kết nối mạng. Đang chờ kết nối lại...'
        });
      }

      // Start 20s countdown. If player does not reconnect within 20s, forfeit!
      match.disconnectTimeout = setTimeout(() => {
        if (match.status === 'ACTIVE') {
          endMatch(player.matchId, winnerColor, 'DISCONNECTED', `${player.name} đã ngắt kết nối quá 20s.`);
        }
      }, GRACE_SECONDS * 1000);
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

// Graceful shutdown on termination signals (Railway / Docker lifecycle)
function handleShutdown(signal) {
  console.log(`[Server] Received ${signal}. Closing all WebSocket connections and server...`);
  for (const [ws] of clients) {
    try {
      ws.close(1001, 'Server is restarting or deploying update.');
    } catch {
      // Ignore error during shutdown
    }
  }
  wss.close(() => {
    server.close(() => {
      console.log('[Server] Successfully shut down.');
      process.exit(0);
    });
  });
  // Force exit after 5 seconds if connections linger
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
