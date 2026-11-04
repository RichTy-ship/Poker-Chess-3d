// ============================================================================
// VƯƠNG QUYỀN – POKER CHESS: CORE GAMEPLAY, POKER ENGINE & RPG COMBAT SYSTEM
// ============================================================================

export const UNIT_BASE_STATS = {
  pawn:   { name: 'Tốt',   enName: 'Pawn',   atk: 3, hp: 12, xpKill: 15, icon: '♙' },
  knight: { name: 'Mã',    enName: 'Knight', atk: 5, hp: 18, xpKill: 30, icon: '♘' },
  bishop: { name: 'Tượng', enName: 'Bishop', atk: 4, hp: 17, xpKill: 30, icon: '♗' },
  rook:   { name: 'Xe',    enName: 'Rook',   atk: 6, hp: 25, xpKill: 45, icon: '♖' },
  queen:  { name: 'Hậu',   enName: 'Queen',  atk: 8, hp: 30, xpKill: 70, icon: '♕' },
  king:   { name: 'Vua',   enName: 'King',   atk: 4, hp: 40, xpKill: 100, icon: '♔' }
};

export const LEVEL_XP_THRESHOLDS = [0, 20, 55, 110, 190]; // Lv.1 -> Lv.5

export const UNIT_SKILLS = {
  pawn: {
    name: 'Phương Trận Đồng Tâm',
    desc: '+1 Công, +2 Giáp khi đứng cạnh Tốt đồng minh. Lv.3+: +2 Công khi đánh quân nhiều máu hơn.',
    shortTag: 'Phương Trận (+1⚔/+2🛡)'
  },
  knight: {
    name: 'Kỵ Binh Xung Kích',
    desc: 'Nhảy qua đầu ít nhất 1 quân: +2 Công & làm mục tiêu giảm 2 Công phản đòn. Lv.3+: Hạ địch nhận +4 Giáp.',
    shortTag: 'Xung Kích (+2⚔/Choáng)'
  },
  bishop: {
    name: 'Thánh Quang Viễn Chinh',
    desc: 'Tấn công chéo từ 3 ô trở lên: Xuyên 100% Giáp & giảm 50% sát thương phản đòn. Lv.3+: Hồi 3 HP đồng minh cạnh bên.',
    shortTag: 'Quang Tiễn (Xuyên Giáp)'
  },
  rook: {
    name: 'Pháo Đài Cự Thạch',
    desc: 'Đứng yên cuối lượt nhận +2 Giáp (tối đa 6). Đi thẳng >=3 ô: Cộng Giáp hiện tại vào Công.',
    shortTag: 'Cự Thạch (Tích Giáp/Ủi)'
  },
  queen: {
    name: 'Nữ Hoàng Huyết Ấn',
    desc: 'Khuếch đại mọi Ấn Combo Poker thêm +2 Công/+2 Giáp. Lv.3+: Hạ địch rút mới 1 lá bài. (Điểm yếu: Bị vây >=2 đòn/vòng chịu +2 sát thương).',
    shortTag: 'Huyết Ấn (+2 Ấn Combo)'
  },
  king: {
    name: 'Thiên Mệnh Đế Vương',
    desc: 'Hào quang +1 Công/+1 Giáp cho đồng minh xung quanh. Cận vệ Tốt/Xe cạnh bên đỡ hộ 50% đòn >10 sát thương. Còn <=5 quân: +4 Công/+4 Giáp.',
    shortTag: 'Đế Vương (Hào Quang/Thân Chinh)'
  }
};

export const POKER_COMBO_DEFS = {
  HIGH_CARD: {
    id: 'HIGH_CARD',
    rank: 1,
    manaCost: 1,
    hsKeyword: 'Battlecry • Hồi Phục',
    name: 'Mậu Thầu',
    enName: 'High Card',
    role: 'Phép Cường Hóa (1💎)',
    atkBonus: 2,
    armorBonus: 2,
    healInstant: 3,
    colorHex: '#64748b',
    ringColor: 0x64748b,
    desc: 'Tiêu 1💎 Mana: Gắn Buff +2 Công, +2 Giáp & Battlecry hồi ngay +3 Máu cho 1 quân đồng minh.'
  },
  ONE_PAIR: {
    id: 'ONE_PAIR',
    rank: 2,
    manaCost: 2,
    hsKeyword: 'First Blood • Đòn Mở Màn',
    name: 'Một Đôi',
    enName: 'One Pair',
    role: 'Phép Tấn Công (2💎)',
    atkBonus: 4,
    armorBonus: 0,
    healInstant: 0,
    colorHex: '#38bdf8',
    ringColor: 0x38bdf8,
    desc: 'Tiêu 2💎 Mana: Gắn Buff +4 Công. Đòn Mở Màn: +2 Sát thương xuyên giáp nếu mục tiêu đang đầy máu.'
  },
  TWO_PAIR: {
    id: 'TWO_PAIR',
    rank: 3,
    manaCost: 2,
    hsKeyword: 'Taunt Shield • Khiên Kép',
    name: 'Hai Đôi',
    enName: 'Two Pair',
    role: 'Phép Công Thủ (2💎)',
    atkBonus: 3,
    armorBonus: 5,
    healInstant: 0,
    colorHex: '#2dd4bf',
    ringColor: 0x2dd4bf,
    desc: 'Tiêu 2💎 Mana: Gắn Buff +3 Công, +5 Giáp. Khiên Kép: Giảm 2 sát thương phản đòn khi giao tranh.'
  },
  THREE_OF_A_KIND: {
    id: 'THREE_OF_A_KIND',
    rank: 4,
    manaCost: 3,
    hsKeyword: 'Armor Shatter • Phá Giáp',
    name: 'Sám Cô',
    enName: 'Three of a Kind',
    role: 'Phép Xuyên Phá (3💎)',
    atkBonus: 6,
    armorBonus: 3,
    healInstant: 0,
    colorHex: '#a855f7',
    ringColor: 0xa855f7,
    desc: 'Tiêu 3💎 Mana: Gắn Buff +6 Công, +3 Giáp. Phá Giáp: Nghiền nát toàn bộ Giáp mục tiêu trước khi gây sát thương (+3 ST nếu địch có Giáp).'
  },
  STRAIGHT: {
    id: 'STRAIGHT',
    rank: 5,
    manaCost: 3,
    hsKeyword: 'Rush • Bộ Pháp Liên Hoàn',
    name: 'Sảnh',
    enName: 'Straight',
    role: 'Phép Cơ Động (3💎)',
    atkBonus: 4,
    armorBonus: 4,
    healInstant: 0,
    colorHex: '#10b981',
    ringColor: 0x10b981,
    desc: 'Tiêu 3💎 Mana: Gắn Buff +4 Công, +4 Giáp. Rush: Tốt/Vua đi thêm +1 ô; quân trượt được xuyên qua 1 đồng minh chắn đường.'
  },
  FLUSH: {
    id: 'FLUSH',
    rank: 6,
    manaCost: 3,
    hsKeyword: 'Cleave • Sóng Xung Kích',
    name: 'Thùng',
    enName: 'Flush',
    role: 'Phép Đánh Lan (3💎)',
    atkBonus: 5,
    armorBonus: 3,
    healInstant: 0,
    colorHex: '#3b82f6',
    ringColor: 0x3b82f6,
    desc: 'Tiêu 3💎 Mana: Gắn Buff +5 Công, +3 Giáp. Cleave: Gây 4 Sát thương chuẩn lan sang tối đa 3 quân địch đứng cạnh mục tiêu.'
  },
  FULL_HOUSE: {
    id: 'FULL_HOUSE',
    rank: 7,
    manaCost: 4,
    hsKeyword: 'Divine Strike • Đánh Trước',
    name: 'Cù Lũ',
    enName: 'Full House',
    role: 'Phép Hoàng Gia (4💎)',
    atkBonus: 7,
    armorBonus: 7,
    healInstant: 8,
    colorHex: '#f59e0b',
    ringColor: 0xf59e0b,
    desc: 'Tiêu 4💎 Mana: Gắn Buff +7 Công, +7 Giáp, Hồi +8 Máu. Divine Strike: Đánh Trước (Nếu kết liễu mục tiêu, miễn 100% sát thương phản đòn!).'
  },
  FOUR_OF_A_KIND: {
    id: 'FOUR_OF_A_KIND',
    rank: 8,
    manaCost: 5,
    hsKeyword: 'Legendary Spell • Thiên Phạt',
    name: 'Tứ Quý — THIÊN PHẠT',
    enName: 'Four Kings — Divine Judgment',
    role: 'Phép Huyền Thoại (5💎)',
    atkBonus: 0,
    armorBonus: 0,
    healInstant: 0,
    isUltimate: true,
    ultimateType: 'FOUR_KINGS',
    colorHex: '#f5d76e',
    ringColor: 0xf5d76e,
    desc: 'PHÉP HUYỀN THOẠI (5💎): Chọn tối đa 8 quân địch (trừ Vua) — Tiêu diệt tức thời, bỏ qua mọi Máu, Giáp và Kỹ năng!'
  },
  STRAIGHT_FLUSH: {
    id: 'STRAIGHT_FLUSH',
    rank: 9,
    manaCost: 5,
    hsKeyword: 'Mythic Spell • Diệt Thế',
    name: 'Thùng Phá Sảnh — DIỆT THẾ',
    enName: 'Royal Straight Flush — Apocalypse',
    role: 'Phép Thần Thoại (5💎)',
    atkBonus: 0,
    armorBonus: 0,
    healInstant: 0,
    isUltimate: true,
    ultimateType: 'APOCALYPSE',
    colorHex: '#ef4444',
    ringColor: 0xef4444,
    desc: 'PHÉP THẦN THOẠI (5💎): Tiêu diệt toàn bộ 16 quân đối phương bao gồm cả Vua! Chiến thắng tuyệt đối ngay lập tức!'
  }
};

// ============================================================================
// 52-CARD POKER DECK & HAND EVALUATOR
// ============================================================================
const SUITS = [
  { id: 'S', symbol: '♠', name: 'Bích', color: 'black' },
  { id: 'H', symbol: '♥', name: 'Cơ',   color: 'red' },
  { id: 'D', symbol: '♦', name: 'Rô',   color: 'red' },
  { id: 'C', symbol: '♣', name: 'Chuồn', color: 'black' }
];

const RANKS = [
  { value: 2,  label: '2' },
  { value: 3,  label: '3' },
  { value: 4,  label: '4' },
  { value: 5,  label: '5' },
  { value: 6,  label: '6' },
  { value: 7,  label: '7' },
  { value: 8,  label: '8' },
  { value: 9,  label: '9' },
  { value: 10, label: '10' },
  { value: 11, label: 'J' },
  { value: 12, label: 'Q' },
  { value: 13, label: 'K' },
  { value: 14, label: 'A' }
];

export function createShuffled52Deck() {
  const deck = [];
  for (const s of SUITS) {
    for (const r of RANKS) {
      deck.push({
        uid: `${r.label}${s.id}_${Math.random().toString(36).slice(2, 7)}`,
        rank: r.value,
        label: r.label,
        suit: s.id,
        suitSymbol: s.symbol,
        suitColor: s.color,
        cardMana: r.value >= 11 ? 2 : 1,
        justDrawn: false
      });
    }
  }
  return shuffleCards(deck);
}

