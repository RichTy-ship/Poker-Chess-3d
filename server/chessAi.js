/**
 * Lightweight, Robust Server-Side Chess & Poker AI Engine
 * Powering 10+ Realtime Online Matchmaking Bots
 */

export const PIECE_VALUES = {
  pawn: 10,
  knight: 32,
  bishop: 33,
  rook: 50,
  queen: 90,
  king: 1000
};

export const BOT_COMBOS = [
  { id: 'ONE_PAIR', name: 'Một Đôi', atkBonus: 2, armorBonus: 2, healInstant: 0, colorHex: '#38bdf8' },
  { id: 'TWO_PAIR', name: 'Hai Đôi', atkBonus: 3, armorBonus: 2, healInstant: 0, colorHex: '#2dd4bf' },
  { id: 'THREE_OF_A_KIND', name: 'Sám Cô', atkBonus: 5, armorBonus: 0, healInstant: 0, colorHex: '#a855f7' },
  { id: 'STRAIGHT', name: 'Sảnh', atkBonus: 4, armorBonus: 2, healInstant: 0, colorHex: '#4ade80' },
  { id: 'FLUSH', name: 'Thùng', atkBonus: 4, armorBonus: 0, healInstant: 0, colorHex: '#3b82f6' },
  { id: 'FULL_HOUSE', name: 'Cù Lũ', atkBonus: 5, armorBonus: 4, healInstant: 4, colorHex: '#f59e0b' }
];

export function createInitialBoard() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  const backRow = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  
  // Black pieces (top: rows 0 & 1)
  for (let c = 0; c < 8; c++) {
    board[0][c] = { type: backRow[c], color: 'b' };
    board[1][c] = { type: 'pawn', color: 'b' };
  }
  
  // White pieces (bottom: rows 6 & 7)
  for (let c = 0; c < 8; c++) {
    board[6][c] = { type: 'pawn', color: 'w' };
    board[7][c] = { type: backRow[c], color: 'w' };
  }
  
  return board;
}

function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

export function getLegalMoves(board, color) {
  const moves = [];
  const forwardDir = color === 'w' ? -1 : 1;
  const startPawnRow = color === 'w' ? 6 : 1;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || piece.color !== color) continue;

      const from = { r, c };

      switch (piece.type) {
        case 'pawn': {
          // Single step forward
          const r1 = r + forwardDir;
          if (inBounds(r1, c) && !board[r1][c]) {
            moves.push({ from, to: { r: r1, c }, pieceType: 'pawn', targetPiece: null, score: 0 });
            // Double step from starting rank
            const r2 = r + forwardDir * 2;
            if (r === startPawnRow && inBounds(r2, c) && !board[r2][c]) {
              moves.push({ from, to: { r: r2, c }, pieceType: 'pawn', targetPiece: null, score: 2 });
            }
          }
          // Diagonal captures
          for (const dc of [-1, 1]) {
            const tc = c + dc;
            if (inBounds(r1, tc)) {
              const target = board[r1][tc];
              if (target && target.color !== color) {
                moves.push({
                  from,
                  to: { r: r1, c: tc },
                  pieceType: 'pawn',
                  targetPiece: target,
                  score: 100 + (PIECE_VALUES[target.type] || 10) - 1
                });
              }
            }
          }
          break;
        }

        case 'knight': {
          const jumps = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
          ];
          for (const [dr, dc] of jumps) {
            const tr = r + dr;
            const tc = c + dc;
            if (!inBounds(tr, tc)) continue;
            const target = board[tr][tc];
            if (!target) {
              moves.push({ from, to: { r: tr, c: tc }, pieceType: 'knight', targetPiece: null, score: 0 });
            } else if (target.color !== color) {
              moves.push({
                from,
                to: { r: tr, c: tc },
                pieceType: 'knight',
                targetPiece: target,
                score: 100 + (PIECE_VALUES[target.type] || 10) - 3
              });
            }
          }
          break;
        }

        case 'bishop':
        case 'rook':
        case 'queen': {
          const directions = [];
          if (piece.type === 'bishop' || piece.type === 'queen') {
            directions.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
          }
          if (piece.type === 'rook' || piece.type === 'queen') {
            directions.push([-1, 0], [1, 0], [0, -1], [0, 1]);
          }

          for (const [dr, dc] of directions) {
            let tr = r + dr;
            let tc = c + dc;
            while (inBounds(tr, tc)) {
              const target = board[tr][tc];
              if (!target) {
                moves.push({ from, to: { r: tr, c: tc }, pieceType: piece.type, targetPiece: null, score: 0 });
              } else {
                if (target.color !== color) {
                  moves.push({
                    from,
                    to: { r: tr, c: tc },
                    pieceType: piece.type,
                    targetPiece: target,
                    score: 100 + (PIECE_VALUES[target.type] || 10) - (PIECE_VALUES[piece.type] / 10)
                  });
                }
                break; // blocked by piece
              }
              tr += dr;
              tc += dc;
            }
          }
          break;
        }

        case 'king': {
          const kingSteps = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
          ];
          for (const [dr, dc] of kingSteps) {
            const tr = r + dr;
            const tc = c + dc;
            if (!inBounds(tr, tc)) continue;
            const target = board[tr][tc];
            if (!target) {
              moves.push({ from, to: { r: tr, c: tc }, pieceType: 'king', targetPiece: null, score: -2 });
            } else if (target.color !== color) {
              moves.push({
                from,
                to: { r: tr, c: tc },
                pieceType: 'king',
                targetPiece: target,
                score: 80 + (PIECE_VALUES[target.type] || 10)
              });
            }
          }
          break;
        }
      }
    }
  }

  return moves;
}

export function selectBestBotMove(board, botColor) {
  const legalMoves = getLegalMoves(board, botColor);
  if (legalMoves.length === 0) return null;

  // Add position bonuses (central squares e4, d4, e5, d5 control)
  for (const m of legalMoves) {
    const { r, c } = m.to;
    if ((r === 3 || r === 4) && (c === 3 || c === 4)) {
      m.score += 5;
    } else if (r >= 2 && r <= 5 && c >= 2 && c <= 5) {
      m.score += 2;
    }

    // Small random factor so bot doesn't make identical choices every match
    m.score += Math.random() * 4.5;
  }

  // Sort by score descending
  legalMoves.sort((a, b) => b.score - a.score);

  // Return the best move (or top 2 for human-like variety)
  const candidateIndex = Math.min(legalMoves.length - 1, Math.random() < 0.75 ? 0 : 1);
  return legalMoves[candidateIndex];
}

export function selectBotBuffTarget(board, botColor) {
  // Find bot pieces eligible for buff
  const eligible = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === botColor && p.type !== 'king') {
        eligible.push({ r, c, type: p.type });
      }
    }
  }
  if (eligible.length === 0) return null;

  // Prefer Knights, Rooks, or Queens for combat impact
  eligible.sort((a, b) => (PIECE_VALUES[b.type] || 0) - (PIECE_VALUES[a.type] || 0));
  const target = eligible[Math.floor(Math.random() * Math.min(3, eligible.length))];
  const combo = BOT_COMBOS[Math.floor(Math.random() * BOT_COMBOS.length)];

  return {
    targetRow: target.r,
    targetCol: target.c,
    targetPieceType: target.type,
    comboId: combo.id,
    comboName: combo.name,
    atkBonus: combo.atkBonus,
    armorBonus: combo.armorBonus,
    healInstant: combo.healInstant,
    colorHex: combo.colorHex
  };
}