export function shuffleCards(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export function createPlayerPokerState() {
  const fullDeck = createShuffled52Deck();
  // Start with 2 initial cards in hand so Step 1 of every turn is genuinely "Bốc Bài Đầu Lượt (+5 Lá)" like Hearthstone!
  const initialHand = fullDeck.slice(0, 2).map((c) => ({
    ...c,
    isHeldFromPrevTurn: true,
    justDrawn: false
  }));
  const drawPile = fullDeck.slice(2);
  return {
    drawPile,
    hand: sortHandForDisplay(initialHand),
    discardPile: [],
    selectedIndices: [],
    committedComboThisTurn: null,
    reshuffleCount: 0,
    hasDrawnThisTurn: false,
    mana: 5,
    maxMana: 5,
    coinAvailable: true
  };
}

export function sortHandForDisplay(hand) {
  const counts = {};
  for (const c of hand) {
    counts[c.rank] = (counts[c.rank] || 0) + 1;
  }
  return [...hand].sort((a, b) => {
    const diffCount = (counts[b.rank] || 0) - (counts[a.rank] || 0);
    if (diffCount !== 0) return diffCount;
    if (b.rank !== a.rank) return b.rank - a.rank;
    return a.suit.localeCompare(b.suit);
  });
}

export function drawUpToSevenCards(pokerState, markNewlyDrawn = true) {
  for (const existing of pokerState.hand) {
    existing.justDrawn = false;
  }
  const needed = Math.max(0, 7 - pokerState.hand.length);
  for (let i = 0; i < needed; i++) {
    if (pokerState.drawPile.length === 0) {
      if (pokerState.discardPile.length === 0) {
        pokerState.drawPile = createShuffled52Deck();
      } else {
        pokerState.drawPile = shuffleCards(pokerState.discardPile);
        pokerState.discardPile = [];
        pokerState.reshuffleCount += 1;
      }
    }
    const nextCard = pokerState.drawPile.shift();
    if (nextCard) {
      nextCard.isHeldFromPrevTurn = false;
      nextCard.justDrawn = Boolean(markNewlyDrawn);
      pokerState.hand.push(nextCard);
    }
  }
  pokerState.hand = sortHandForDisplay(pokerState.hand);
  pokerState.hasDrawnThisTurn = true;
  // Automatically pre-select the best 5-card combination out of 7 so the player sees their strongest Hearthstone Spell immediately
  const best = findBest5Of7(pokerState.hand);
  pokerState.selectedIndices = best.indices;
  return pokerState;
}

export function prepareNextTurnDrawState(pokerState, turnNumber = 1) {
  if (!pokerState) return;
  for (const c of pokerState.hand) {
    c.isHeldFromPrevTurn = true;
    c.justDrawn = false;
  }
  pokerState.selectedIndices = [];
  pokerState.committedComboThisTurn = null;
  pokerState.hasDrawnThisTurn = pokerState.hand.length >= 7;
  const nextMax = Math.min(10, Math.max(5, 4 + turnNumber));
  pokerState.maxMana = nextMax;
  pokerState.mana = nextMax;
  pokerState.coinAvailable = true;
}

export function consumeSelected5CardsAndDraw(pokerState) {
  const selSet = new Set(pokerState.selectedIndices);
  const usedCards = [];
  const keptCards = [];
  pokerState.hand.forEach((c, idx) => {
    if (selSet.has(idx)) {
      usedCards.push(c);
    } else {
      keptCards.push({ ...c, isHeldFromPrevTurn: true, justDrawn: false });
    }
  });
  pokerState.discardPile.push(...usedCards);
  pokerState.hand = keptCards;
  pokerState.selectedIndices = [];
  return usedCards;
}

export function evaluate5CardCombo(fiveCards) {
  if (!Array.isArray(fiveCards) || fiveCards.length !== 5) {
    return null;
  }
  const sorted = [...fiveCards].sort((a, b) => b.rank - a.rank);
  const ranks = sorted.map((c) => c.rank);
  const suits = sorted.map((c) => c.suit);

  const isFlush = suits.every((s) => s === suits[0]);

  // Check Straight (including Ace-low A-2-3-4-5 wheel straight)
  const uniqueRanks = [...new Set(ranks)];
  let isStraight = false;
  let straightHigh = ranks[0];
  if (uniqueRanks.length === 5) {
    if (ranks[0] - ranks[4] === 4) {
      isStraight = true;
      straightHigh = ranks[0];
    } else if (
      ranks[0] === 14 &&
      ranks[1] === 5 &&
      ranks[2] === 4 &&
      ranks[3] === 3 &&
      ranks[4] === 2
    ) {
      isStraight = true;
      straightHigh = 5;
    }
  }

  const rankCounts = {};
  for (const r of ranks) {
    rankCounts[r] = (rankCounts[r] || 0) + 1;
  }
  const countPairs = Object.entries(rankCounts)
    .map(([r, cnt]) => ({ rank: Number(r), count: cnt }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  let def = POKER_COMBO_DEFS.HIGH_CARD;
  let isRoyal = false;

  if (isStraight && isFlush) {
    def = POKER_COMBO_DEFS.STRAIGHT_FLUSH;
    isRoyal = straightHigh === 14 && ranks[4] === 10;
  } else if (countPairs[0].count === 4) {
    def = POKER_COMBO_DEFS.FOUR_OF_A_KIND;
  } else if (countPairs[0].count === 3 && countPairs[1]?.count === 2) {
    def = POKER_COMBO_DEFS.FULL_HOUSE;
  } else if (isFlush) {
    def = POKER_COMBO_DEFS.FLUSH;
  } else if (isStraight) {
    def = POKER_COMBO_DEFS.STRAIGHT;
  } else if (countPairs[0].count === 3) {
    def = POKER_COMBO_DEFS.THREE_OF_A_KIND;
  } else if (countPairs[0].count === 2 && countPairs[1]?.count === 2) {
    def = POKER_COMBO_DEFS.TWO_PAIR;
  } else if (countPairs[0].count === 2) {
    def = POKER_COMBO_DEFS.ONE_PAIR;
  }

  // Kicker / High-Card Quality Bonus: +1 Atk if the core combo rank is J (11), Q (12), K (13), or A (14)
  const primaryComboRank = isStraight ? straightHigh : countPairs[0].rank;
  const highCardBonusAtk = !def.isUltimate && primaryComboRank >= 11 ? 1 : 0;
  const primaryLabel = RANKS.find((r) => r.value === primaryComboRank)?.label || '';

  return {
    ...def,
    isRoyal,
    primaryComboRank,
    primaryLabel,
    highCardBonusAtk,
    totalAtkBonus: def.atkBonus + highCardBonusAtk,
    totalArmorBonus: def.armorBonus,
    cardsSummary: sorted.map((c) => `${c.label}${c.suitSymbol}`).join(' '),
    scoreValue: def.rank * 1000 + primaryComboRank * 15 + highCardBonusAtk * 10
  };
}

export function findBest5Of7(hand) {
  if (!Array.isArray(hand) || hand.length < 5) {
    return { indices: [0, 1, 2, 3, 4], evaluation: null };
  }
  const n = hand.length;
  let bestIndices = [0, 1, 2, 3, 4];
  let bestEval = null;
  let bestTotalScore = -Infinity;

  for (let a = 0; a < n - 4; a++) {
    for (let b = a + 1; b < n - 3; b++) {
      for (let c = b + 1; c < n - 2; c++) {
        for (let d = c + 1; d < n - 1; d++) {
          for (let e = d + 1; e < n; e++) {
            const pick = [hand[a], hand[b], hand[c], hand[d], hand[e]];
            const ev = evaluate5CardCombo(pick);
            if (!ev) continue;

            // Also score the 2 held cards for future potential (pair or suited/connected)
            const held = [];
            for (let k = 0; k < n; k++) {
              if (k !== a && k !== b && k !== c && k !== d && k !== e) {
                held.push(hand[k]);
              }
            }
            let holdScore = 0;
            if (held.length === 2) {
              if (held[0].rank === held[1].rank) {
                holdScore += 45 + held[0].rank * 2; // Held pocket pair!
              } else {
                if (held[0].suit === held[1].suit) holdScore += 18;
                if (Math.abs(held[0].rank - held[1].rank) <= 2) holdScore += 15;
              }
            }

            const totalScore = ev.scoreValue + holdScore;
            if (totalScore > bestTotalScore) {
              bestTotalScore = totalScore;
              bestIndices = [a, b, c, d, e];
              bestEval = ev;
            }
          }
        }
      }
    }
  }
  return { indices: bestIndices, evaluation: bestEval };
}

// Preset hands for immediate testing of Ultimate / Specific Combos
export function injectPresetHand(pokerState, presetType) {
  if (presetType === 'FOUR_KINGS' || presetType === 'FOUR_OF_A_KIND') {
    pokerState.hand = [
      { uid: 'KS_ult', rank: 13, label: 'K', suit: 'S', suitSymbol: '♠', suitColor: 'black' },
      { uid: 'KH_ult', rank: 13, label: 'K', suit: 'H', suitSymbol: '♥', suitColor: 'red' },
      { uid: 'KD_ult', rank: 13, label: 'K', suit: 'D', suitSymbol: '♦', suitColor: 'red' },
      { uid: 'KC_ult', rank: 13, label: 'K', suit: 'C', suitSymbol: '♣', suitColor: 'black' },
      { uid: 'AS_ult', rank: 14, label: 'A', suit: 'S', suitSymbol: '♠', suitColor: 'black' },
      pokerState.hand[5] || { uid: '9H_ult', rank: 9, label: '9', suit: 'H', suitSymbol: '♥', suitColor: 'red' },
      pokerState.hand[6] || { uid: '8D_ult', rank: 8, label: '8', suit: 'D', suitSymbol: '♦', suitColor: 'red' }
    ];
    pokerState.selectedIndices = [0, 1, 2, 3, 4];
  } else if (presetType === 'ROYAL_FLUSH' || presetType === 'STRAIGHT_FLUSH') {
    pokerState.hand = [
      { uid: 'AS_rf', rank: 14, label: 'A', suit: 'H', suitSymbol: '♥', suitColor: 'red' },
      { uid: 'KS_rf', rank: 13, label: 'K', suit: 'H', suitSymbol: '♥', suitColor: 'red' },
      { uid: 'QS_rf', rank: 12, label: 'Q', suit: 'H', suitSymbol: '♥', suitColor: 'red' },
      { uid: 'JS_rf', rank: 11, label: 'J', suit: 'H', suitSymbol: '♥', suitColor: 'red' },
      { uid: '10S_rf', rank: 10, label: '10', suit: 'H', suitSymbol: '♥', suitColor: 'red' },
      pokerState.hand[5] || { uid: '7C_rf', rank: 7, label: '7', suit: 'C', suitSymbol: '♣', suitColor: 'black' },
      pokerState.hand[6] || { uid: '4S_rf', rank: 4, label: '4', suit: 'S', suitSymbol: '♠', suitColor: 'black' }
    ];
    pokerState.selectedIndices = [0, 1, 2, 3, 4];
  } else if (presetType === 'FULL_HOUSE') {
    pokerState.hand = [
      { uid: 'AS_fh', rank: 14, label: 'A', suit: 'S', suitSymbol: '♠', suitColor: 'black' },
      { uid: 'AH_fh', rank: 14, label: 'A', suit: 'H', suitSymbol: '♥', suitColor: 'red' },
      { uid: 'AD_fh', rank: 14, label: 'A', suit: 'D', suitSymbol: '♦', suitColor: 'red' },
      { uid: 'KS_fh', rank: 13, label: 'K', suit: 'S', suitSymbol: '♠', suitColor: 'black' },
      { uid: 'KH_fh', rank: 13, label: 'K', suit: 'H', suitSymbol: '♥', suitColor: 'red' },
      pokerState.hand[5] || { uid: '7C_fh', rank: 7, label: '7', suit: 'C', suitSymbol: '♣', suitColor: 'black' },
      pokerState.hand[6] || { uid: '4S_fh', rank: 4, label: '4', suit: 'S', suitSymbol: '♠', suitColor: 'black' }
    ];
    pokerState.selectedIndices = [0, 1, 2, 3, 4];
  } else if (presetType === 'FLUSH') {
    pokerState.hand = [
      { uid: 'AS_fl', rank: 14, label: 'A', suit: 'S', suitSymbol: '♠', suitColor: 'black' },
      { uid: 'QS_fl', rank: 12, label: 'Q', suit: 'S', suitSymbol: '♠', suitColor: 'black' },
      { uid: '10S_fl', rank: 10, label: '10', suit: 'S', suitSymbol: '♠', suitColor: 'black' },
      { uid: '8S_fl', rank: 8, label: '8', suit: 'S', suitSymbol: '♠', suitColor: 'black' },
      { uid: '5S_fl', rank: 5, label: '5', suit: 'S', suitSymbol: '♠', suitColor: 'black' },
      pokerState.hand[5] || { uid: '7H_fl', rank: 7, label: '7', suit: 'H', suitSymbol: '♥', suitColor: 'red' },
      pokerState.hand[6] || { uid: '4D_fl', rank: 4, label: '4', suit: 'D', suitSymbol: '♦', suitColor: 'red' }
    ];
    pokerState.selectedIndices = [0, 1, 2, 3, 4];
  } else if (presetType === 'STRAIGHT') {
    pokerState.hand = [
      { uid: '10S_st', rank: 10, label: '10', suit: 'S', suitSymbol: '♠', suitColor: 'black' },
      { uid: '9H_st', rank: 9, label: '9', suit: 'H', suitSymbol: '♥', suitColor: 'red' },
      { uid: '8D_st', rank: 8, label: '8', suit: 'D', suitSymbol: '♦', suitColor: 'red' },
      { uid: '7C_st', rank: 7, label: '7', suit: 'C', suitSymbol: '♣', suitColor: 'black' },
      { uid: '6S_st', rank: 6, label: '6', suit: 'S', suitSymbol: '♠', suitColor: 'black' },
      pokerState.hand[5] || { uid: '2H_st', rank: 2, label: '2', suit: 'H', suitSymbol: '♥', suitColor: 'red' },
      pokerState.hand[6] || { uid: '3D_st', rank: 3, label: '3', suit: 'D', suitSymbol: '♦', suitColor: 'red' }
    ];
    pokerState.selectedIndices = [0, 1, 2, 3, 4];
  }
  pokerState.committedComboThisTurn = null;
  pokerState.hasDrawnThisTurn = true;
  pokerState.maxMana = 10;
  pokerState.mana = 10;
  return pokerState;
}

// ============================================================================
// RPG UNIT INITIALIZATION, BUFFS, PASSIVES & SIMULTANEOUS COMBAT ENGINE
// ============================================================================

export function attachRPGStatsToPiece(pieceObj, level = 1) {
  const base = UNIT_BASE_STATS[pieceObj.type] || UNIT_BASE_STATS.pawn;
  const lvl = Math.max(1, Math.min(5, level));
  const bonusAtk = lvl - 1;
  const bonusHp = (lvl - 1) * 4;

  pieceObj.level = lvl;
  pieceObj.xp = LEVEL_XP_THRESHOLDS[lvl - 1] || 0;
  pieceObj.baseAtk = base.atk + bonusAtk;
  pieceObj.maxHp = base.hp + bonusHp;
  pieceObj.hp = pieceObj.maxHp;
  pieceObj.armor = 0;
  pieceObj.maxArmorCap = Math.floor(pieceObj.maxHp * 0.5); // 50% Max HP Armor Cap
  pieceObj.activeCombo = null; // Holds the active Poker Combo until next combat
  pieceObj.attacksTakenThisRound = 0;
  return pieceObj;
}

export function getUnitArmorCap(piece) {
  return Math.max(4, Math.floor((piece.maxHp || 12) * 0.5));
}

export function applyComboEmpowermentToUnit(piece, comboEval, boardState, turnNumber = 1) {
  if (!piece || !comboEval || comboEval.isUltimate) return null;

  // Enforce max 3 active Combo Seals per side to prevent indefinite passive stalling (RISK-02)
  const friendlyBuffed = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = boardState[r]?.[c];
      if (p && p.color === piece.color && p !== piece && p.activeCombo) {
        friendlyBuffed.push(p);
      }
    }
  }
  if (friendlyBuffed.length >= 3) {
    friendlyBuffed.sort((a, b) => (a.activeCombo.turnApplied || 0) - (b.activeCombo.turnApplied || 0));
    friendlyBuffed[0].activeCombo = null;
  }

  // Queen Signature Passive: "Nữ Hoàng Huyết Ấn" (+2 bonus to any Poker Seal)
  const queenResonanceAtk = piece.type === 'queen' ? 2 : 0;
  const queenResonanceArmor = piece.type === 'queen' && comboEval.totalArmorBonus > 0 ? 2 : 0;

  const finalAtkBonus = comboEval.totalAtkBonus + queenResonanceAtk;
  const finalArmorBonus = comboEval.totalArmorBonus + queenResonanceArmor;

  // Replace old combo with new combo (No infinite combo stacking per Rule 4.3)
  piece.activeCombo = {
    id: comboEval.id,
    rank: comboEval.rank,
    name: comboEval.name,
    role: comboEval.role,
    atkBonus: finalAtkBonus,
    armorBonus: finalArmorBonus,
    colorHex: comboEval.colorHex,
    ringColor: comboEval.ringColor,
    cardsSummary: comboEval.cardsSummary,
    desc: comboEval.desc,
    turnApplied: turnNumber
  };

  const cap = getUnitArmorCap(piece);
  if (finalArmorBonus > 0) {
    piece.armor = Math.min(cap, (piece.armor || 0) + finalArmorBonus);
  }
  if (comboEval.healInstant > 0) {
    piece.hp = Math.min(piece.maxHp, piece.hp + comboEval.healInstant);
  }

  return {
    unitName: UNIT_BASE_STATS[piece.type]?.name || piece.type,
    comboName: comboEval.name,
    atkBonus: finalAtkBonus,
    armorBonus: finalArmorBonus,
    healInstant: comboEval.healInstant || 0
  };
}

export function countFriendlyUnits(color, boardState) {
  let count = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (boardState[r]?.[c]?.color === color) count++;
    }
  }
  return count;
}

export function isAdjacentToKing(piece, r, c, boardState) {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      const neighbor = boardState[nr]?.[nc];
      if (neighbor && neighbor.color === piece.color && neighbor.type === 'king') {
        return true;
      }
    }
  }
  return false;
}

export function hasAdjacentFriendlyPawn(piece, r, c, boardState) {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const neighbor = boardState[r + dr]?.[c + dc];
      if (neighbor && neighbor.color === piece.color && neighbor.type === 'pawn' && neighbor !== piece) {
        return true;
      }
    }
  }
  return false;
}

// ============================================================================
// CONSECRATED & CORRUPTED BOARD TILE MODIFIERS (3D Sanctum & Abyssal Squares)
// ============================================================================
export const BOARD_TILE_MODIFIER_DEFS = {
  CONSECRATED: {
    id: 'CONSECRATED',
    nameVi: 'Ô Thánh Hóa (Consecrated)',
    nameEn: 'Consecrated Tile',
    shortLabel: 'Consecrated • Thánh Hóa',
    icon: '☀️',
    atkMod: 1,
    armorMod: 1,
    colorHex: '#fde047',
    descVi:
      'Ô Thánh Hóa (Consecrated): Ban phước +1⚔ Công kích (ATK) và +1🛡 Giáp hộ vệ (Armor) cho quân cờ đang trấn giữ ô này.'
  },
  CORRUPTED: {
    id: 'CORRUPTED',
    nameVi: 'Ô Tha Hóa (Corrupted)',
    nameEn: 'Corrupted Tile',
    shortLabel: 'Corrupted • Tha Hóa',
    icon: '☠️',
    atkMod: -1,
    armorMod: -1,
    colorHex: '#c084fc',
    descVi:
      'Ô Tha Hóa (Corrupted): Ám khí ăn mòn -1⚔ Công kích (ATK) và -1🛡 Giáp hộ vệ (Armor) của quân cờ đứng trên ô này.'
  }
};

// Symmetric layout of Consecrated & Corrupted squares across the contested midfield and royal vanguard
export const SPECIAL_BOARD_TILES_LIST = [
  // Midfield Contested Sanctums & Abysses (Ranks 4 & 5)
  { r: 4, c: 3, type: 'CONSECRATED' }, // d4
  { r: 3, c: 4, type: 'CONSECRATED' }, // e5
  { r: 4, c: 1, type: 'CONSECRATED' }, // b4
  { r: 3, c: 6, type: 'CONSECRATED' }, // g5
  { r: 4, c: 4, type: 'CORRUPTED' },   // e4
  { r: 3, c: 3, type: 'CORRUPTED' },   // d5
  { r: 4, c: 6, type: 'CORRUPTED' },   // g4
  { r: 3, c: 1, type: 'CORRUPTED' },   // b5
  // Vanguard & Royal Thresholds (Occupied at game start so units immediately exhibit tile modifiers)
  { r: 6, c: 3, type: 'CONSECRATED' }, // d2 (White d-Pawn)
  { r: 1, c: 4, type: 'CONSECRATED' }, // e7 (Black e-Pawn)
  { r: 6, c: 4, type: 'CORRUPTED' },   // e2 (White e-Pawn)
  { r: 1, c: 3, type: 'CORRUPTED' },   // d7 (Black d-Pawn)
  { r: 7, c: 4, type: 'CONSECRATED' }, // e1 (White King Sanctum)
  { r: 0, c: 4, type: 'CONSECRATED' }  // e8 (Black King Sanctum)
];

const SPECIAL_TILE_MAP = new Map(
  SPECIAL_BOARD_TILES_LIST.map((entry) => [
    `${entry.r}_${entry.c}`,
    BOARD_TILE_MODIFIER_DEFS[entry.type]
  ])
);

export function getBoardTileModifier(r, c) {
  const def = SPECIAL_TILE_MAP.get(`${r}_${c}`);
  if (!def) return null;
  return {
    ...def,
    r,
    c
  };
}

// Compute effective Attack & Passive triggers for a hypothetical or real combat between Attacker (at fromR,fromC) and Defender (at toR,toC)
export function simulateRPGCombat(attacker, defender, fromR, fromC, toR, toC, boardState) {
  if (!attacker || !defender) return null;

  const distR = Math.abs(toR - fromR);
  const distC = Math.abs(toC - fromC);
  const chebyshevDist = Math.max(distR, distC);

  let atkDmg = attacker.baseAtk + (attacker.activeCombo?.atkBonus || 0);
  let defCounterDmg = defender.baseAtk + (defender.activeCombo?.atkBonus || 0);

  let atkEffectiveArmor = attacker.armor || 0;
  let defEffectiveArmor = defender.armor || 0;

  const combatNotes = [];

  // 0. Consecrated / Corrupted Board Tile Modifiers
  const atkTileMod = getBoardTileModifier(fromR, fromC);
  if (atkTileMod) {
    atkDmg = Math.max(1, atkDmg + atkTileMod.atkMod);
    atkEffectiveArmor = Math.max(0, atkEffectiveArmor + atkTileMod.armorMod);
    combatNotes.push(
      atkTileMod.id === 'CONSECRATED'
        ? '☀️ Ô Thánh Hóa (+1⚔/+1🛡)'
        : '☠️ Ô Tha Hóa (-1⚔/-1🛡)'
    );
  }
  const defTileMod = getBoardTileModifier(toR, toC);
  if (defTileMod) {
    defCounterDmg = Math.max(0, defCounterDmg + defTileMod.atkMod);
    defEffectiveArmor = Math.max(0, defEffectiveArmor + defTileMod.armorMod);
    combatNotes.push(
      defTileMod.id === 'CONSECRATED'
        ? 'Địch ở Ô Thánh Hóa (+1⚔/+1🛡)'
        : 'Địch ở Ô Tha Hóa (-1⚔/-1🛡)'
    );
  }

  // 1. King Command Aura (+1 Atk / +1 Armor if adjacent to friendly King)
  if (attacker.type !== 'king' && isAdjacentToKing(attacker, toR, toC, boardState)) {
    atkDmg += 1;
    atkEffectiveArmor += 1;
    combatNotes.push('Hào Quang Vua (+1⚔)');
  }
  if (defender.type !== 'king' && isAdjacentToKing(defender, toR, toC, boardState)) {
    defCounterDmg += 1;
    defEffectiveArmor += 1;
  }

  // 2. King Endgame Awakening ("Đế Vương Thân Chinh" when <= 5 friendly units remain)
  if (attacker.type === 'king' && countFriendlyUnits(attacker.color, boardState) <= 5) {
    atkDmg += 4;
    atkEffectiveArmor += 4;
    combatNotes.push('Đế Vương Thân Chinh (+4⚔)');
  }
  if (defender.type === 'king' && countFriendlyUnits(defender.color, boardState) <= 5) {
    defCounterDmg += 4;
    defEffectiveArmor += 4;
  }

  // 3. Pawn Signature Skill: "Phương Trận Đồng Tâm"
  if (attacker.type === 'pawn') {
    if (hasAdjacentFriendlyPawn(attacker, fromR, fromC, boardState)) {
      atkDmg += 1;
      atkEffectiveArmor += 2;
      combatNotes.push('Phương Trận Tốt (+1⚔/+2🛡)');
    }
    if (attacker.level >= 3 && defender.maxHp > attacker.maxHp) {
      atkDmg += 2;
    }
  }
  if (defender.type === 'pawn' && hasAdjacentFriendlyPawn(defender, toR, toC, boardState)) {
    defCounterDmg += 1;
    defEffectiveArmor += 2;
  }

  // 4. Knight Signature Skill: "Kỵ Binh Xung Kích" (Jump over any piece in the 2x3 L-bounding box)
  let knightVaulted = false;
  if (attacker.type === 'knight') {
    const minR = Math.min(fromR, toR);
    const maxR = Math.max(fromR, toR);
    const minC = Math.min(fromC, toC);
    const maxC = Math.max(fromC, toC);
    for (let rr = minR; rr <= maxR; rr++) {
      for (let cc = minC; cc <= maxC; cc++) {
        if ((rr === fromR && cc === fromC) || (rr === toR && cc === toC)) continue;
        if (boardState[rr]?.[cc]) {
          knightVaulted = true;
          break;
        }
      }
    }
    if (knightVaulted) {
      atkDmg += 2;
      defCounterDmg = Math.max(0, defCounterDmg - 2);
      combatNotes.push('Kỵ Binh Xung Kích (+2⚔, Choáng -2 phản đòn)');
    }
  }

  // 5. Bishop Signature Skill: "Thánh Quang Viễn Chinh" (Diagonal snipe >= 3 squares)
  let bishopPierce = false;
  if (attacker.type === 'bishop' && distR === distC && distR >= 3) {
    bishopPierce = true;
    defEffectiveArmor = 0; // Pierces 100% of target armor
    defCounterDmg = Math.floor(defCounterDmg * 0.5); // Reduces counter-attack by 50%
    combatNotes.push('Quang Tiễn Tầm Xa (Xuyên Giáp & Giảm 50% phản đòn)');
  }

  // 6. Rook Signature Skill: "Pháo Đài Cự Thạch" (Shield Slam when charging >= 3 straight squares)
  if (attacker.type === 'rook' && (distR === 0 || distC === 0) && chebyshevDist >= 3 && (attacker.armor || 0) > 0) {
    atkDmg += attacker.armor;
    combatNotes.push(`Pháo Đài Xung Kích (+${attacker.armor}⚔ từ Giáp)`);
  }

  // 7. Queen Vulnerability ("Kiêu Hãnh Hoàng Gia" when focused >= 2 times in a round)
  if (defender.type === 'queen' && (defender.attacksTakenThisRound || 0) >= 1) {
    atkDmg += 2;
    combatNotes.push('Hợp Vây Hậu (+2⚔)');
  }

  // 8. Poker Combo Special Mechanics
  const atkComboId = attacker.activeCombo?.id;
  const defComboId = defender.activeCombo?.id;

  // ONE_PAIR: First Blood (+2 True Damage if target is at 100% HP)
  let bonusTrueDmgToDef = 0;
  if (atkComboId === 'ONE_PAIR' && defender.hp >= defender.maxHp) {
    bonusTrueDmgToDef += 2;
    combatNotes.push('Đòn Mở Màn Một Đôi (+2 ST Chuẩn)');
  }

  // TWO_PAIR: Dual Bulwark (-2 counter damage taken)
  if (atkComboId === 'TWO_PAIR') {
    defCounterDmg = Math.max(0, defCounterDmg - 2);
  }
  if (defComboId === 'TWO_PAIR') {
    atkDmg = Math.max(0, atkDmg - 2);
  }

  // THREE_OF_A_KIND: Armor Shatter (Destroys all target armor before damage + 3 bonus dmg if target had armor)
  if (atkComboId === 'THREE_OF_A_KIND') {
    if (defEffectiveArmor > 0) {
      atkDmg += 3;
      combatNotes.push('Sám Cô Phá Giáp (+3⚔)');
    }
    defEffectiveArmor = 0;
  }
  if (defComboId === 'THREE_OF_A_KIND') {
    atkEffectiveArmor = 0;
  }

  // Calculate Damage to Defender
  const absorbedByDefArmor = bishopPierce ? 0 : Math.min(defEffectiveArmor, atkDmg);
  const netNormalDmgToDef = Math.max(0, atkDmg - absorbedByDefArmor);
  let totalHpLossDef = netNormalDmgToDef + bonusTrueDmgToDef;

  // King Royal Guard Sacrifice ("Cận Vệ Hoàng Gia": adjacent Pawn/Rook intercepts 50% if King takes > 10 dmg)
  let guardPiece = null;
  let guardInterceptDmg = 0;
  if (defender.type === 'king' && totalHpLossDef > 10) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nb = boardState[toR + dr]?.[toC + dc];
        if (nb && nb.color === defender.color && (nb.type === 'rook' || nb.type === 'pawn') && nb.hp > 0) {
          guardPiece = nb;
          break;
        }
      }
      if (guardPiece) break;
    }
    if (guardPiece) {
      guardInterceptDmg = Math.floor(totalHpLossDef * 0.5);
      totalHpLossDef -= guardInterceptDmg;
      combatNotes.push(`Cận Vệ ${UNIT_BASE_STATS[guardPiece.type].name} đỡ hộ ${guardInterceptDmg} ST`);
    }
  }

  const defHpAfter = Math.max(0, defender.hp - totalHpLossDef);
  const defArmorAfter = Math.max(0, (atkComboId === 'THREE_OF_A_KIND' ? 0 : (defender.armor || 0)) - absorbedByDefArmor);

  // FULL_HOUSE: First Strike ("Uy Quyền Tuyệt Đối": if Defender dies, Defender deals 0 counter-damage!)
  let firstStrikeTriggered = false;
  if (atkComboId === 'FULL_HOUSE' && defHpAfter <= 0) {
    defCounterDmg = 0;
    firstStrikeTriggered = true;
    combatNotes.push('Cù Lũ Đánh Trước (Miễn Phản Đòn!)');
  }

  // Calculate simultaneous Counter-Damage to Attacker
  const absorbedByAtkArmor = Math.min(atkEffectiveArmor, defCounterDmg);
  const totalHpLossAtk = Math.max(0, defCounterDmg - absorbedByAtkArmor);
  const atkHpAfter = Math.max(0, attacker.hp - totalHpLossAtk);
  const atkArmorAfter = Math.max(0, (defComboId === 'THREE_OF_A_KIND' ? 0 : (attacker.armor || 0)) - absorbedByAtkArmor);

  // FLUSH: Elemental Cleave (4 True Damage to up to 3 adjacent enemies around Defender)
  const flushSplashTargets = [];
  if (atkComboId === 'FLUSH') {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = toR + dr;
        const nc = toC + dc;
        const splashUnit = boardState[nr]?.[nc];
        if (splashUnit && splashUnit.color !== attacker.color && splashUnit !== defender) {
          flushSplashTargets.push({
            piece: splashUnit,
            r: nr,
            c: nc,
            dmg: 4,
            willDie: splashUnit.hp - 4 <= 0
          });
          if (flushSplashTargets.length >= 3) break;
        }
      }
      if (flushSplashTargets.length >= 3) break;
    }
    if (flushSplashTargets.length > 0) {
      combatNotes.push(`Thùng Đánh Lan (${flushSplashTargets.length} mục tiêu -4 HP)`);
    }
  }

  // Determine 1 of 4 Simultaneous Combat Outcomes
  let outcome = 'CLASH_REPEL';
  let outcomeLabel = 'GIẰNG CO (Bật lùi về ô cũ)';
  if (defHpAfter <= 0 && atkHpAfter > 0) {
    outcome = 'BREAKTHROUGH';
    outcomeLabel = 'ĐỘT PHÁ (Tiêu diệt & Chiếm ô!)';
  } else if (defHpAfter <= 0 && atkHpAfter <= 0) {
    outcome = 'MUTUAL_DESTRUCTION';
    outcomeLabel = 'ĐỒNG QUY VU TẬN (Cả hai cùng ngã xuống!)';
  } else if (defHpAfter > 0 && atkHpAfter <= 0) {
    outcome = 'COUNTER_KILL';
    outcomeLabel = 'BỊ PHẢN SÁT (Tử trận trước mục tiêu!)';
  }

  return {
    outcome,
    outcomeLabel,
    atkDmg,
    defCounterDmg,
    totalHpLossDef,
    totalHpLossAtk,
    absorbedByDefArmor,
    absorbedByAtkArmor,
    defHpAfter,
    atkHpAfter,
    defArmorAfter,
    atkArmorAfter,
    firstStrikeTriggered,
    knightVaulted,
    bishopPierce,
    guardPiece,
    guardInterceptDmg,
    flushSplashTargets,
    combatNotes
  };
}

export function grantUnitXP(piece, xpAmount) {
  if (!piece || piece.hp <= 0 || piece.level >= 5) return { leveledUp: false, xpGained: xpAmount };
  piece.xp = (piece.xp || 0) + xpAmount;
  let leveledUp = false;
  while (piece.level < 5 && piece.xp >= LEVEL_XP_THRESHOLDS[piece.level]) {
    piece.level += 1;
    piece.baseAtk += 1;
    piece.maxHp += 4;
    // Per approved Rule 4.4: Leveling up increases Max HP by +4 (and adds the +4 delta to current HP, never full-healing lost HP)
    piece.hp = Math.min(piece.maxHp, piece.hp + 4);
    piece.maxArmorCap = getUnitArmorCap(piece);
    leveledUp = true;
  }
  return { leveledUp, newLevel: piece.level, xpGained: xpAmount };
}

// ============================================================================
// AAA PHYSICAL ACOUSTIC COMBAT FOLEY & CATHEDRAL ORCHESTRAL AUDIO ENGINE
// (Stereo Convolution Reverb, Analog Saturation, Modal Steel Waveguides & Stone Shatter Foley)
// ============================================================================
class SanctumSoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.sfxVolume = 0.96;
    this.bgmVolume = 0.36;

    // Master Acoustic Chain (Dry Bus + Cathedral Stereo Convolver Reverb + Warm Saturator + Mastering Compressor)
    this._masterDry = null;
    this._reverbSend = null;
    this._convolver = null;
    this._compressor = null;
    this._saturator = null;

    // Pre-computed acoustic noise & impulse buffers
    this._noiseBuffer = null;
    this._brownNoiseBuffer = null;
    this._metallicTransientBuffer = null;

    // Low-time (<10s) tension ticking state
    this.tickLoopActive = false;
    this.tickLoopTimer = null;
    this.tickLoopMasterGain = null;
    this.tickStepParity = 0;
    this.tickSecondsRemaining = 10;

    // Majestic Cathedral Orchestral Score State
    this.bgmPlaying = false;
    this.bgmUserDisabled = false;
    this.bgmIntensity = 'normal'; // 'normal' | 'combat' | 'urgent'
    this.bgmTimer = null;
    this.bgmStep = 0;
    this.bgmMasterGain = null;
    this._lastHoverSoundMs = 0;
    this._gestureHookBound = false;

    this._bindAutoUnlockGesture();
  }

  _bindAutoUnlockGesture() {
    if (typeof window === 'undefined' || this._gestureHookBound) return;
    this._gestureHookBound = true;
    const onFirstGesture = () => {
      if (!this.muted && !this.bgmUserDisabled && !this.bgmPlaying) {
        this.startBattleMusic();
      } else if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    };
    window.addEventListener('pointerdown', onFirstGesture, { passive: true });
    window.addEventListener('keydown', onFirstGesture, { passive: true });
  }

  ensureCtx() {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this._initMasterAcousticChain();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  _initMasterAcousticChain() {
    const ctx = this.ctx;
    if (!ctx || this._compressor) return;

    // 1. Mastering Dynamics Compressor / Limiter for punchy cinema-grade impact
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-13, ctx.currentTime);
    comp.knee.setValueAtTime(10, ctx.currentTime);
    comp.ratio.setValueAtTime(4.5, ctx.currentTime);
    comp.attack.setValueAtTime(0.002, ctx.currentTime);
    comp.release.setValueAtTime(0.18, ctx.currentTime);
    comp.connect(ctx.destination);
    this._compressor = comp;

    // 2. Warm Analog Soft-Clip WaveShaper (eliminates harsh digital edges & adds low-end weight)
    const sat = ctx.createWaveShaper();
    const curveLen = 2048;
    const curve = new Float32Array(curveLen);
    for (let i = 0; i < curveLen; i++) {
      const x = (i * 2) / curveLen - 1;
      curve[i] = Math.tanh(x * 1.45) / Math.tanh(1.45);
    }
    sat.curve = curve;
    sat.oversample = '2x';
    sat.connect(comp);
    this._saturator = sat;

    // 3. Dry Master Bus
    const dry = ctx.createGain();
    dry.gain.setValueAtTime(0.95, ctx.currentTime);
    dry.connect(sat);
    this._masterDry = dry;

    // 4. Stereo Gothic Cathedral Convolution Reverb (Early limestone reflections + warm diffuse tail)
    try {
      const conv = ctx.createConvolver();
      conv.buffer = this._createCathedralImpulseResponse(ctx, 1.85, 2.7);
      const revSend = ctx.createGain();
      revSend.gain.setValueAtTime(0.42, ctx.currentTime);
      const revDamp = ctx.createBiquadFilter();
      revDamp.type = 'lowpass';
      revDamp.frequency.setValueAtTime(3400, ctx.currentTime);
      const revHighpass = ctx.createBiquadFilter();
      revHighpass.type = 'highpass';
      revHighpass.frequency.setValueAtTime(95, ctx.currentTime);

      revSend.connect(revHighpass);
      revHighpass.connect(revDamp);
      revDamp.connect(conv);
      conv.connect(sat);

      this._convolver = conv;
      this._reverbSend = revSend;
    } catch (e) {
      this._reverbSend = dry;
    }
  }

  _createCathedralImpulseResponse(ctx, durationSec = 1.85, decayRate = 2.7) {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * durationSec);
    const ir = ctx.createBuffer(2, len, rate);
    const left = ir.getChannelData(0);
    const right = ir.getChannelData(1);

    // Distinct early reflections from Gothic stone pillars & vaulted ceiling (in ms)
    const earlyTapMs = [11, 19, 28, 39, 53, 68, 86, 108];
    const earlyGains = [0.58, -0.46, 0.41, -0.35, 0.29, -0.24, 0.19, 0.15];

    for (let t = 0; t < earlyTapMs.length; t++) {
      const idxL = Math.min(len - 1, Math.floor((earlyTapMs[t] / 1000) * rate));
      const idxR = Math.min(len - 1, Math.floor(((earlyTapMs[t] + (t % 2 === 0 ? 2.3 : -1.8)) / 1000) * rate));
      left[idxL] += earlyGains[t];
      right[idxR] += earlyGains[t] * (t % 2 === 0 ? -0.92 : 0.96);
    }

    let lpL = 0;
    let lpR = 0;
    for (let i = 0; i < len; i++) {
      const u = i / len;
      const env = Math.pow(1 - u, decayRate) * (1 - Math.exp(-i / (rate * 0.012)));
      // Progressive high-frequency air absorption inside the stone hall
      const hfDamp = Math.max(0.08, 0.68 - u * 0.54);
      const nL = Math.random() * 2 - 1;
      const nR = Math.random() * 2 - 1;
      lpL = lpL + hfDamp * (nL - lpL);
      lpR = lpR + hfDamp * (nR - lpR);
      left[i] += lpL * env * 0.42;
      right[i] += lpR * env * 0.42;
    }
    return ir;
  }

  _connectToSanctumSpace(node, dryLevel = 1.0, reverbWet = 0.35, pan = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    if (!this._masterDry) this._initMasterAcousticChain();

    let sourceOut = node;
    if (typeof ctx.createStereoPanner === 'function' && Math.abs(pan) > 0.01) {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), ctx.currentTime);
      node.connect(panner);
      sourceOut = panner;
    }

    if (dryLevel > 0 && this._masterDry) {
      const dGain = ctx.createGain();
      dGain.gain.setValueAtTime(dryLevel, ctx.currentTime);
      sourceOut.connect(dGain);
      dGain.connect(this._masterDry);
    }
    if (reverbWet > 0 && this._reverbSend) {
      const wGain = ctx.createGain();
      wGain.gain.setValueAtTime(reverbWet, ctx.currentTime);
      sourceOut.connect(wGain);
      wGain.connect(this._reverbSend);
    }
  }

  _getNoiseBuffer() {
    const ctx = this.ensureCtx();
    if (!ctx) return null;
    if (this._noiseBuffer && this._noiseBuffer.sampleRate === ctx.sampleRate) {
      return this._noiseBuffer;
    }
    const length = Math.floor(ctx.sampleRate * 1.8);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = Math.max(-1, Math.min(1, white * 0.52 + (b0 + b1 + b2) * 0.48));
    }
    this._noiseBuffer = buffer;
    return buffer;
  }

  _getBrownNoiseBuffer() {
    const ctx = this.ensureCtx();
    if (!ctx) return null;
    if (this._brownNoiseBuffer && this._brownNoiseBuffer.sampleRate === ctx.sampleRate) {
      return this._brownNoiseBuffer;
    }
    const length = Math.floor(ctx.sampleRate * 1.6);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.032 * white) / 1.032;
      data[i] = Math.max(-1, Math.min(1, lastOut * 3.2));
    }
    this._brownNoiseBuffer = buffer;
    return buffer;
  }

  _getMetallicTransientBuffer() {
    const ctx = this.ensureCtx();
    if (!ctx) return null;
    if (this._metallicTransientBuffer && this._metallicTransientBuffer.sampleRate === ctx.sampleRate) {
      return this._metallicTransientBuffer;
    }
    const length = Math.floor(ctx.sampleRate * 0.35);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Physical inharmonic forged-steel bar modes + micro-scrape burst
    const modes = [1642, 2389, 3194, 4286, 5412, 6890, 8120, 9640];
    const modeDecays = [14, 18, 22, 27, 34, 42, 52, 65];
    for (let i = 0; i < length; i++) {
      const t = i / ctx.sampleRate;
      let sum = 0;
      for (let m = 0; m < modes.length; m++) {
        const fm = Math.sin(2 * Math.PI * 195 * t) * (1.8 / (m + 1));
        sum +=
          Math.sin(2 * Math.PI * modes[m] * t + fm) *
          Math.exp(-t * modeDecays[m]) *
          (0.32 / Math.pow(m + 1, 0.55));
      }
      const grit = (Math.random() * 2 - 1) * Math.exp(-t * 85) * 0.55;
      data[i] = Math.max(-1, Math.min(1, sum + grit));
    }
    this._metallicTransientBuffer = buffer;
    return buffer;
  }

  // ==========================================================================
  // AUDIO STATE & CONTROLS
  // ==========================================================================
  isMuted() {
    return Boolean(this.muted);
  }

  setMuted(muteFlag) {
    this.muted = Boolean(muteFlag);
    if (this.muted) {
      this.stopLowTimeTickingLoop(false);
      if (this.bgmPlaying) {
        this._pauseBattleMusicInternal();
      }
    } else {
      this.ensureCtx();
      if (!this.bgmUserDisabled) {
        this.startBattleMusic();
      }
    }
    return this.muted;
  }

  toggleMute() {
    return this.setMuted(!this.muted);
  }

  isBattleMusicPlaying() {
    return Boolean(this.bgmPlaying && !this.muted);
  }

  setBattleMusicIntensity(mode = 'normal') {
    if (mode === 'combat' || mode === 'urgent' || mode === 'normal') {
      this.bgmIntensity = mode;
    }
    return this.bgmIntensity;
  }

  startBattleMusic() {
    if (typeof window === 'undefined') return false;
    this.bgmUserDisabled = false;
    if (this.muted) return false;
    if (this.bgmPlaying) return true;

    const ctx = this.ensureCtx();
    if (!ctx) return false;

    this.bgmPlaying = true;
    this.bgmStep = 0;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.linearRampToValueAtTime(this.bgmVolume, ctx.currentTime + 0.85);
    this._connectToSanctumSpace(master, 0.72, 0.65, 0);
    this.bgmMasterGain = master;

    const scheduleStep = () => {
      if (!this.bgmPlaying || this.muted) return;
      this._triggerBattleMusicStep(this.bgmStep);
      this.bgmStep = (this.bgmStep + 1) % 64;

      const isCombat = this.bgmIntensity === 'combat';
      const isUrgent = this.bgmIntensity === 'urgent';
      const stepMs = isCombat ? 116 : isUrgent ? 124 : 140;
      this.bgmTimer = setTimeout(scheduleStep, stepMs);
    };

    scheduleStep();
    return true;
  }

  _pauseBattleMusicInternal() {
    if (this.bgmTimer) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
    this.bgmPlaying = false;
    const gainNode = this.bgmMasterGain;
    this.bgmMasterGain = null;
    if (gainNode && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(Math.max(0.0001, gainNode.gain.value || 0.2), now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        setTimeout(() => {
          try {
            gainNode.disconnect();
          } catch (e) {}
        }, 340);
      } catch (e) {}
    }
  }

  stopBattleMusic() {
    this.bgmUserDisabled = true;
    this._pauseBattleMusicInternal();
    return false;
  }

  toggleBattleMusic() {
    if (this.bgmPlaying) {
      this.stopBattleMusic();
      return false;
    }
    if (this.muted) {
      this.muted = false;
    }
    return this.startBattleMusic();
  }

  // ==========================================================================
  // CINEMATIC DARK-FANTASY CATHEDRAL ORCHESTRAL SCORE (NO 8-BIT BEEPS)
  // ==========================================================================
  _triggerBattleMusicStep(step) {
    const ctx = this.ensureCtx();
    if (!ctx || !this.bgmMasterGain) return;

    const now = ctx.currentTime;
    const bar = Math.floor(step / 16) % 4;
    const stepInBar = step % 16;
    const isCombat = this.bgmIntensity === 'combat';
    const isUrgent = this.bgmIntensity === 'urgent';
    const intensityGain = isCombat ? 1.25 : isUrgent ? 1.12 : 1.0;

    // Deep Orchestral Cello & Contrabass Roots in D Minor
    const bassRoots = [73.42, 58.27, 65.41, 55.0];
    const choirChords = [
      [146.83, 220.0, 293.66, 349.23],
      [116.54, 174.61, 233.08, 293.66],
      [130.81, 196.0, 261.63, 329.63],
      [110.0, 164.81, 220.0, 277.18]
    ];

    if (stepInBar === 0 || (isCombat && stepInBar === 8)) {
      const rootFreq = bassRoots[bar];
      const dur = stepInBar === 0 ? 2.2 : 1.1;
      this._playCathedralOrganBass(now, rootFreq, dur, 0.17 * intensityGain);
    }

    if (stepInBar === 0) {
      const chord = choirChords[bar];
      this._playGothicChoirPad(now, chord, 2.35, 0.058 * intensityGain);
    }

    // Cinematic Taiko & Timpani War Drums
    if (stepInBar === 0 || stepInBar === 8) {
      this._playWarDrumHit(now, bassRoots[bar] * 1.25, 0.28 * intensityGain, true);
    } else if (stepInBar === 6 || stepInBar === 12 || (isCombat && (stepInBar === 4 || stepInBar === 14))) {
      this._playWarDrumHit(now, bassRoots[bar] * 1.65, 0.16 * intensityGain, false);
    }

    // Distant Forge Anvil / Shield Rim Accent only on beat 12 during combat
    if (isCombat && stepInBar === 12) {
      this._playMartialRimShot(now, 0.08 * intensityGain);
    }
  }

  _playCathedralOrganBass(now, freq, duration, peakGain) {
    const ctx = this.ctx;
    if (!ctx || !this.bgmMasterGain) return;

    const oscSub = ctx.createOscillator();
    const oscCello = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    oscSub.type = 'sine';
    oscSub.frequency.setValueAtTime(freq, now);

    oscCello.type = 'sawtooth';
    oscCello.frequency.setValueAtTime(freq, now);
    oscCello.detune.setValueAtTime(5, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, now);
    filter.frequency.exponentialRampToValueAtTime(115, now + duration);
    filter.Q.setValueAtTime(1.4, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscSub.connect(filter);
    oscCello.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmMasterGain);

    oscSub.start(now);
    oscCello.start(now);
    oscSub.stop(now + duration + 0.03);
    oscCello.stop(now + duration + 0.03);
  }

  _playGothicChoirPad(now, freqs, duration, perVoiceGain) {
    const ctx = this.ctx;
    if (!ctx || !this.bgmMasterGain) return;

    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(f, now);
      osc.detune.setValueAtTime((idx - 1.5) * 8, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(480 + idx * 95, now);
      filter.Q.setValueAtTime(1.2, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(perVoiceGain, now + 0.35);
      gain.gain.setValueAtTime(perVoiceGain * 0.82, now + duration * 0.65);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.bgmMasterGain);

      osc.start(now);
      osc.stop(now + duration + 0.04);
    });
  }

  _playWarDrumHit(now, startPitch = 82, peakGain = 0.25, isHeavyDownbeat = true) {
    const ctx = this.ctx;
    if (!ctx || !this.bgmMasterGain) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const dur = isHeavyDownbeat ? 0.46 : 0.28;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startPitch, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + dur);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(gain);
    gain.connect(this.bgmMasterGain);
    osc.start(now);
    osc.stop(now + dur + 0.02);

    const brownBuf = this._getBrownNoiseBuffer();
    if (brownBuf) {
      const noise = ctx.createBufferSource();
      noise.buffer = brownBuf;
      const filter = ctx.createBiquadFilter();
      const nGain = ctx.createGain();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(isHeavyDownbeat ? 190 : 280, now);

      nGain.gain.setValueAtTime(peakGain * 0.65, now);
      nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.bgmMasterGain);
      noise.start(now);
      noise.stop(now + 0.1);
    }
  }

  _playMartialRimShot(now, peakGain = 0.08) {
    const ctx = this.ctx;
    if (!ctx || !this.bgmMasterGain) return;
    const noiseBuf = this._getNoiseBuffer();
    if (!noiseBuf) return;

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(820, now);
    filter.Q.setValueAtTime(2.2, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmMasterGain);
    noise.start(now);
    noise.stop(now + 0.12);
  }

  // ==========================================================================
  // LOW-TIME (<10s) TENSION HEARTBEAT & CLOCK TICK LOOP
  // ==========================================================================
  isLowTimeTickingActive() {
    return Boolean(this.tickLoopActive);
  }

  startLowTimeTickingLoop(secondsRemaining = 9) {
    this.tickSecondsRemaining = Math.max(0, Math.min(10, Number(secondsRemaining) || 9));
    if (this.bgmPlaying && this.bgmIntensity === 'normal') {
      this.setBattleMusicIntensity('urgent');
    }
    if (this.muted || typeof window === 'undefined') return;
    if (this.tickLoopActive) return;

    this.tickLoopActive = true;
    this.tickStepParity = 0;

    const ctx = this.ensureCtx();
    if (ctx) {
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 0.12);
      this._connectToSanctumSpace(masterGain, 0.9, 0.25, 0);
      this.tickLoopMasterGain = masterGain;
    }

    const scheduleNextTick = () => {
      if (!this.tickLoopActive) return;
      this._triggerTensionTickPulse();
      const urgency = 1 - Math.max(0, Math.min(1, this.tickSecondsRemaining / 10));
      const intervalMs = Math.round(480 - urgency * 210);
      this.tickLoopTimer = setTimeout(scheduleNextTick, intervalMs);
    };

    scheduleNextTick();
  }

  updateLowTimeTickingUrgency(secondsRemaining) {
    this.tickSecondsRemaining = Math.max(0, Math.min(10, Number(secondsRemaining) || 0));
  }

  _triggerTensionTickPulse() {
    if (!this.tickLoopActive || this.muted) return;
    const ctx = this.ensureCtx();
    if (!ctx || !this.tickLoopMasterGain) return;

    const now = ctx.currentTime;
    const isAccent = this.tickStepParity % 2 === 0;
    this.tickStepParity += 1;

    const urgency = 1 - Math.max(0, Math.min(1, this.tickSecondsRemaining / 10));

    // Mechanical pocket-watch escapement click (filtered noise impulse, not an 8-bit beep)
    const noiseBuf = this._getNoiseBuffer();
    if (noiseBuf) {
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;
      const bp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(isAccent ? 2100 : 1650, now);
      bp.Q.setValueAtTime(6.0, now);
      const peak = (isAccent ? 0.08 : 0.05) * (1 + urgency * 0.45);
      g.gain.setValueAtTime(peak, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.024);
      noise.connect(bp).connect(g).connect(this.tickLoopMasterGain);
      noise.start(now);
      noise.stop(now + 0.028);
    }

    // Low heartbeat thud on accent
    if (isAccent) {
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      const subPeak = 0.065 * (1 + urgency * 0.5);

      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(72, now);
      subOsc.frequency.exponentialRampToValueAtTime(34, now + 0.11);

      subGain.gain.setValueAtTime(0.0001, now);
      subGain.gain.linearRampToValueAtTime(subPeak, now + 0.008);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      subOsc.connect(subGain);
      subGain.connect(this.tickLoopMasterGain);

      subOsc.start(now);
      subOsc.stop(now + 0.13);
    }
  }

  stopLowTimeTickingLoop(fadeOut = true) {
    if (this.bgmIntensity === 'urgent') {
      this.setBattleMusicIntensity('normal');
    }
    if (this.tickLoopTimer) {
      clearTimeout(this.tickLoopTimer);
      this.tickLoopTimer = null;
    }
    if (!this.tickLoopActive && !this.tickLoopMasterGain) return;
    this.tickLoopActive = false;

    const gainNode = this.tickLoopMasterGain;
    this.tickLoopMasterGain = null;

    if (gainNode && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        const currentVal = Math.max(0.0001, gainNode.gain.value || 0.5);
        gainNode.gain.setValueAtTime(currentVal, now);
        if (fadeOut) {
          gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
          setTimeout(() => {
            try {
              gainNode.disconnect();
            } catch (e) {}
          }, 300);
        } else {
          gainNode.gain.setValueAtTime(0.0001, now);
          gainNode.disconnect();
        }
      } catch (e) {}
    }
  }

  // ==========================================================================
  // AAA PHYSICAL COMBAT, FOLEY & BOARD SOUND EFFECTS
  // ==========================================================================
  playUIHover() {
    const nowPerf = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowPerf - this._lastHoverSoundMs < 55) return;
    this._lastHoverSoundMs = nowPerf;

    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const noiseBuf = this._getNoiseBuffer();
    if (!noiseBuf) return;

    // Subtle velvet/parchment brush transient instead of a sine beep
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1850, now);
    bp.Q.setValueAtTime(3.8, now);
    gain.gain.setValueAtTime(0.018 * this.sfxVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
    noise.connect(bp).connect(gain);
    this._connectToSanctumSpace(gain, 0.9, 0.1, 0);
    noise.start(now);
    noise.stop(now + 0.03);
  }

  playUIClick() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Tactile carved stone & brass latch click (low thud + crisp mechanical snap)
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(165, now);
    sub.frequency.exponentialRampToValueAtTime(48, now + 0.045);
    subGain.gain.setValueAtTime(0.11 * this.sfxVolume, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    sub.connect(subGain);
    this._connectToSanctumSpace(subGain, 0.95, 0.18, 0);
    sub.start(now);
    sub.stop(now + 0.055);

    const noiseBuf = this._getNoiseBuffer();
    if (noiseBuf) {
      const n = ctx.createBufferSource();
      n.buffer = noiseBuf;
      const bp = ctx.createBiquadFilter();
      const nGain = ctx.createGain();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2400, now);
      bp.Q.setValueAtTime(4.2, now);
      nGain.gain.setValueAtTime(0.08 * this.sfxVolume, now);
      nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.022);
      n.connect(bp).connect(nGain);
      this._connectToSanctumSpace(nGain, 0.9, 0.2, 0);
      n.start(now);
      n.stop(now + 0.026);
    }
  }

  playPieceSelect(pieceType = 'pawn') {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const weightMap = {
      pawn: 118,
      knight: 96,
      bishop: 104,
      rook: 76,
      queen: 88,
      king: 68
    };
    const baseFreq = weightMap[pieceType] || 95;

    // 1. Heavy carved marble pedestal lift thump
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(baseFreq, now);
    subOsc.frequency.exponentialRampToValueAtTime(32, now + 0.12);
    subGain.gain.setValueAtTime(0.22 * this.sfxVolume, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    subOsc.connect(subGain);
    this._connectToSanctumSpace(subGain, 0.95, 0.32, 0);
    subOsc.start(now);
    subOsc.stop(now + 0.14);

    // 2. Stone-on-stone slide & armor plate shift foley
    const noiseBuf = this._getNoiseBuffer();
    if (noiseBuf) {
      const n = ctx.createBufferSource();
      n.buffer = noiseBuf;
      const bp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(480, now);
      bp.frequency.exponentialRampToValueAtTime(260, now + 0.09);
      bp.Q.setValueAtTime(2.4, now);
      g.gain.setValueAtTime(0.11 * this.sfxVolume, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);
      n.connect(bp).connect(g);
      this._connectToSanctumSpace(g, 0.85, 0.28, 0);
      n.start(now);
      n.stop(now + 0.1);
    }
  }

  playSquareTarget(isCapture = false) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (isCapture) {
      // Subtle steel blade unsheathe / lock-on whisper when hovering an enemy target
      const metBuf = this._getMetallicTransientBuffer();
      if (metBuf) {
        const src = ctx.createBufferSource();
        src.buffer = metBuf;
        src.playbackRate.setValueAtTime(1.15, now);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(3200, now);
        bp.Q.setValueAtTime(3.5, now);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.075 * this.sfxVolume, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
        src.connect(bp).connect(g);
        this._connectToSanctumSpace(g, 0.8, 0.35, 0);
        src.start(now);
        src.stop(now + 0.1);
      }
    } else {
      // Soft stone tile tap
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(52, now + 0.045);
      g.gain.setValueAtTime(0.065 * this.sfxVolume, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      osc.connect(g);
      this._connectToSanctumSpace(g, 0.9, 0.15, 0);
      osc.start(now);
      osc.stop(now + 0.055);
    }
  }

  playFootstepMarch(pieceType = 'pawn') {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const isHeavy = pieceType === 'rook' || pieceType === 'king' || pieceType === 'knight';

    // 1. Heavy stone monument footstep thump
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isHeavy ? 82 : 108, now);
    osc.frequency.exponentialRampToValueAtTime(isHeavy ? 26 : 36, now + 0.13);

    gain.gain.setValueAtTime((isHeavy ? 0.24 : 0.16) * this.sfxVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    osc.connect(gain);
    this._connectToSanctumSpace(gain, 0.95, 0.38, 0);
    osc.start(now);
    osc.stop(now + 0.15);

    // 2. Marble-on-limestone grinding grit transient
    const brownBuf = this._getBrownNoiseBuffer();
    if (brownBuf) {
      const noise = ctx.createBufferSource();
      noise.buffer = brownBuf;
      const filter = ctx.createBiquadFilter();
      const nGain = ctx.createGain();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(isHeavy ? 240 : 360, now);
      filter.Q.setValueAtTime(1.8, now);
      nGain.gain.setValueAtTime((isHeavy ? 0.14 : 0.09) * this.sfxVolume, now);
      nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      noise.connect(filter).connect(nGain);
      this._connectToSanctumSpace(nGain, 0.9, 0.3, 0);
      noise.start(now);
      noise.stop(now + 0.1);
    }
  }

  playWeaponSwing(pieceType = 'queen') {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const isColossal = pieceType === 'rook' || pieceType === 'king' || pieceType === 'knight';

    // 1. Heavy Doppler Wind-Cleave Whoosh (Low-end brown noise + mid-air shear bandpass)
    const brownBuf = this._getBrownNoiseBuffer();
    if (brownBuf) {
      const wind = ctx.createBufferSource();
      wind.buffer = brownBuf;
      const lp = ctx.createBiquadFilter();
      const wGain = ctx.createGain();

      lp.type = 'bandpass';
      lp.frequency.setValueAtTime(isColossal ? 110 : 160, now);
      lp.frequency.exponentialRampToValueAtTime(isColossal ? 480 : 680, now + 0.13);
      lp.frequency.exponentialRampToValueAtTime(140, now + 0.28);
      lp.Q.setValueAtTime(1.3, now);

      wGain.gain.setValueAtTime(0.0001, now);
      wGain.gain.linearRampToValueAtTime(0.32 * this.sfxVolume, now + 0.08);
      wGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.29);

      wind.connect(lp).connect(wGain);
      this._connectToSanctumSpace(wGain, 0.95, 0.38, -0.18);
      wind.start(now);
      wind.stop(now + 0.3);
    }

    // 2. Crisp Air-Cut Turbulence & Armor Plate Snap
    const noiseBuf = this._getNoiseBuffer();
    if (noiseBuf) {
      const air = ctx.createBufferSource();
      air.buffer = noiseBuf;
      const bp = ctx.createBiquadFilter();
      const aGain = ctx.createGain();

      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(420, now + 0.02);
      bp.frequency.exponentialRampToValueAtTime(1850, now + 0.14);
      bp.frequency.exponentialRampToValueAtTime(520, now + 0.25);
      bp.Q.setValueAtTime(2.6, now + 0.02);

      aGain.gain.setValueAtTime(0.0001, now + 0.02);
      aGain.gain.linearRampToValueAtTime(0.18 * this.sfxVolume, now + 0.09);
      aGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);

      air.connect(bp).connect(aGain);
      this._connectToSanctumSpace(aGain, 0.88, 0.35, 0.18);
      air.start(now + 0.02);
      air.stop(now + 0.27);
    }

    // 3. Forged-Steel Blade Edge Whisper (Excited metallic waveguide buffer, NO 8-bit triangle pitch sweep)
    const metBuf = this._getMetallicTransientBuffer();
    if (metBuf) {
      const met = ctx.createBufferSource();
      met.buffer = metBuf;
      met.playbackRate.setValueAtTime(isColossal ? 0.82 : 1.04, now + 0.03);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(2400, now + 0.03);
      const mGain = ctx.createGain();
      mGain.gain.setValueAtTime(0.0001, now + 0.03);
      mGain.gain.linearRampToValueAtTime(0.14 * this.sfxVolume, now + 0.08);
      mGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
      met.connect(hp).connect(mGain);
      this._connectToSanctumSpace(mGain, 0.78, 0.48, 0.1);
      met.start(now + 0.03);
      met.stop(now + 0.25);
    }
  }

  playBladeClash(isEmpowered = false) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const boost = isEmpowered ? 1.28 : 1.0;

    // 1. Heavy Physical Crossguard & Shield Impact Thud (Gives real weight to steel-on-steel parry)
    const subImpact = ctx.createOscillator();
    const subGain = ctx.createGain();
    subImpact.type = 'sine';
    subImpact.frequency.setValueAtTime(isEmpowered ? 115 : 94, now);
    subImpact.frequency.exponentialRampToValueAtTime(28, now + 0.18);
    subGain.gain.setValueAtTime(0.32 * boost * this.sfxVolume, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);
    subImpact.connect(subGain);
    this._connectToSanctumSpace(subGain, 0.98, 0.42, 0);
    subImpact.start(now);
    subImpact.stop(now + 0.2);

    // 2. Dual Layered Forged-Steel Waveguide Clash & Scrape (Using pre-computed inharmonic steel impulse)
    const metBuf = this._getMetallicTransientBuffer();
    if (metBuf) {
      const rates = isEmpowered ? [0.92, 1.08, 1.34] : [0.96, 1.16];
      rates.forEach((rate, idx) => {
        const src = ctx.createBufferSource();
        src.buffer = metBuf;
        src.playbackRate.setValueAtTime(rate, now + idx * 0.012);

        const bp = ctx.createBiquadFilter();
        bp.type = 'peaking';
        bp.frequency.setValueAtTime(2800 + idx * 1100, now);
        bp.Q.setValueAtTime(3.2, now);
        bp.gain.setValueAtTime(6, now);

        const g = ctx.createGain();
        g.gain.setValueAtTime((0.34 / (idx + 1)) * boost * this.sfxVolume, now + idx * 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.32 + idx * 0.04);

        src.connect(bp).connect(g);
        this._connectToSanctumSpace(g, 0.88, 0.58, (idx - 0.5) * 0.28);
        src.start(now + idx * 0.012);
        src.stop(now + 0.34 + idx * 0.04);
      });
    }

    // 3. High-Velocity Steel Edge Friction Burst & Spark Sizzle
    const noiseBuf = this._getNoiseBuffer();
    if (noiseBuf) {
      const n = ctx.createBufferSource();
      n.buffer = noiseBuf;

      // Parallel high-Q resonant steel filter pair
      const res1 = ctx.createBiquadFilter();
      res1.type = 'bandpass';
      res1.frequency.setValueAtTime(3480, now);
      res1.frequency.exponentialRampToValueAtTime(2890, now + 0.14);
      res1.Q.setValueAtTime(14.0, now);

      const res2 = ctx.createBiquadFilter();
      res2.type = 'bandpass';
      res2.frequency.setValueAtTime(5840, now);
      res2.frequency.exponentialRampToValueAtTime(4920, now + 0.12);
      res2.Q.setValueAtTime(18.0, now);

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.28 * boost * this.sfxVolume, now);
      nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

      n.connect(res1);
      n.connect(res2);
      res1.connect(nGain);
      res2.connect(nGain);
      this._connectToSanctumSpace(nGain, 0.85, 0.55, 0);
      n.start(now);
      n.stop(now + 0.17);
    }
  }

  playCardSelect() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const noiseBuf = this._getNoiseBuffer();
    if (noiseBuf) {
      const n = ctx.createBufferSource();
      n.buffer = noiseBuf;
      const bp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1400, now);
      bp.frequency.exponentialRampToValueAtTime(2200, now + 0.055);
      bp.Q.setValueAtTime(2.6, now);
      g.gain.setValueAtTime(0.09 * this.sfxVolume, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      n.connect(bp).connect(g);
      this._connectToSanctumSpace(g, 0.9, 0.22, 0);
      n.start(now);
      n.stop(now + 0.065);
    }
  }

  playCardDraw() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 5 Staggered Crisp Parchment Card Deal Flicks (Authentic tabletop card dealing foley)
    const noiseBuf = this._getNoiseBuffer();
    if (noiseBuf) {
      for (let i = 0; i < 5; i++) {
        const t0 = now + i * 0.048;
        const n = ctx.createBufferSource();
        n.buffer = noiseBuf;
        const bp = ctx.createBiquadFilter();
        const g = ctx.createGain();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1150 + i * 140, t0);
        bp.frequency.exponentialRampToValueAtTime(2600 + i * 180, t0 + 0.065);
        bp.Q.setValueAtTime(2.4, t0);

        g.gain.setValueAtTime(0.11 * this.sfxVolume, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.075);

        n.connect(bp).connect(g);
        this._connectToSanctumSpace(g, 0.92, 0.25, (i - 2) * 0.18);
        n.start(t0);
        n.stop(t0 + 0.08);
      }
    }
  }

  playManaSpend() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Deep arcane crystal resonance + warm sub swell
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(110, now);
    sub.frequency.exponentialRampToValueAtTime(55, now + 0.32);
    subGain.gain.setValueAtTime(0.18 * this.sfxVolume, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
    sub.connect(subGain);
    this._connectToSanctumSpace(subGain, 0.85, 0.45, 0);
    sub.start(now);
    sub.stop(now + 0.36);

    const metBuf = this._getMetallicTransientBuffer();
    if (metBuf) {
      const src = ctx.createBufferSource();
      src.buffer = metBuf;
      src.playbackRate.setValueAtTime(0.75, now);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2200, now);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.14 * this.sfxVolume, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
      src.connect(lp).connect(g);
      this._connectToSanctumSpace(g, 0.7, 0.65, 0);
      src.start(now);
      src.stop(now + 0.34);
    }
  }

  playWarningLocked() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Heavy dull iron lock thud
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(98, now);
    osc.frequency.exponentialRampToValueAtTime(46, now + 0.16);
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(260, now);
    gain.gain.setValueAtTime(0.18 * this.sfxVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(lp).connect(gain);
    this._connectToSanctumSpace(gain, 0.9, 0.25, 0);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  playComboEmpower(rank = 2) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Deep forge-fire & war-drum buff ignition
    this._playWarDrumHit(now, 92 + rank * 4, 0.26 * this.sfxVolume, true);

    // 2. Warm orchestral brass fifth swell in cathedral space
    const root = 146.83; // D3
    const fifth = 220.0; // A3
    const oct = 293.66;  // D4
    [root, fifth, oct].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = idx === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(f, now);
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(520 + rank * 65, now);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.085 * this.sfxVolume, now + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
      osc.connect(lp).connect(g);
      this._connectToSanctumSpace(g, 0.75, 0.65, (idx - 1) * 0.25);
      osc.start(now);
      osc.stop(now + 0.5);
    });
  }

  vibrateMeleeCollision(isKill = false, customPattern = null) {
    return triggerMeleeHapticVibration({
      stage: isKill ? 'lethal_impact' : 'clash_impact',
      isKill: Boolean(isKill),
      pattern: customPattern
    });
  }

  playClashImpact(isKill = false, isEmpowered = false) {
    this.vibrateMeleeCollision(isKill);
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. SEISMIC SUB-BASS CANNON DROP (Deep physical chest punch, NO 8-bit sawtooth buzz)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    const subDur = isKill ? 0.68 : 0.42;
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(isKill ? 128 : 104, now);
    subOsc.frequency.exponentialRampToValueAtTime(22, now + subDur);
    subGain.gain.setValueAtTime((isKill ? 0.48 : 0.34) * this.sfxVolume, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + subDur);
    subOsc.connect(subGain);
    this._connectToSanctumSpace(subGain, 1.0, 0.45, 0);
    subOsc.start(now);
    subOsc.stop(now + subDur + 0.03);

    // 2. HEAVY CANNON / EARTHQUAKE BROWN-NOISE RUMBLE
    const brownBuf = this._getBrownNoiseBuffer();
    if (brownBuf) {
      const rumble = ctx.createBufferSource();
      rumble.buffer = brownBuf;
      const lp = ctx.createBiquadFilter();
      const rGain = ctx.createGain();

      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(isKill ? 240 : 185, now);
      lp.frequency.exponentialRampToValueAtTime(55, now + (isKill ? 0.62 : 0.36));

      rGain.gain.setValueAtTime((isKill ? 0.44 : 0.28) * this.sfxVolume, now);
      rGain.gain.exponentialRampToValueAtTime(0.0001, now + (isKill ? 0.65 : 0.38));

      rumble.connect(lp).connect(rGain);
      this._connectToSanctumSpace(rGain, 0.95, 0.55, 0);
      rumble.start(now);
      rumble.stop(now + (isKill ? 0.68 : 0.4));
    }

    // 3. PLATE ARMOR BUCKLE & MARBLE/OBSIDIAN FRACTURE CRUNCH
    const noiseBuf = this._getNoiseBuffer();
    if (noiseBuf) {
      const crunch = ctx.createBufferSource();
      crunch.buffer = noiseBuf;
      const bp = ctx.createBiquadFilter();
      const cGain = ctx.createGain();

      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(isKill ? 680 : 820, now);
      bp.frequency.exponentialRampToValueAtTime(190, now + (isKill ? 0.38 : 0.24));
      bp.Q.setValueAtTime(1.5, now);

      cGain.gain.setValueAtTime((isKill ? 0.36 : 0.24) * this.sfxVolume, now);
      cGain.gain.exponentialRampToValueAtTime(0.0001, now + (isKill ? 0.4 : 0.26));

      crunch.connect(bp).connect(cGain);
      this._connectToSanctumSpace(cGain, 0.92, 0.52, 0);
      crunch.start(now);
      crunch.stop(now + (isKill ? 0.42 : 0.28));
    }

    // 4. FORGED STEEL SHOCK TRANSIENT (Replaces old 8-bit triangle arpeggio)
    const metBuf = this._getMetallicTransientBuffer();
    if (metBuf) {
      const met = ctx.createBufferSource();
      met.buffer = metBuf;
      met.playbackRate.setValueAtTime(isKill ? 0.74 : 0.88, now);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(isEmpowered || isKill ? 4200 : 3100, now);
      const mGain = ctx.createGain();
      mGain.gain.setValueAtTime((isKill ? 0.28 : 0.2) * this.sfxVolume, now);
      mGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
      met.connect(lp).connect(mGain);
      this._connectToSanctumSpace(mGain, 0.85, 0.62, 0);
      met.start(now);
      met.stop(now + 0.34);
    }

    // 5. CASCADING CARVED STONE RUBBLE & SHARDS SCATTERING ON ALTAR (When unit shatters or heavy hit)
    if ((isKill || isEmpowered) && noiseBuf) {
      const shardCount = isKill ? 7 : 3;
      for (let i = 0; i < shardCount; i++) {
        const delay = 0.025 + i * 0.048 + Math.random() * 0.022;
        const tShard = now + delay;
        const shardSrc = ctx.createBufferSource();
        shardSrc.buffer = noiseBuf;

        const sBp = ctx.createBiquadFilter();
        sBp.type = 'bandpass';
        const shardFreq = 320 + ((i * 217) % 980);
        sBp.frequency.setValueAtTime(shardFreq, tShard);
        sBp.frequency.exponentialRampToValueAtTime(shardFreq * 0.58, tShard + 0.075);
        sBp.Q.setValueAtTime(3.8, tShard);

        const sGain = ctx.createGain();
        const shardAmp = (0.18 / Math.pow(i + 1, 0.45)) * this.sfxVolume;
        sGain.gain.setValueAtTime(shardAmp, tShard);
        sGain.gain.exponentialRampToValueAtTime(0.0001, tShard + 0.085);

        const panPos = ((i % 2 === 0 ? 1 : -1) * (0.2 + (i / shardCount) * 0.65));
        shardSrc.connect(sBp).connect(sGain);
        this._connectToSanctumSpace(sGain, 0.88, 0.55, panPos);
        shardSrc.start(tShard);
        shardSrc.stop(tShard + 0.09);
      }
    }

    // 6. CINEMATIC LOW WAR-HORN / BRAAM SWELL ON LETHAL KILL (Replaces old 8-bit sawtooth notes)
    if (isKill) {
      const braamFreqs = [73.42, 110.0, 146.83]; // Deep D2 + A2 + D3 orchestral low brass
      braamFreqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const lp = ctx.createBiquadFilter();
        const g = ctx.createGain();

        osc.type = idx === 0 ? 'sine' : 'sawtooth';
        osc.frequency.setValueAtTime(f, now + 0.02);
        osc.frequency.exponentialRampToValueAtTime(f * 0.96, now + 0.65);

        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(240, now + 0.02);
        lp.frequency.exponentialRampToValueAtTime(110, now + 0.65);

        g.gain.setValueAtTime(0.0001, now + 0.02);
        g.gain.linearRampToValueAtTime((0.11 / (idx + 1)) * this.sfxVolume, now + 0.08);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.68);

        osc.connect(lp).connect(g);
        this._connectToSanctumSpace(g, 0.78, 0.72, (idx - 1) * 0.2);
        osc.start(now + 0.02);
        osc.stop(now + 0.7);
      });
    }
  }

  playTurnStartFanfare(side = 'w') {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Deep warm kettle-drum + cathedral horn swell
    this._playWarDrumHit(now, side === 'w' ? 92 : 78, 0.2 * this.sfxVolume, true);
  }

  playLevelUp() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    this._playWarDrumHit(now, 110, 0.25 * this.sfxVolume, true);
    const chord = [146.83, 220.0, 293.66, 440.0];
    chord.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t0 = now + i * 0.045;
      osc.frequency.setValueAtTime(f, t0);
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(780, t0);
      gain.gain.setValueAtTime(0.09 * this.sfxVolume, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
      osc.connect(lp).connect(gain);
      this._connectToSanctumSpace(gain, 0.75, 0.65, (i - 1.5) * 0.2);
      osc.start(t0);
      osc.stop(t0 + 0.58);
    });
  }

  playVictoryFanfare() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    this._playWarDrumHit(now, 98, 0.34 * this.sfxVolume, true);
    this._playGothicChoirPad(now, [146.83, 220.0, 293.66, 440.0], 1.6, 0.1 * this.sfxVolume);
  }

  playUltimateThunder(isApocalypse = false) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Massive lightning crack + deep thundercloud rumble in the cathedral
    this.playClashImpact(true, true);

    const brownBuf = this._getBrownNoiseBuffer();
    if (brownBuf) {
      const thunder = ctx.createBufferSource();
      thunder.buffer = brownBuf;
      const lp = ctx.createBiquadFilter();
      const nGain = ctx.createGain();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(isApocalypse ? 380 : 280, now);
      lp.frequency.exponentialRampToValueAtTime(48, now + 1.5);
      nGain.gain.setValueAtTime(0.45 * this.sfxVolume, now);
      nGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.55);
      thunder.connect(lp).connect(nGain);
      this._connectToSanctumSpace(nGain, 0.9, 0.75, 0);
      thunder.start(now);
      thunder.stop(now + 1.58);
    }
  }
}

export function triggerMeleeHapticVibration(options = {}) {
  const {
    stage = 'clash_impact',
    isKill = false,
    pattern: customPattern = null,
    attackerType = null,
    defenderType = null
  } = options || {};

  let pattern = customPattern;
  if (!pattern) {
    if (stage === 'contact') {
      pattern = [35];
    } else if (isKill || stage === 'lethal_impact') {
      // Heavy double-impact + stone-shatter rumble pattern for lethal melee collision
      pattern = [70, 35, 115];
    } else {
      // Crisp metallic blade-clash + shield-recoil tactile vibration pattern
      pattern = [45, 25, 60];
    }
  }

  let vibrated = false;
  try {
    const nav =
      typeof navigator !== 'undefined'
        ? navigator
        : typeof window !== 'undefined'
          ? window.navigator
          : null;
    if (nav && typeof nav.vibrate === 'function') {
      vibrated = Boolean(nav.vibrate(pattern));
    }
  } catch (e) {
    // Ignore security/gesture restrictions on desktop or locked mobile contexts
  }

  const payload = {
    triggered: vibrated,
    supported:
      typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function',
    pattern: Array.isArray(pattern) ? [...pattern] : [Number(pattern) || 50],
    stage,
    isKill: Boolean(isKill),
    attackerType,
    defenderType,
    timestamp: Date.now()
  };

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('pokerchess-haptic', { detail: payload }));
  }

  return payload;
}

export const soundFX = new SanctumSoundEngine();

// ============================================================================
// COMMERCIAL PROGRESSION: ELO RANKING SYSTEM & 10 COSMETIC 3D CHESS SKIN SETS
// (100% Fair-Play Cosmetic Only — Does NOT increase ATK, HP, or Armor)
// ============================================================================

export const ELO_RANK_TIERS = [
  {
    id: 'BRONZE',
    nameVi: 'Tân Binh Đồng',
    nameEn: 'Bronze Initiate',
    minElo: 0,
    maxElo: 1099,
    icon: '🥉',
    colorHex: '#d97706',
    badgeBg: 'rgba(217, 119, 6, 0.18)',
    winBonusGold: 180
  },
  {
    id: 'SILVER',
    nameVi: 'Hiệp Sĩ Bạc',
    nameEn: 'Silver Knight',
    minElo: 1100,
    maxElo: 1299,
    icon: '🥈',
    colorHex: '#94a3b8',
    badgeBg: 'rgba(148, 163, 184, 0.2)',
    winBonusGold: 210
  },
  {
    id: 'GOLD',
    nameVi: 'Chiến Tướng Vàng',
    nameEn: 'Gold Commander',
    minElo: 1300,
    maxElo: 1449,
    icon: '🥇',
    colorHex: '#facc15',
    badgeBg: 'rgba(250, 204, 21, 0.2)',
    winBonusGold: 250
  },
  {
    id: 'PLATINUM',
    nameVi: 'Đại Kiện Tướng Bạch Kim',
    nameEn: 'Platinum Grandmaster',
    minElo: 1450,
    maxElo: 1649,
    icon: '💠',
    colorHex: '#38bdf8',
    badgeBg: 'rgba(56, 189, 248, 0.2)',
    winBonusGold: 300
  },
  {
    id: 'DIAMOND',
    nameVi: 'Hiền Nhân Kim Cương',
    nameEn: 'Diamond Archmage',
    minElo: 1650,
    maxElo: 1849,
    icon: '💎',
    colorHex: '#c084fc',
    badgeBg: 'rgba(192, 132, 252, 0.22)',
    winBonusGold: 360
  },
  {
    id: 'LEGEND',
    nameVi: 'Chí Tôn Huyền Thoại',
    nameEn: 'Sanctum Legend',
    minElo: 1850,
    maxElo: 99999,
    icon: '👑',
    colorHex: '#f43f5e',
    badgeBg: 'rgba(244, 63, 94, 0.24)',
    winBonusGold: 450
  }
];

export const CHESS_SKIN_CATALOG = [
  {
    id: 'classic_sanctum',
    index: 1,
    nameVi: 'Thạch Điện Cổ Điển',
    nameEn: 'Sanctum Alabaster & Obsidian',
    rarity: 'MẶC ĐỊNH',
    rarityColor: '#94a3b8',
    icon: '🏛️',
    goldCost: 0,
    requiredElo: 0,
    requiredRankName: 'Mở khóa sẵn',
    modelArchNameVi: 'Kiến Trúc Gothic & Khiên Phù Điêu Thánh',
    modelBadgeVi: '🏛️ Model: Bệ Đá Bát Giác & Khiên Thánh Thập Tự',
    cosmeticOnlyTag: 'Model 3D Độc Lập • Không Cộng Chỉ Số',
    loreVi:
      'Chế tác từ Cẩm thạch Carrara & Hắc diện thạch nguyên khối. Tốt mang khiên Thập tự, Xe là Pháo đài Gothic, Mã đội giáp thép Chanfron, Vua & Hậu ngự Vương miện và Hào quang Cổ điển.',
    previewSwatches: {
      whiteHex: '#ece7de',
      blackHex: '#1e222b',
      trimHex: '#d4af37',
      bladeHex: '#94a3b8',
      trailHex: '#eab308'
    },
    materials: {
      white: { color: 0xece7de, roughness: 0.28, metalness: 0.04, emissive: 0x000000, emissiveIntensity: 0.0 },
      black: { color: 0x1e222b, roughness: 0.24, metalness: 0.18, emissive: 0x000000, emissiveIntensity: 0.0 },
      trim: { color: 0xd4af37, roughness: 0.25, metalness: 0.90, emissive: 0x2a1f04, emissiveIntensity: 0.10 },
      steel: { color: 0x94a3b8, roughness: 0.20, metalness: 0.88, emissive: 0x0f172a, emissiveIntensity: 0.10 },
      boardLight: { color: 0xdcd3c2, roughness: 0.38, metalness: 0.06 },
      boardDark: { color: 0x14171f, roughness: 0.28, metalness: 0.18 },
      slashTrailHex: 0xeab308
    }
  },
  {
    id: 'royal_ivory_ebony',
    index: 2,
    nameVi: 'Ngà Voi Hoàng Gia',
    nameEn: 'Imperial Ivory & Dynastic Ebony',
    rarity: 'HIẾM',
    rarityColor: '#38bdf8',
    icon: '🚩',
    goldCost: 350,
    requiredElo: 0,
    requiredRankName: 'Mua bằng Vàng',
    modelArchNameVi: 'Vương Triều Đế Chế & Giáp Vàng Hoàng Gia',
    modelBadgeVi: '🚩 Model: Khiên Tròn Đế Chế, Giáp Vai & Cờ Hiệu Vua',
    cosmeticOnlyTag: 'Model 3D Độc Lập • Không Cộng Chỉ Số',
    loreVi:
      'Chất liệu Ngà voi cổ đại & Gỗ Mun Hoàng gia mạ đồng thau. Tốt mang khiên tròn La Mã Parma, Xe đài canh Đại bàng, Vua khoác Vương miện 8 nhánh và Cờ hiệu Chiến trận.',
    previewSwatches: {
      whiteHex: '#fdf8ea',
      blackHex: '#221812',
      trimHex: '#e29d38',
      bladeHex: '#cbd5e1',
      trailHex: '#f59e0b'
    },
    materials: {
      white: { color: 0xfdf8ea, roughness: 0.22, metalness: 0.06, emissive: 0x000000, emissiveIntensity: 0.0 },
      black: { color: 0x221812, roughness: 0.22, metalness: 0.14, emissive: 0x000000, emissiveIntensity: 0.0 },
      trim: { color: 0xe29d38, roughness: 0.22, metalness: 0.88, emissive: 0x261405, emissiveIntensity: 0.10 },
      steel: { color: 0xdfe7f0, roughness: 0.18, metalness: 0.90, emissive: 0x000000, emissiveIntensity: 0.0 },
      boardLight: { color: 0xf3e5c8, roughness: 0.30, metalness: 0.08 },
      boardDark: { color: 0x241710, roughness: 0.26, metalness: 0.16 },
      slashTrailHex: 0xf59e0b
    }
  },
  {
    id: 'jade_dynasty',
    index: 3,
    nameVi: 'Ngọc Bích Đế Vương',
    nameEn: 'Imperial Emerald & Dark Jasper',
    rarity: 'HIẾM',
    rarityColor: '#10b981',
    icon: '🐉',
    goldCost: 600,
    requiredElo: 0,
    requiredRankName: 'Mua bằng Vàng',
    modelArchNameVi: 'Chạm Khắc Ngọc Bích & Tháp Chùa Đế Vương',
    modelBadgeVi: '🐉 Model: Bệ Sen Ngọc, Tháp Chùa & Vương Miện Rồng',
    cosmeticOnlyTag: 'Model 3D Độc Lập • Không Cộng Chỉ Số',
    loreVi:
      'Ngọc Bích Phỉ Thúy tự nhiên dát vàng 22K. Tốt tọa trên Đài Sen ngọc, Xe hóa Tháp Chùa mái cong nhiều tầng, Mã hóa Kỳ Lân bờm vàng, Vua ngự Long Quán và Pháp Luân ngọc.',
    previewSwatches: {
      whiteHex: '#86efac',
      blackHex: '#081f18',
      trimHex: '#f59e0b',
      bladeHex: '#a7f3d0',
      trailHex: '#10b981'
    },
    materials: {
      white: { color: 0x52b788, roughness: 0.22, metalness: 0.08, emissive: 0x082f25, emissiveIntensity: 0.06 },
      black: { color: 0x081f18, roughness: 0.20, metalness: 0.20, emissive: 0x000000, emissiveIntensity: 0.0 },
      trim: { color: 0xf59e0b, roughness: 0.20, metalness: 0.92, emissive: 0x1e1203, emissiveIntensity: 0.12 },
      steel: { color: 0xa7f3d0, roughness: 0.16, metalness: 0.90, emissive: 0x059669, emissiveIntensity: 0.15 },
      boardLight: { color: 0xd1fae5, roughness: 0.28, metalness: 0.12 },
      boardDark: { color: 0x06241d, roughness: 0.22, metalness: 0.24 },
      slashTrailHex: 0x10b981
    }
  },
  {
    id: 'crimson_inquisitor',
    index: 4,
    nameVi: 'Huyết Ngục Phán Quyết',
    nameEn: 'Damascus Steel & Crimson Garnet',
    rarity: 'CỰC HIẾM',
    rarityColor: '#f43f5e',
    icon: '🩸',
    goldCost: 900,
    requiredElo: 0,
    requiredRankName: 'Mua bằng Vàng',
    modelArchNameVi: 'Thép Damascus Đen & Pháo Đài Huyết Ngục',
    modelBadgeVi: '🗡️ Model: Khiên Nhọn Hắc Thiết, Giáp Gai & Vương Miện Hồng Ngọc',
    cosmeticOnlyTag: 'Model 3D Độc Lập • Không Cộng Chỉ Số',
    loreVi:
      'Thép rèn Damascus đen kết hợp Ngọc Hồng Lựu thẫm. Tốt mang Khiên tam giác Hắc Thiết, Xe là Lũy thép Phán quyết có xích sắt, Vua đội Vương miện Hồng Ngọc và Hào quang Gai sắt.',
    previewSwatches: {
      whiteHex: '#d1d5db',
      blackHex: '#19070b',
      trimHex: '#b91c1c',
      bladeHex: '#991b1b',
      trailHex: '#dc2626'
    },
    materials: {
      white: { color: 0xd1d5db, roughness: 0.20, metalness: 0.65, emissive: 0x000000, emissiveIntensity: 0.0 },
      black: { color: 0x19070b, roughness: 0.22, metalness: 0.45, emissive: 0x000000, emissiveIntensity: 0.0 },
      trim: { color: 0xb91c1c, roughness: 0.22, metalness: 0.85, emissive: 0x450a0a, emissiveIntensity: 0.15 },
      steel: { color: 0x991b1b, roughness: 0.18, metalness: 0.90, emissive: 0x450a0a, emissiveIntensity: 0.15 },
      boardLight: { color: 0xe5e7eb, roughness: 0.30, metalness: 0.14 },
      boardDark: { color: 0x18060a, roughness: 0.24, metalness: 0.26 },
      slashTrailHex: 0xdc2626
    }
  },
  {
    id: 'frost_valkyrie',
    index: 5,
    nameVi: 'Băng Tinh Cực Quang',
    nameEn: 'Nordic Glacial Quartz & Cold Silver',
    rarity: 'CỰC HIẾM',
    rarityColor: '#06b6d4',
    icon: '❄️',
    goldCost: 1200,
    requiredElo: 1100,
    requiredRankName: 'Hiệp Sĩ Bạc (1100+ Elo)',
    modelArchNameVi: 'Pha Lê Băng Bắc Âu & Pháo Đài Băng Giá',
    modelBadgeVi: '❄️ Model: Khiên Sao Tuyết, Cung Băng & Vương Miện Băng Tinh',
    cosmeticOnlyTag: 'Model 3D Độc Lập • Không Cộng Chỉ Số',
    loreVi:
      'Pha lê thạch anh băng nguyên chất bọc Bạc Bắc Âu lạnh giá. Tốt trang bị Khiên tròn Sao Tuyết Bắc Âu, Xe là Pháo đài Trụ Băng 4 góc, Hậu mang Cánh Băng Vũ thanh thoát, Vua đội Vương miện Băng Tinh sắc nhọn.',
    previewSwatches: {
      whiteHex: '#e0f2fe',
      blackHex: '#0a1626',
      trimHex: '#cbd5e1',
      bladeHex: '#38bdf8',
      trailHex: '#0ea5e9'
    },
    materials: {
      white: { color: 0xe0f2fe, roughness: 0.16, metalness: 0.12, emissive: 0x032840, emissiveIntensity: 0.08 },
      black: { color: 0x0a1626, roughness: 0.20, metalness: 0.30, emissive: 0x000000, emissiveIntensity: 0.0 },
      trim: { color: 0xcbd5e1, roughness: 0.18, metalness: 0.95, emissive: 0x082f49, emissiveIntensity: 0.12 },
      steel: { color: 0x38bdf8, roughness: 0.16, metalness: 0.90, emissive: 0x0369a1, emissiveIntensity: 0.18 },
      boardLight: { color: 0xf0f9ff, roughness: 0.24, metalness: 0.10 },
      boardDark: { color: 0x081320, roughness: 0.22, metalness: 0.22 },
      slashTrailHex: 0x0ea5e9
    }
  },
  {
    id: 'solar_seraphim',
    index: 6,
    nameVi: 'Thái Dương Thần Sứ',
    nameEn: 'Radiant Alabaster & Sovereign Sun Gold',
    rarity: 'HUYỀN THOẠI',
    rarityColor: '#eab308',
    icon: '☀️',
    goldCost: 1600,
    requiredElo: 1200,
    requiredRankName: 'Hộ Vệ Tinh Nhuệ (1200+ Elo)',
    modelArchNameVi: 'Đền Thánh Mặt Trời & Cánh Seraphim Hoàng Kim',
    modelBadgeVi: '☀️ Model: Bệ Thái Dương, Giáp Thiên Mã & Cánh Seraphim Hậu',
    cosmeticOnlyTag: 'Model 3D Độc Lập • Không Cộng Chỉ Số',
    loreVi:
      'Cẩm thạch trắng ngập tràn ánh dương và Vàng Thái Dương 24K rực rỡ. Tốt mang phù hiệu Mặt trời, Mã là Thiên Mã Pegasean bọc giáp cánh vàng, Hậu sở hữu Đôi Cánh Seraphim Hoàng Kim, Vua ngự Astrolabe Thái Dương 12 tia.',
    previewSwatches: {
      whiteHex: '#fefce8',
      blackHex: '#241d15',
      trimHex: '#eab308',
      bladeHex: '#fef08a',
      trailHex: '#d97706'
    },
    materials: {
      white: { color: 0xfefce8, roughness: 0.24, metalness: 0.06, emissive: 0x000000, emissiveIntensity: 0.0 },
      black: { color: 0x241d15, roughness: 0.22, metalness: 0.22, emissive: 0x000000, emissiveIntensity: 0.0 },
      trim: { color: 0xeab308, roughness: 0.20, metalness: 0.92, emissive: 0x2e1a02, emissiveIntensity: 0.12 },
      steel: { color: 0xfef08a, roughness: 0.18, metalness: 0.90, emissive: 0x713f12, emissiveIntensity: 0.15 },
      boardLight: { color: 0xfef9c3, roughness: 0.28, metalness: 0.08 },
      boardDark: { color: 0x1f170e, roughness: 0.24, metalness: 0.18 },
      slashTrailHex: 0xd97706
    }
  },
  {
    id: 'abyssal_necromancer',
    index: 7,
    nameVi: 'Hắc Ám Tử Linh',
    nameEn: 'Crypt Alabaster & Soul-Forged Iron',
    rarity: 'HUYỀN THOẠI',
    rarityColor: '#22c55e',
    icon: '💀',
    goldCost: 2100,
    requiredElo: 1300,
    requiredRankName: 'Chiến Tướng Vàng (1300+ Elo)',
    modelArchNameVi: 'Lăng Mộ Hầm Tối & Cốt Giáp Tử Linh',
    modelBadgeVi: '💀 Model: Cốt Giáp Đầu Lâu, Tháp Mộ Đá & Sừng Quỷ Vua',
    cosmeticOnlyTag: 'Model 3D Độc Lập • Không Cộng Chỉ Số',
    loreVi:
      'Đá Lăng Mộ phong hóa kết hợp Sắt Hồn Bạc cổ đại cùng đốm ma trơi xanh lục u tịch. Tốt đắp Cốt Giáp ngực, Xe là Tháp Lăng Mộ Cổ Đá, Mã là Ngựa Chiến Tử Thần, Vua mang Sừng Quỷ Lich uốn lượn uy nghiêm.',
    previewSwatches: {
      whiteHex: '#d6d3d1',
      blackHex: '#0f172a',
      trimHex: '#64748b',
      bladeHex: '#94a3b8',
      trailHex: '#10b981'
    },
    materials: {
      white: { color: 0xd6d3d1, roughness: 0.32, metalness: 0.08, emissive: 0x000000, emissiveIntensity: 0.0 },
      black: { color: 0x0f172a, roughness: 0.26, metalness: 0.30, emissive: 0x000000, emissiveIntensity: 0.0 },
      trim: { color: 0x64748b, roughness: 0.22, metalness: 0.88, emissive: 0x052e16, emissiveIntensity: 0.10 },
      steel: { color: 0x94a3b8, roughness: 0.20, metalness: 0.85, emissive: 0x064e3b, emissiveIntensity: 0.14 },
      boardLight: { color: 0xe2e8f0, roughness: 0.32, metalness: 0.10 },
      boardDark: { color: 0x090e17, roughness: 0.26, metalness: 0.22 },
      slashTrailHex: 0x10b981
    }
  },
  {
    id: 'arcane_archmage',
    index: 8,
    nameVi: 'Tinh Vân Pháp Thần',
    nameEn: 'Amethyst Quartz & Starfall Bronze',
    rarity: 'HUYỀN THOẠI',
    rarityColor: '#a855f7',
    icon: '🔮',
    goldCost: 2700,
    requiredElo: 1450,
    requiredRankName: 'Đại Kiện Tướng Bạch Kim (1450+ Elo)',
    modelArchNameVi: 'Viện Pháp Thuật Tinh Vân & Tháp Ma Đạo',
    modelBadgeVi: '🔮 Model: Vòng Ma Pháp Thần, Tháp Pháp Sư & Gyroscope Vua',
    cosmeticOnlyTag: 'Model 3D Độc Lập • Không Cộng Chỉ Số',
    loreVi:
      'Thạch anh Tím Amethyst tinh khiết kết hợp Đồng Thao Sao Rơi. Tốt khắc Vòng Tròn Ma Pháp chân đế, Xe là Ngọn Tháp Pháp Sư đỉnh ngọc bay, Vua sở hữu Vành Đai Gyroscope 3D xoay 360° trang nhã.',
    previewSwatches: {
      whiteHex: '#ede9fe',
      blackHex: '#100a20',
      trimHex: '#b45309',
      bladeHex: '#a855f7',
      trailHex: '#9333ea'
    },
    materials: {
      white: { color: 0xede9fe, roughness: 0.18, metalness: 0.10, emissive: 0x1e1b4b, emissiveIntensity: 0.06 },
      black: { color: 0x100a20, roughness: 0.22, metalness: 0.25, emissive: 0x000000, emissiveIntensity: 0.0 },
      trim: { color: 0xb45309, roughness: 0.22, metalness: 0.90, emissive: 0x2e1065, emissiveIntensity: 0.12 },
      steel: { color: 0xa855f7, roughness: 0.16, metalness: 0.92, emissive: 0x581c87, emissiveIntensity: 0.18 },
      boardLight: { color: 0xf5f3ff, roughness: 0.26, metalness: 0.12 },
      boardDark: { color: 0x0c0717, roughness: 0.22, metalness: 0.24 },
      slashTrailHex: 0x9333ea
    }
  },
  {
    id: 'infernal_drake',
    index: 9,
    nameVi: 'Hỏa Long Dung Nham',
    nameEn: 'Volcanic Basalt & Molten Copper',
    rarity: 'THẦN THOẠI',
    rarityColor: '#f97316',
    icon: '🔥',
    goldCost: 3400,
    requiredElo: 1650,
    requiredRankName: 'Hiền Nhân Kim Cương (1650+ Elo)',
    modelArchNameVi: 'Pháo Đài Núi Lửa & Long Tộc Hỏa Long',
    modelBadgeVi: '🐲 Model: Vảy Rồng Núi Lửa, Đài Nham Thạch & Cánh Rồng Hậu',
    cosmeticOnlyTag: 'Model 3D Độc Lập • Không Cộng Chỉ Số',
    loreVi:
      'Đá Basalt Núi Lửa đen nhám viền Đồng Đỏ đúc chảy cùng mạch than hồng ấm áp. Tốt mang khiên Vảy Rồng Hỏa Tộc, Xe là Miệng Núi Lửa kiên cố, Hậu mang Cánh Rồng Nham Thạch oai phong, Vua đội Vương miện Sừng Rồng cổ đại.',
    previewSwatches: {
      whiteHex: '#e7e5e4',
      blackHex: '#141416',
      trimHex: '#c2410c',
      bladeHex: '#ea580c',
      trailHex: '#f97316'
    },
    materials: {
      white: { color: 0xe7e5e4, roughness: 0.32, metalness: 0.06, emissive: 0x000000, emissiveIntensity: 0.0 },
      black: { color: 0x141416, roughness: 0.40, metalness: 0.20, emissive: 0x000000, emissiveIntensity: 0.0 },
      trim: { color: 0xc2410c, roughness: 0.25, metalness: 0.88, emissive: 0x431407, emissiveIntensity: 0.15 },
      steel: { color: 0xea580c, roughness: 0.20, metalness: 0.90, emissive: 0x7c2d12, emissiveIntensity: 0.20 },
      boardLight: { color: 0xf5f5f4, roughness: 0.32, metalness: 0.08 },
      boardDark: { color: 0x101012, roughness: 0.30, metalness: 0.20 },
      slashTrailHex: 0xf97316
    }
  },
  {
    id: 'celestial_eternity',
    index: 10,
    nameVi: 'Thiên Hà Vĩnh Cửu',
    nameEn: 'Starlight Pearl & Cosmic Midnight Sapphire',
    rarity: 'TỐI THƯỢNG',
    rarityColor: '#38bdf8',
    icon: '🌌',
    goldCost: 4500,
    requiredElo: 1850,
    requiredRankName: 'Chí Tôn Huyền Thoại (1850+ Elo)',
    modelArchNameVi: 'Đài Thiên Văn Tinh Cầu & Vương Quyền Tinh Tú',
    modelBadgeVi: '🌌 Model: Quỹ Đạo Sao Platinum, Cánh Tinh Tú & Vành Đai Sao Thổ Vua',
    cosmeticOnlyTag: 'Model 3D Độc Lập • Không Cộng Chỉ Số',
    loreVi:
      'Ngọc Trai Ánh Sao kết hợp Sapphire Lam Đêm Vũ Trụ viền Bạch Kim Platinum thuần khiết. Tốt mang Quỹ Đạo Vòng Tròn Tinh Cầu thanh nhã, Xe là Đài Thiên Văn Vũ Trụ mái vòm, Hậu mang Cánh Tinh Tú Lăng Kính, Vua ngự Vương Miện Tinh Đế và Vành Đai Sao Thổ thanh lịch.',
    previewSwatches: {
      whiteHex: '#f8fafc',
      blackHex: '#020617',
      trimHex: '#e2e8f0',
      bladeHex: '#38bdf8',
      trailHex: '#2563eb'
    },
    materials: {
      white: { color: 0xf8fafc, roughness: 0.12, metalness: 0.20, emissive: 0x032442, emissiveIntensity: 0.08 },
      black: { color: 0x020617, roughness: 0.15, metalness: 0.55, emissive: 0x02162e, emissiveIntensity: 0.10 },
      trim: { color: 0xe2e8f0, roughness: 0.12, metalness: 0.96, emissive: 0x0c4a6e, emissiveIntensity: 0.15 },
      steel: { color: 0x38bdf8, roughness: 0.14, metalness: 0.92, emissive: 0x0369a1, emissiveIntensity: 0.18 },
      boardLight: { color: 0xf1f5f9, roughness: 0.20, metalness: 0.18 },
      boardDark: { color: 0x020814, roughness: 0.16, metalness: 0.32 },
      slashTrailHex: 0x2563eb
    }
  }
];

const COMMERCIAL_PROFILE_STORAGE_KEY = 'sanctum_commercial_profile_v1';

export function getEloRankInfo(elo = 1050) {
  const numElo = Math.max(0, Math.round(Number(elo) || 1050));
  let currentTier = ELO_RANK_TIERS[0];
  let nextTier = null;
  for (let i = 0; i < ELO_RANK_TIERS.length; i++) {
    if (numElo >= ELO_RANK_TIERS[i].minElo) {
      currentTier = ELO_RANK_TIERS[i];
      nextTier = ELO_RANK_TIERS[i + 1] || null;
    }
  }
  const progressPct = nextTier
    ? Math.max(
        0,
        Math.min(
          100,
          Math.round(
            ((numElo - currentTier.minElo) / Math.max(1, nextTier.minElo - currentTier.minElo)) * 100
          )
        )
      )
    : 100;
  return {
    elo: numElo,
    tierId: currentTier.id,
    tierNameVi: currentTier.nameVi,
    tierNameEn: currentTier.nameEn,
    tierIcon: currentTier.icon,
    tierColor: currentTier.colorHex,
    tierBadgeBg: currentTier.badgeBg,
    winBonusGold: currentTier.winBonusGold,
    nextTierNameVi: nextTier ? nextTier.nameVi : 'Đỉnh Cao Chí Tôn',
    nextTierElo: nextTier ? nextTier.minElo : numElo,
    eloToNextTier: nextTier ? Math.max(0, nextTier.minElo - numElo) : 0,
    progressPct
  };
}

export function loadCommercialProfile() {
  const defaultProfile = {
    elo: 1050,
    peakElo: 1050,
    gold: 650,
    wins: 0,
    losses: 0,
    winStreak: 0,
    totalKills: 0,
    ownedSkinIds: ['classic_sanctum'],
    equippedSkinId: 'classic_sanctum',
    previewSkinId: null,
    lastMatchDelta: null,
    matchHistory: []
  };
  try {
    if (typeof localStorage === 'undefined') return defaultProfile;
    const raw = localStorage.getItem(COMMERCIAL_PROFILE_STORAGE_KEY);
    if (!raw) return defaultProfile;
    const parsed = JSON.parse(raw);
    const owned = Array.isArray(parsed.ownedSkinIds)
      ? Array.from(new Set(['classic_sanctum', ...parsed.ownedSkinIds]))
      : ['classic_sanctum'];
    const equipped = CHESS_SKIN_CATALOG.some((s) => s.id === parsed.equippedSkinId)
      ? parsed.equippedSkinId
      : 'classic_sanctum';
    const elo = Math.max(800, Number(parsed.elo) || 1050);
    const peakElo = Math.max(elo, Number(parsed.peakElo) || elo);
    return {
      elo,
      peakElo,
      gold: Math.max(0, Math.round(Number(parsed.gold) ?? 650)),
      wins: Math.max(0, Number(parsed.wins) || 0),
      losses: Math.max(0, Number(parsed.losses) || 0),
      winStreak: Math.max(0, Number(parsed.winStreak) || 0),
      totalKills: Math.max(0, Number(parsed.totalKills) || 0),
      ownedSkinIds: owned,
      equippedSkinId: equipped,
      previewSkinId: null,
      lastMatchDelta: parsed.lastMatchDelta || null,
      matchHistory: Array.isArray(parsed.matchHistory) ? parsed.matchHistory.slice(0, 8) : []
    };
  } catch (e) {
    return defaultProfile;
  }
}

export function saveCommercialProfile(profile) {
  try {
    if (typeof localStorage !== 'undefined' && profile) {
      localStorage.setItem(COMMERCIAL_PROFILE_STORAGE_KEY, JSON.stringify(profile));
    }
  } catch (e) {}
  return profile;
}


