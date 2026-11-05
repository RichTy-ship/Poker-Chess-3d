import { useEffect, useRef, useState } from 'react';
import { initWizardChess } from './wizardChessEngine.js';
import {
  POKER_COMBO_DEFS,
  UNIT_BASE_STATS,
  UNIT_SKILLS,
  CHESS_SKIN_CATALOG,
  ELO_RANK_TIERS,
  TACTICAL_PING_INTENTS,
  getEloRankInfo
} from './pokerChessCore.js';
import { multiplayerClient } from './multiplayerClient.js';
import donateQrImage from './assets/donate_qr_clean.png';

interface PokerCardUI {
  id: string;
  rank: number;
  suit: string;
  rankLabel: string;
  suitSymbol: string;
  color: 'red' | 'black';
  cardMana?: number;
  justDrawn?: boolean;
  isHeldFromPrevTurn?: boolean;
}

interface ComboDefUI {
  key: string;
  rank: number;
  nameVi: string;
  nameEn: string;
  manaCost: number;
  hsKeyword: string;
  atkBonus: number;
  armorBonus: number;
  instantHeal: number;
  isUltimate: boolean;
  badgeColor: string;
  shortTag: string;
  descVi: string;
}

interface TileModifierUI {
  id: 'CONSECRATED' | 'CORRUPTED';
  nameVi: string;
  nameEn: string;
  shortLabel: string;
  icon: string;
  atkMod: number;
  armorMod: number;
  colorHex: string;
  descVi: string;
  algebraic?: string;
}

interface UnitUI {
  r: number;
  c: number;
  algebraic: string;
  type: string;
  nameVi: string;
  icon: string;
  color: 'w' | 'b';
  level: number;
  xp: number;
  nextXp: number;
  atk: number;
  baseAtk: number;
  hp: number;
  maxHp: number;
  armor: number;
  effectiveArmor?: number;
  phalanxDef: number;
  tileAtkMod?: number;
  tileArmorMod?: number;
  tileModifier?: TileModifierUI | null;
  activeCombo: ComboDefUI | null;
  skill: { nameVi: string; descVi: string } | null;
  killCount: number;
  shieldwallReady: boolean;
  combatAnimState?: 'MELEE_ATTACK' | 'MELEE_DEFEND' | null;
  hpPercent?: number;
  portraitState?: 'PRISTINE' | 'BATTLE_WORN' | 'SHIELD_SHATTER';
  shieldShattered?: boolean;
  alive?: boolean;
  pathHistory?: {
    r: number;
    c: number;
    fromR?: number;
    fromC?: number;
    targetR?: number;
    targetC?: number;
    targetAlgebraic?: string;
    algebraic: string;
    turn: number;
    kind: 'SPAWN' | 'MOVE' | 'CAPTURE' | 'CASTLE' | 'CLASH_REPEL';
  }[];
}

interface CombatForecastUI {
  outcome: 'BREAKTHROUGH' | 'CLASH_REPEL' | 'COUNTER_KILL' | 'MUTUAL_DESTRUCTION';
  attAfterHp: number;
  attAfterArmor: number;
  defAfterHp: number;
  defAfterArmor: number;
  attTotalAtk: number;
  defTotalAtk: number;
  firstStrikeTriggered: boolean;
  notes: string[];
  attackerUnit: UnitUI;
  defenderUnit: UnitUI;
  fromAlgebraic: string;
  toAlgebraic: string;
}

interface TurnTimeoutNoticeUI {
  id: string;
  expiredSide: 'w' | 'b';
  nextSide: 'w' | 'b';
  turnNumber: number;
  timestamp: number;
}

interface ActiveCombatBannerUI {
  attackerR?: number;
  attackerC?: number;
  attackerName: string;
  attackerIcon: string;
  attackerColor: 'w' | 'b';
  attackerAtk: number;
  attackerHp?: number;
  attackerMaxHp?: number;
  attackerCombo: string | null;
  attackerAnimState?: 'MELEE_ATTACK' | 'MELEE_DEFEND' | null;
  defenderR?: number;
  defenderC?: number;
  defenderName: string;
  defenderIcon: string;
  defenderColor: 'w' | 'b';
  defenderAtk: number;
  defenderHp?: number;
  defenderMaxHp?: number;
  defenderAnimState?: 'MELEE_ATTACK' | 'MELEE_DEFEND' | null;
  combatStage?: string;
  outcome: 'BREAKTHROUGH' | 'CLASH_REPEL' | 'COUNTER_KILL' | 'MUTUAL_DESTRUCTION';
}

function renderSkin3DModelSilhouette(skin: (typeof CHESS_SKIN_CATALOG)[number]) {
  const sw = skin.previewSwatches;
  const id = skin.id;

  return (
    <svg
      viewBox="0 0 220 96"
      className="skin-3d-blueprint-svg"
      aria-label={`Mô hình 3D ${skin.nameVi}`}
    >
      <defs>
        <radialGradient id={`aura_${id}`} cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor={sw.trailHex} stopOpacity="0.44" />
          <stop offset="65%" stopColor={skin.rarityColor} stopOpacity="0.14" />
          <stop offset="100%" stopColor="#05070c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`bodyW_${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor={sw.whiteHex} />
          <stop offset="100%" stopColor={sw.trimHex} />
        </linearGradient>
        <linearGradient id={`bodyB_${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={sw.bladeHex} />
          <stop offset="55%" stopColor={sw.blackHex} />
          <stop offset="100%" stopColor="#04060b" />
        </linearGradient>
      </defs>

      {/* Ambient 3D Stage Aura */}
      <ellipse cx="110" cy="52" rx="92" ry="40" fill={`url(#aura_${id})`} />
      <ellipse
        cx="110"
        cy="82"
        rx="72"
        ry="9"
        fill="none"
        stroke={sw.trimHex}
        strokeWidth="1.5"
        strokeDasharray="5 3"
        opacity="0.7"
      />

      {/* SKIN #1: CLASSIC SANCTUM — 4 Gothic Buttress Pillars & Rose Halo */}
      {id === 'classic_sanctum' && (
        <g>
          <circle cx="110" cy="40" r="24" fill="none" stroke={sw.trimHex} strokeWidth="2" />
          <rect x="64" y="46" width="8" height="32" fill={`url(#bodyW_${id})`} stroke={sw.trimHex} strokeWidth="1" />
          <polygon points="62,46 68,34 74,46" fill={sw.trimHex} />
          <rect x="148" y="46" width="8" height="32" fill={`url(#bodyB_${id})`} stroke={sw.trimHex} strokeWidth="1" />
          <polygon points="146,46 152,34 158,46" fill={sw.trimHex} />
        </g>
      )}

      {/* SKIN #2: ROYAL IVORY & EBONY — Twin Tall Imperial War-Banners & 8-Spiked Crown */}
      {id === 'royal_ivory_ebony' && (
        <g>
          {/* Left & Right Tall Back War-Banners */}
          <line x1="68" y1="80" x2="54" y2="14" stroke={sw.trimHex} strokeWidth="2.8" />
          <polygon points="54,18 34,24 38,54 58,48" fill={`url(#bodyW_${id})`} stroke={sw.trimHex} strokeWidth="1.5" />
          <polygon points="54,8 50,16 58,16" fill={sw.bladeHex} />
          <line x1="152" y1="80" x2="166" y2="14" stroke={sw.trimHex} strokeWidth="2.8" />
          <polygon points="166,18 186,24 182,54 162,48" fill={`url(#bodyB_${id})`} stroke={sw.trimHex} strokeWidth="1.5" />
          <polygon points="166,8 162,16 170,16" fill={sw.bladeHex} />
          {/* 8-Spiked Imperial Crown */}
          <polygon points="94,24 98,11 104,21 110,8 116,21 122,11 126,24" fill={sw.trimHex} />
        </g>
      )}

      {/* SKIN #3: JADE DYNASTY — Branching Dragon Horns, Jade Bi-Disc Mandorla & 3 Spirit Pearls */}
      {id === 'jade_dynasty' && (
        <g>
          {/* Floating Carved Jade Bi-Disc Mandorla */}
          <circle cx="110" cy="44" r="30" fill="none" stroke={sw.whiteHex} strokeWidth="5" opacity="0.65" />
          <circle cx="110" cy="44" r="33" fill="none" stroke={sw.trimHex} strokeWidth="1.5" />
          {/* Branching Azure Dragon Antler-Horns */}
          <path d="M98,24 Q82,10 74,4 M88,16 Q78,18 72,13" fill="none" stroke={sw.trimHex} strokeWidth="3" strokeLinecap="round" />
          <path d="M122,24 Q138,10 146,4 M132,16 Q142,18 148,13" fill="none" stroke={sw.trimHex} strokeWidth="3" strokeLinecap="round" />
          {/* 3 Orbiting Jade Spirit Pearls */}
          <circle cx="52" cy="46" r="6.5" fill={sw.trailHex} stroke="#ffffff" strokeWidth="1.5" />
          <circle cx="168" cy="46" r="6.5" fill={sw.trailHex} stroke="#ffffff" strokeWidth="1.5" />
          <circle cx="110" cy="11" r="5.5" fill={sw.bladeHex} stroke={sw.trimHex} strokeWidth="1.5" />
        </g>
      )}

      {/* SKIN #4: CRIMSON INQUISITOR — 4 Levitating Executioner Greatswords & Spiked Iron Halo */}
      {id === 'crimson_inquisitor' && (
        <g>
          {/* Spiked Iron Halo */}
          <circle cx="110" cy="34" r="21" fill="none" stroke={sw.trimHex} strokeWidth="2.2" />
          {/* 4 Levitating Executioner Greatswords fanned behind */}
          <g transform="translate(56,42) rotate(-28)">
            <polygon points="-4,-24 4,-24 6,22 0,32 -6,22" fill={sw.bladeHex} stroke={sw.trimHex} strokeWidth="1.2" />
            <rect x="-11" y="-26" width="22" height="4" fill={sw.trimHex} />
          </g>
          <g transform="translate(76,52) rotate(-14)">
            <polygon points="-3.5,-20 3.5,-20 5,18 0,27 -5,18" fill={sw.trimHex} stroke="#ffffff" strokeWidth="1" />
            <rect x="-9" y="-22" width="18" height="3.5" fill={sw.whiteHex} />
          </g>
          <g transform="translate(164,42) rotate(28)">
            <polygon points="-4,-24 4,-24 6,22 0,32 -6,22" fill={sw.bladeHex} stroke={sw.trimHex} strokeWidth="1.2" />
            <rect x="-11" y="-26" width="22" height="4" fill={sw.trimHex} />
          </g>
          <g transform="translate(144,52) rotate(14)">
            <polygon points="-3.5,-20 3.5,-20 5,18 0,27 -5,18" fill={sw.trimHex} stroke="#ffffff" strokeWidth="1" />
            <rect x="-9" y="-22" width="18" height="3.5" fill={sw.whiteHex} />
          </g>
        </g>
      )}

      {/* SKIN #5: FROST VALKYRIE — Swept-Back Crystalline Valkyrie Wings & Boreal Ice Crown */}
      {id === 'frost_valkyrie' && (
        <g>
          {/* Left Crystalline Valkyrie Wing Blades */}
          <polygon points="92,44 34,14 48,28 88,48" fill={sw.bladeHex} opacity="0.88" stroke="#ffffff" strokeWidth="1" />
          <polygon points="90,50 28,34 42,46 88,54" fill={sw.trimHex} opacity="0.85" />
          <polygon points="90,56 38,54 50,64 88,60" fill={sw.whiteHex} opacity="0.82" />
          {/* Right Crystalline Valkyrie Wing Blades */}
          <polygon points="128,44 186,14 172,28 132,48" fill={sw.bladeHex} opacity="0.88" stroke="#ffffff" strokeWidth="1" />
          <polygon points="130,50 192,34 178,46 132,54" fill={sw.trimHex} opacity="0.85" />
          <polygon points="130,56 182,54 170,64 132,60" fill={sw.whiteHex} opacity="0.82" />
          {/* 5-Spire Boreal Ice Crown */}
          <polygon points="96,24 101,10 106,20 110,4 114,20 119,10 124,24" fill={sw.bladeHex} stroke="#ffffff" strokeWidth="1" />
        </g>
      )}

      {/* SKIN #6: SOLAR SERAPHIM — Six-Winged Golden Seraphim & 12-Ray Blazing Sun Astrolabe */}
      {id === 'solar_seraphim' && (
        <g>
          {/* 12-Ray Solar Halo */}
          <circle cx="110" cy="34" r="22" fill="none" stroke={sw.trimHex} strokeWidth="2.5" />
          {/* 6 Golden Seraphim Wings (Upper, Mid, Lower pairs) */}
          <polygon points="92,38 36,8 52,26 90,44" fill={sw.trimHex} stroke="#ffffff" strokeWidth="1" />
          <polygon points="90,48 24,36 44,50 88,54" fill={sw.bladeHex} stroke={sw.trimHex} strokeWidth="1" />
          <polygon points="92,56 42,66 58,74 90,62" fill={sw.trimHex} opacity="0.9" />
          <polygon points="128,38 184,8 168,26 130,44" fill={sw.trimHex} stroke="#ffffff" strokeWidth="1" />
          <polygon points="130,48 196,36 176,50 132,54" fill={sw.bladeHex} stroke={sw.trimHex} strokeWidth="1" />
          <polygon points="128,56 178,66 162,74 130,62" fill={sw.trimHex} opacity="0.9" />
        </g>
      )}

      {/* SKIN #7: ABYSSAL NECROMANCER — Curved Lich Horns, Twin Crossed Soulfire Scythes & Bone Cage */}
      {id === 'abyssal_necromancer' && (
        <g>
          {/* Twin Crossed War-Scythe Shafts & Giant Crescent Reaper Blades */}
          <line x1="78" y1="80" x2="152" y2="14" stroke={sw.whiteHex} strokeWidth="3" />
          <path d="M150,14 Q186,10 194,36 Q170,26 146,22 Z" fill={sw.trailHex} stroke={sw.bladeHex} strokeWidth="1.5" />
          <line x1="142" y1="80" x2="68" y2="14" stroke={sw.whiteHex} strokeWidth="3" />
          <path d="M70,14 Q34,10 26,36 Q50,26 74,22 Z" fill={sw.trailHex} stroke={sw.bladeHex} strokeWidth="1.5" />
          {/* Curved Lich Horns */}
          <path d="M98,24 Q80,14 84,4" fill="none" stroke={sw.trimHex} strokeWidth="3.2" strokeLinecap="round" />
          <path d="M122,24 Q140,14 136,4" fill="none" stroke={sw.trimHex} strokeWidth="3.2" strokeLinecap="round" />
        </g>
      )}

      {/* SKIN #8: ARCANE ARCHMAGE — Triple 360° Gyroscopic Astrolabe & 3 Levitating Amethyst Monoliths */}
      {id === 'arcane_archmage' && (
        <g>
          {/* Triple Tilted Gyroscopic Astrolabe Rings */}
          <ellipse cx="110" cy="48" rx="46" ry="16" fill="none" stroke={sw.trimHex} strokeWidth="2" transform="rotate(-22 110 48)" />
          <ellipse cx="110" cy="48" rx="42" ry="15" fill="none" stroke={sw.bladeHex} strokeWidth="1.8" transform="rotate(26 110 48)" />
          <circle cx="110" cy="48" r="28" fill="none" stroke={sw.trailHex} strokeWidth="1.5" strokeDasharray="4 3" />
          {/* 3 Levitating Amethyst Crystal Obelisk Monoliths */}
          <polygon points="42,24 49,38 42,58 35,38" fill={sw.trimHex} stroke="#ffffff" strokeWidth="1.2" />
          <polygon points="178,24 185,38 178,58 171,38" fill={sw.trimHex} stroke="#ffffff" strokeWidth="1.2" />
          <polygon points="110,3 116,12 110,21 104,12" fill={sw.bladeHex} stroke="#ffffff" strokeWidth="1.2" />
        </g>
      )}

      {/* SKIN #9: INFERNAL DRAKE — Articulated Volcanic Dragon Bat-Wings, Dragon Horns & Magma Spires */}
      {id === 'infernal_drake' && (
        <g>
          {/* Left & Right Articulated Dragon Bat-Wings with Clawed Thumbs */}
          <path d="M92,44 L34,12 L24,42 Q46,36 56,52 Q72,46 90,56 Z" fill={sw.trailHex} opacity="0.88" stroke={sw.trimHex} strokeWidth="1.8" />
          <path d="M128,44 L186,12 L196,42 Q174,36 164,52 Q148,46 130,56 Z" fill={sw.trailHex} opacity="0.88" stroke={sw.trimHex} strokeWidth="1.8" />
          {/* Swept Dragon Horns */}
          <polygon points="98,24 76,4 90,22" fill={sw.bladeHex} />
          <polygon points="122,24 144,4 130,22" fill={sw.bladeHex} />
          {/* Erupting Magma Basalt Spires at Base */}
          <polygon points="56,82 64,56 72,82" fill={sw.trimHex} />
          <polygon points="148,82 156,56 164,82" fill={sw.trimHex} />
        </g>
      )}

      {/* SKIN #10: CELESTIAL ETERNITY — 8-Blade Diamond Prism Wings, Saturnian Rings & 4 Astral Lances */}
      {id === 'celestial_eternity' && (
        <g>
          {/* Dual Saturnian Planetary Rings + Moons */}
          <ellipse cx="110" cy="50" rx="64" ry="15" fill="none" stroke={sw.trimHex} strokeWidth="2.2" transform="rotate(-18 110 50)" />
          <ellipse cx="110" cy="50" rx="58" ry="14" fill="none" stroke="#38bdf8" strokeWidth="1.8" transform="rotate(18 110 50)" />
          {/* 8-Blade Diamond Prism Wings */}
          <polygon points="90,42 30,10 44,24 88,46" fill="#ffffff" stroke={sw.bladeHex} strokeWidth="1.2" />
          <polygon points="88,48 22,32 38,44 88,52" fill={sw.bladeHex} stroke={sw.trimHex} strokeWidth="1" />
          <polygon points="130,42 190,10 176,24 132,46" fill="#ffffff" stroke={sw.bladeHex} strokeWidth="1.2" />
          <polygon points="132,48 198,32 182,44 132,52" fill={sw.bladeHex} stroke={sw.trimHex} strokeWidth="1" />
          {/* Floating Astral Light-Lances */}
          <line x1="42" y1="14" x2="42" y2="74" stroke={sw.trimHex} strokeWidth="2.4" />
          <polygon points="42,6 37,18 47,18" fill="#ffffff" />
          <line x1="178" y1="14" x2="178" y2="74" stroke={sw.trimHex} strokeWidth="2.4" />
          <polygon points="178,6 173,18 183,18" fill="#ffffff" />
        </g>
      )}

      {/* Central Sculpted 3D Chess Sovereign Statue Silhouette (White & Black Dual Split) */}
      <g>
        {/* Pedestal */}
        <path
          d="M84,82 L136,82 L130,72 L90,72 Z"
          fill={`url(#bodyW_${id})`}
          stroke={sw.trimHex}
          strokeWidth="1.5"
        />
        {/* Left Half (White Army Material) */}
        <path
          d="M110,20 L96,28 L100,44 L92,72 L110,72 Z"
          fill={`url(#bodyW_${id})`}
          stroke={sw.trimHex}
          strokeWidth="1.4"
        />
        {/* Right Half (Black Army Material) */}
        <path
          d="M110,20 L124,28 L120,44 L128,72 L110,72 Z"
          fill={`url(#bodyB_${id})`}
          stroke={sw.trimHex}
          strokeWidth="1.4"
        />
        {/* Core Chest Emblem */}
        <polygon
          points="110,36 116,44 110,52 104,44"
          fill={sw.trailHex}
          stroke="#ffffff"
          strokeWidth="1"
        />
      </g>
    </svg>
  );
}

interface PokerChessSyncState {
  fps?: number;
  performancePreset?: 'performance' | 'balanced' | 'ultra';
  currentTurn: 'w' | 'b';
  playerColor: 'w' | 'b';
  turnNumber?: number;
  turnPhase:
    | 'DRAW_PHASE'
    | 'SELECT_CARDS'
    | 'EMPOWER_UNIT'
    | 'ULTIMATE_TARGETING'
    | 'MOVE_UNIT'
    | 'GAME_OVER';
  turnTimeRemaining: number;
  turnTimeLimit: number;
  isTimerLow: boolean;
  isLowTimeTicking?: boolean;
  isAnimatingMove?: boolean;
  isConsideringMove?: boolean;
  lastTimeoutNotice?: TurnTimeoutNoticeUI | null;
  isLoaded?: boolean;
  gameOver: boolean;
  winnerColor: 'w' | 'b' | null;
  defeatedColor: 'w' | 'b' | null;
  whiteKing: UnitUI;
  blackKing: UnitUI;
  friendlyUnits?: UnitUI[];
  poker: {
    ownerColor: 'w' | 'b';
    hasDrawnThisTurn: boolean;
    mana: number;
    maxMana: number;
    coinAvailable: boolean;
    hand: PokerCardUI[];
    selectedIndices: number[];
    isFiveSelected: boolean;
    evaluatedCombo: ComboDefUI | null;
    committedCombo: ComboDefUI | null;
    empoweredUnitPos: { r: number; c: number } | null;
    drawCount: number;
    discardCount: number;
  };
  ultimateTargetSquares: { r: number; c: number }[];
  maxUltimateTargets: number;
  selectedSquare?: { r: number; c: number; algebraic: string } | null;
  validMoves?: {
    r: number;
    c: number;
    algebraic: string;
    capture: boolean;
    castle?: string | null;
  }[];
  inspectedUnit: UnitUI | null;
  hoveredTileModifier?: TileModifierUI | null;
  combatForecast: CombatForecastUI | null;
  unitPathing?: {
    displayMode: 'ALL' | 'TRAJECTORY' | 'HISTORY' | 'OFF';
    subjectUnit: UnitUI | null;
    originSquare: {
      r: number;
      c: number;
      algebraic: string;
      turn: number;
      kind: string;
    } | null;
    pathHistory: {
      r: number;
      c: number;
      fromR?: number;
      fromC?: number;
      targetR?: number;
      targetC?: number;
      targetAlgebraic?: string;
      algebraic: string;
      turn: number;
      kind: 'SPAWN' | 'MOVE' | 'CAPTURE' | 'CASTLE' | 'CLASH_REPEL';
    }[];
    intendedTrajectory: {
      fromR: number;
      fromC: number;
      fromAlgebraic: string;
      toR: number;
      toC: number;
      toAlgebraic: string;
      isCapture: boolean;
      isCastle: boolean;
      castleSide?: string | null;
      isKnightJump: boolean;
      isHoveredTarget: boolean;
      distance: number;
      waypoints: {
        r: number;
        c: number;
        algebraic: string;
        isIntermediate?: boolean;
        isCorner?: boolean;
        isDestination?: boolean;
      }[];
    } | null;
  };
  combatLogs: string[];
  capturedByWhite: number;
  capturedByBlack: number;
  bgmPlaying?: boolean;
  sfxMuted?: boolean;
  autoMoveEnabled?: boolean;
  activeCombatBanner?: ActiveCombatBannerUI | null;
  tacticalPingMode?: boolean;
  selectedPingIntent?: string;
  activeTacticalPings?: {
    id: string;
    r: number;
    c: number;
    algebraic: string;
    intent: string;
    label: string;
    shortLabel?: string;
    icon: string;
    colorHex: string;
    unitDesc?: string;
    remainingSec: number;
  }[];
  commercial?: {
    elo: number;
    peakElo: number;
    gold: number;
    wins: number;
    losses: number;
    winStreak: number;
    totalKills: number;
    ownedSkinIds: string[];
    equippedSkinId: string;
    previewSkinId?: string | null;
    lastMatchDelta?: {
      id: string;
      won: boolean;
      eloBefore: number;
      eloAfter: number;
      eloDelta: number;
      goldReward: number;
      tierNameVi: string;
      tierIcon: string;
      turnCount: number;
      timestamp: number;
    } | null;
    matchHistory?: {
      id: string;
      won: boolean;
      eloBefore: number;
      eloAfter: number;
      eloDelta: number;
      goldReward: number;
      tierNameVi: string;
      tierIcon: string;
      turnCount: number;
      timestamp: number;
    }[];
    rankInfo?: ReturnType<typeof getEloRankInfo>;
    peakRankInfo?: ReturnType<typeof getEloRankInfo>;
    botDifficulty?: {
      level: number;
      tierId: string;
      nameVi: string;
      badgeVi: string;
      descVi: string;
      colorHex: string;
      bonusHp: number;
      bonusAtk: number;
      bonusArmor: number;
    };
  };
  hapticTriggerCount?: number;
  lastHapticVibration?: {
    triggered: boolean;
    supported: boolean;
    pattern: number[];
    stage: string;
    isKill: boolean;
    attackerType?: string | null;
    defenderType?: string | null;
    timestamp: number;
  } | null;
}

type WizardChessWindow = {
  wizardChess?: {
    toggleUI?: (force?: boolean) => void;
    toggleAutoMove?: (force?: boolean) => boolean;
    restartGame?: () => void;
    startSinglePlayerMatch?: (side?: 'w' | 'b', botLevel?: number) => boolean;
    startMultiplayerMatch?: (matchData: any) => boolean;
    setBotDifficultyLevel?: (lvl: number) => number;
    setPlayerColor?: (color: 'w' | 'b') => void;
    drawTurnCards?: () => boolean;
    useManaCoin?: () => boolean;
    endPlayerTurnNow?: () => boolean;
    toggleCardSelectionIndex?: (idx: number) => void;
    autoSelectBest5Cards?: () => void;
    commitSelected5CardCombo?: () => void;
    empowerFriendlyUnitAt?: (r: number, c: number) => void;
    confirmFourKingsUltimate?: () => void;
    skipEmpowerPhase?: () => void;
    triggerPresetHand?: (presetKey: string) => void;
    handleTurnTimeout?: () => void;
    triggerCombatHapticFeedback?: (options?: Record<string, unknown>) => unknown;
    triggerUnitMeleeAttack?: (r?: number, c?: number, options?: Record<string, unknown>) => boolean;
    triggerUnitMeleeDefend?: (r?: number, c?: number, options?: Record<string, unknown>) => boolean;
    buyAndEquipChessSkin?: (skinId: string) => {
      ok: boolean;
      action?: string;
      reason?: string;
      message?: string;
    };
    equipChessSkin?: (skinId: string) => {
      ok: boolean;
      action?: string;
      reason?: string;
      message?: string;
    };
    previewChessSkin3D?: (skinId: string | null) => {
      ok: boolean;
      previewSkinId?: string | null;
    };
    claimRankedBountyOrSimulateMatch?: (mode?: 'ranked_win' | 'daily_gold') => {
      ok: boolean;
      goldAdded?: number;
      matchRecord?: {
        eloDelta: number;
        eloAfter: number;
        goldReward: number;
        tierNameVi: string;
      };
    };
    setInspectedUnitHpPercent?: (pct: number, r?: number, c?: number) => boolean;
    toggleBattleMusic?: () => boolean;
    nextBattleTrack?: () => unknown;
    getCurrentTrackInfo?: () => unknown;
    toggleSoundMute?: () => boolean;
    playUIHover?: () => void;
    playUIClick?: () => void;
    triggerEpicCombatShowcase?: () => boolean;
    selectSquareForMovePreview?: (r: number, c: number) => unknown;
    executeSelectedMoveTo?: (toR: number, toC: number) => boolean;
    pingSquare?: (r: number, c: number, intent?: string) => unknown;
    removeTacticalPingAt?: (r: number, c: number) => boolean;
    clearTacticalPings?: () => void;
    toggleTacticalPingMode?: (forceState?: boolean | null) => boolean;
    setTacticalPingIntent?: (intentId: string) => string;
    getTacticalPings?: () => unknown[];
    setTurnTimeRemaining?: (sec: number) => number;
    getPokerChessUIState?: () => PokerChessSyncState;
    getTutorial3DTargetScreenPos?: () => {
      stepType: 'EMPOWER_3D_UNIT' | 'SELECT_3D_UNIT' | 'CLICK_3D_DEST';
      x: number;
      y: number;
      r: number;
      c: number;
      fromR?: number;
      fromC?: number;
      algebraic: string;
      fromAlgebraic?: string;
      unitNameVi?: string;
      unitIcon?: string;
      isCapture?: boolean;
    } | null;
    triggerTutorialStepAction?: () => boolean;
    cyclePerformancePreset?: () => string;
    setPerformancePreset?: (preset: 'performance' | 'balanced' | 'ultra') => void;
    getPerformancePreset?: () => string;
    cyclePathingDisplayMode?: () => 'ALL' | 'TRAJECTORY' | 'HISTORY' | 'OFF';
    setPathingDisplayMode?: (
      mode: 'ALL' | 'TRAJECTORY' | 'HISTORY' | 'OFF'
    ) => 'ALL' | 'TRAJECTORY' | 'HISTORY' | 'OFF';
    getPathingDisplayMode?: () => 'ALL' | 'TRAJECTORY' | 'HISTORY' | 'OFF';
    getFPS?: () => number;
  };
};

type HandsOnTargetSpot = {
  kind: 'dom' | 'board3d';
  stepBadge: string;
  actionText: string;
  subHint?: string;
  rect?: { left: number; top: number; width: number; height: number };
  point?: { x: number; y: number };
  isCapture?: boolean;
};

type PhaseAnnouncementUI = {
  id: string;
  category: 'turn' | 'draw' | 'buff' | 'move' | 'combat';
  badge: string;
  title: string;
  subtitle: string;
};

export default function App() {
  const initializedRef = useRef(false);
  const lastShownTimeoutIdRef = useRef<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevFlowRef = useRef<{
    turn: 'w' | 'b';
    phase: string;
    hadCombat: boolean;
  } | null>(null);

  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [mainMenuOpen, setMainMenuOpen] = useState(false);
  const [onlineModalOpen, setOnlineModalOpen] = useState(false);
  const [isSearchingMatch, setIsSearchingMatch] = useState(false);
  const [searchQueueSeconds, setSearchQueueSeconds] = useState(0);
  const [matchFoundInfo, setMatchFoundInfo] = useState<any | null>(null);
  const [customRoomInput, setCustomRoomInput] = useState('');
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null);
  const [spSide, setSpSide] = useState<'w' | 'b'>('w');
  const [spBotLevel, setSpBotLevel] = useState<number>(1);
  const [serverStats, setServerStats] = useState({ onlinePlayers: 1, activeMatches: 0, queuedPlayers: 0 });
  const [isPortrait, setIsPortrait] = useState<boolean>(() => {
    return typeof window !== 'undefined' && window.innerHeight > window.innerWidth && window.innerWidth <= 850;
  });
  const [dismissPortraitPrompt, setDismissPortraitPrompt] = useState(false);
  const initialMenuShownRef = useRef(false);
  const [pokerDockMinimized, setPokerDockMinimized] = useState(false);
  const [peekDockDuringMove, setPeekDockDuringMove] = useState(false);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [handsOnActive, setHandsOnActive] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pokerchess_hands_on_publish_v2') !== 'true';
    } catch {
      return true;
    }
  });
  const [handsOnSpot, setHandsOnSpot] = useState<HandsOnTargetSpot | null>(null);
  const [skinStoreOpen, setSkinStoreOpen] = useState(false);
  const [storeTab, setStoreTab] = useState<'skins' | 'elo'>('skins');
  const [skinFilter, setSkinFilter] = useState<'all' | 'gold' | 'elo' | 'owned'>('all');
  const [storeFeedback, setStoreFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [gameState, setGameState] = useState<PokerChessSyncState | null>(null);
  const [timeoutToast, setTimeoutToast] = useState<TurnTimeoutNoticeUI | null>(null);
  const [phaseAnnouncement, setPhaseAnnouncement] = useState<PhaseAnnouncementUI | null>(null);

  // PWA Add to Home Screen (A2HS) states
  const deferredPromptRef = useRef<any>(null);
  const [showA2HSModal, setShowA2HSModal] = useState<boolean>(false);
  const [isA2HSSupported, setIsA2HSSupported] = useState<boolean>(false);
  const [isInstalledApp, setIsInstalledApp] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true;
  });
  const isIOSDevice = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const [opponentDisconnectNotice, setOpponentDisconnectNotice] = useState<{
    opponentName: string;
    secondsLeft: number;
  } | null>(null);

  const finishHandsOnTutorial = () => {
    try {
      localStorage.setItem('pokerchess_hands_on_publish_v2', 'true');
    } catch {
      // ignore storage errors
    }
    setHandsOnActive(false);
    setHandsOnSpot(null);
  };

  useEffect(() => {
    const triggerToast = (notice: TurnTimeoutNoticeUI) => {
      if (!notice || notice.id === lastShownTimeoutIdRef.current) return;
      lastShownTimeoutIdRef.current = notice.id;
      setTimeoutToast(notice);
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = setTimeout(() => {
        setTimeoutToast((curr) => (curr?.id === notice.id ? null : curr));
      }, 4200);
    };

    const onSync = (e: Event) => {
      const customEv = e as CustomEvent<PokerChessSyncState>;
      if (customEv.detail) {
        setGameState({ ...customEv.detail });
        if (customEv.detail.lastTimeoutNotice) {
          triggerToast(customEv.detail.lastTimeoutNotice);
        } else if (customEv.detail.lastTimeoutNotice === null) {
          lastShownTimeoutIdRef.current = null;
          setTimeoutToast(null);
        }
      }
    };

    const onTimeoutEv = (e: Event) => {
      const customEv = e as CustomEvent<TurnTimeoutNoticeUI>;
      if (customEv.detail) {
        triggerToast(customEv.detail);
      }
    };

    window.addEventListener('pokerchess-sync', onSync);
    window.addEventListener('pokerchess-timeout', onTimeoutEv);

    if (!initializedRef.current) {
      initializedRef.current = true;
      initWizardChess();
    }

    const pollInitial = setTimeout(() => {
      const win = window as unknown as WizardChessWindow;
      if (win.wizardChess?.getPokerChessUIState) {
        setGameState(win.wizardChess.getPokerChessUIState());
      }
    }, 350);

    return () => {
      window.removeEventListener('pokerchess-sync', onSync);
      window.removeEventListener('pokerchess-timeout', onTimeoutEv);
      clearTimeout(pollInitial);
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Check and trigger A2HS (Add to Home Screen) immediately on first visit
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         (window.navigator as any).standalone === true;
    setIsInstalledApp(isStandalone);
    if (isStandalone) return;

    const hasDismissed = localStorage.getItem('pokerchess_a2hs_dismissed_v1');
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setIsA2HSSupported(true);

      // Force prompt on first browser visit
      if (!hasDismissed) {
        setShowA2HSModal(true);
        try {
          e.prompt().catch(() => {});
        } catch {
          // Handled via user tap
        }
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If mobile device, ensure A2HS prompt/modal is displayed immediately on first open
    if (isMobile && !hasDismissed) {
      const timer = setTimeout(() => {
        setShowA2HSModal(true);
      }, 1000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallAppClick = async () => {
    if (deferredPromptRef.current) {
      try {
        await deferredPromptRef.current.prompt();
        const choice = await deferredPromptRef.current.userChoice;
        if (choice?.outcome === 'accepted') {
          setShowA2HSModal(false);
          localStorage.setItem('pokerchess_a2hs_dismissed_v1', 'true');
        }
      } catch (err) {
        console.warn('Install prompt error:', err);
      }
    } else {
      alert('Để cài đặt: Nhấn vào biểu tượng 3 chấm ⋮ (góc trên trình duyệt) ➔ Chọn "Cài đặt ứng dụng" hoặc "Thêm vào màn hình chính".');
    }
  };

  const handleDismissA2HS = () => {
    setShowA2HSModal(false);
    localStorage.setItem('pokerchess_a2hs_dismissed_v1', 'true');
  };

  // Realtime 1vs1 Multiplayer WebSocket Connection & Lifecycle
  useEffect(() => {
    multiplayerClient.connect();

    const onStats = (stats: any) => {
      if (stats) setServerStats(stats);
    };
    const onMatchFound = (match: any) => {
      setIsSearchingMatch(false);
      setMatchFoundInfo(match);
      setTimeout(() => {
        getEngine()?.startMultiplayerMatch?.(match);
        setMatchFoundInfo(null);
        setOnlineModalOpen(false);
        setMainMenuOpen(false);
      }, 2400);
    };
    const onQueueStatus = (status: any) => {
      setIsSearchingMatch(Boolean(status?.isQueued));
    };
    const onRoomCreated = (msg: any) => {
      setCreatedRoomCode(msg.roomCode);
    };
    const onOpponentDisconnected = (data: any) => {
      setOpponentDisconnectNotice({
        opponentName: data?.opponentName || 'Đối thủ',
        secondsLeft: data?.reconnectWindowSec || 20
      });
    };
    const onOpponentReconnected = () => {
      setOpponentDisconnectNotice(null);
    };
    const onMatchEnded = () => {
      setOpponentDisconnectNotice(null);
    };

    multiplayerClient.on('stats', onStats);
    multiplayerClient.on('match_found', onMatchFound);
    multiplayerClient.on('queue_status', onQueueStatus);
    multiplayerClient.on('room_created', onRoomCreated);
    multiplayerClient.on('opponent_disconnected', onOpponentDisconnected);
    multiplayerClient.on('opponent_reconnected', onOpponentReconnected);
    multiplayerClient.on('match_ended', onMatchEnded);

    return () => {
      multiplayerClient.off('stats', onStats);
      multiplayerClient.off('match_found', onMatchFound);
      multiplayerClient.off('queue_status', onQueueStatus);
      multiplayerClient.off('room_created', onRoomCreated);
      multiplayerClient.off('opponent_disconnected', onOpponentDisconnected);
      multiplayerClient.off('opponent_reconnected', onOpponentReconnected);
      multiplayerClient.off('match_ended', onMatchEnded);
    };
  }, []);

  // Opponent Disconnect Countdown ticker
  useEffect(() => {
    if (!opponentDisconnectNotice || opponentDisconnectNotice.secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setOpponentDisconnectNotice((prev) => {
        if (!prev || prev.secondsLeft <= 1) return null;
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [opponentDisconnectNotice]);

  // Matchmaking search duration counter
  useEffect(() => {
    if (!isSearchingMatch) {
      setSearchQueueSeconds(0);
      return;
    }
    const iv = setInterval(() => {
      setSearchQueueSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(iv);
  }, [isSearchingMatch]);

  // Auto-launch Main Menu on initial game load so players select their mode, skin or Elo first
  useEffect(() => {
    if (gameState?.isLoaded && !initialMenuShownRef.current) {
      initialMenuShownRef.current = true;
      setMainMenuOpen(true);
    }
  }, [gameState?.isLoaded]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileSheetOpen(false);
        setRulesModalOpen(false);
        setSkinStoreOpen(false);
        setMainMenuOpen(false);
        setOnlineModalOpen(false);
      }
    };
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setMobileSheetOpen(false);
      }
      setIsPortrait(window.innerHeight > window.innerWidth && window.innerWidth <= 850);
    };
    const handleOrientationChange = () => {
      setTimeout(() => {
        setIsPortrait(window.innerHeight > window.innerWidth && window.innerWidth <= 850);
      }, 150);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  const requestLandscapeLock = async () => {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen().catch(() => {});
      }
      if (screen.orientation && 'lock' in screen.orientation) {
        await (screen.orientation as any).lock('landscape').catch(() => {});
      } else if ((screen as any).lockOrientation) {
        (screen as any).lockOrientation('landscape');
      }
    } catch {
      // User or browser may prevent orientation locking
    }
  };

  const getEngine = () => (window as unknown as WizardChessWindow).wizardChess;

  const handleRestoreUI = () => {
    const eng = getEngine();
    if (eng?.toggleUI) {
      eng.toggleUI(false);
    } else {
      document.body.classList.remove('cinematic-ui-hidden');
      const btnHide = document.getElementById('btn-hide-ui');
      if (btnHide) btnHide.textContent = 'Hide UI [H]';
    }
  };

  const wKing = gameState?.whiteKing;
  const bKing = gameState?.blackKing;
  const poker = gameState?.poker;
  const turnPhase = gameState?.turnPhase || 'DRAW_PHASE';
  const currentTurnColor = gameState?.currentTurn || 'w';
  const isPlayerTurn = !gameState || gameState.currentTurn === gameState.playerColor;
  const isConsideringMove = gameState
    ? Boolean(gameState.isConsideringMove ?? (!gameState.gameOver && !gameState.isAnimatingMove))
    : true;
  const turnSeconds = gameState?.turnTimeRemaining ?? 30;
  const turnLimit = gameState?.turnTimeLimit ?? 30;
  const isTimerLow = Boolean(gameState?.isTimerLow || (!gameState?.gameOver && turnSeconds < 8));
  const timerPct = Math.max(0, Math.min(100, (turnSeconds / Math.max(1, turnLimit)) * 100));
  const forecast = gameState?.combatForecast || null;
  const friendlyUnits = gameState?.friendlyUnits || [];
  const empoweredUnit =
    poker?.empoweredUnitPos && friendlyUnits.length > 0
      ? friendlyUnits.find(
          (u) => u.r === poker.empoweredUnitPos?.r && u.c === poker.empoweredUnitPos?.c
        ) || null
      : null;

  // Keep the dock visible during DRAW_PHASE, SELECT_CARDS, EMPOWER_UNIT (compact unit-chip selector bar),
  // and ULTIMATE_TARGETING, then tuck it away during Step 4 (MOVE_UNIT) & active combat so the 3D board is 100% clear.
  const isCardPhase =
    isPlayerTurn &&
    !gameState?.autoMoveEnabled &&
    (turnPhase === 'DRAW_PHASE' ||
      turnPhase === 'SELECT_CARDS' ||
      turnPhase === 'EMPOWER_UNIT' ||
      turnPhase === 'ULTIMATE_TARGETING') &&
    !gameState?.activeCombatBanner &&
    !gameState?.isAnimatingMove;

  const isCardDockVisible = Boolean(
    poker &&
      !gameState?.gameOver &&
      !mainMenuOpen &&
      (!gameState?.autoMoveEnabled || peekDockDuringMove) &&
      (isCardPhase || (isPlayerTurn && peekDockDuringMove && !gameState?.activeCombatBanner))
  );

  // Trigger Turn, Card-Draw, Buff, and Combat notifications whenever game flow transitions
  useEffect(() => {
    if (!gameState) return;
    const currTurn = gameState.currentTurn;
    const currPhase = gameState.turnPhase;
    const currCombat = Boolean(gameState.activeCombatBanner);
    const isPlayer = currTurn === gameState.playerColor;

    const showAnnouncement = (ann: Omit<PhaseAnnouncementUI, 'id'>, durationMs = 2700) => {
      const nextAnn: PhaseAnnouncementUI = {
        ...ann,
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      };
      setPhaseAnnouncement(nextAnn);
      if (phaseBannerTimerRef.current) {
        clearTimeout(phaseBannerTimerRef.current);
      }
      phaseBannerTimerRef.current = setTimeout(() => {
        setPhaseAnnouncement((curr) => (curr?.id === nextAnn.id ? null : curr));
      }, durationMs);
    };

    const prev = prevFlowRef.current;
    if (!prev) {
      prevFlowRef.current = { turn: currTurn, phase: currPhase, hadCombat: currCombat };
      showAnnouncement({
        category: 'turn',
        badge: '👑 BẮT ĐẦU TRẬN ĐẤU • LƯỢT 1',
        title: isPlayer ? 'LƯỢT CỦA BẠN — BƯỚC 1: BỐC BÀI' : 'LƯỢT ĐỐI THỦ — ĐANG HÀNH ĐỘNG',
        subtitle: isPlayer
          ? 'Hãy bốc 5 lá bài phép thuật ở khay dưới để mở đầu lượt đấu!'
          : 'Quan sát đối thủ rút bài và điều quân.'
      });
      return;
    }

    // Reset manual peek whenever phase or turn changes
    if (prev.turn !== currTurn || prev.phase !== currPhase || currCombat) {
      setPeekDockDuringMove(false);
    }

    // 2. Combat just finished
    if (prev.hadCombat && !currCombat) {
      if (isPlayer && currPhase === 'DRAW_PHASE') {
        showAnnouncement({
          category: 'turn',
          badge: '✦ COMBAT XONG • LƯỢT CỦA BẠN',
          title: `LƯỢT MỚI (${currTurn === 'w' ? 'QUÂN TRẮNG' : 'QUÂN ĐEN'}) — MỞ KHAY BỐC BÀI`,
          subtitle: 'Giao tranh đã kết thúc! Khay bốc bài đã hiện lại — Hãy rút 5 lá bài mới.'
        });
      } else {
        showAnnouncement({
          category: 'combat',
          badge: '✦ KẾT THÚC COMBAT',
          title: isPlayer ? 'COMBAT HOÀN TẤT — ĐẾN LƯỢT BẠN' : 'COMBAT HOÀN TẤT — LƯỢT ĐỐI THỦ',
          subtitle: isPlayer
            ? 'Khay bốc bài đã mở lại cho lượt mới!'
            : 'Khay bài tạm ẩn trong khi đối thủ hành động.'
        });
      }
    }
    // 3. Turn switched between White and Black (without active combat banner change)
    else if (prev.turn !== currTurn) {
      // If the player just finished their guided Hands-On turn, celebrate and auto-complete!
      if (!isPlayer && handsOnActive) {
        finishHandsOnTutorial();
        showAnnouncement(
          {
            category: 'move',
            badge: '🎉 HOÀN THÀNH CẦM TAY CHỈ VIỆC!',
            title: 'BẠN ĐÃ NẮM VỮNG CÁCH CHƠI — ĐẾN LƯỢT AI!',
            subtitle: 'Hạ quân địch thưởng +25~150🪙 Vàng • Đánh sập Vua địch thưởng +36 Elo!'
          },
          4200
        );
      } else if (isPlayer) {
        showAnnouncement({
          category: 'turn',
          badge: '👑 THÔNG BÁO LƯỢT MỚI',
          title: `LƯỢT CỦA BẠN (${currTurn === 'w' ? 'QUÂN TRẮNG' : 'QUÂN ĐEN'}) — BỐC BÀI`,
          subtitle: 'Khay bốc bài đã tự động hiện lại! Hãy bốc 5 lá bài phép thuật.'
        });
      } else {
        showAnnouncement({
          category: 'turn',
          badge: '⏳ THÔNG BÁO ĐỔI LƯỢT',
          title: `LƯỢT ĐỐI THỦ (${currTurn === 'w' ? 'QUÂN TRẮNG' : 'QUÂN ĐEN'})`,
          subtitle: 'Khay bài tự ẩn để bạn quan sát đối thủ bốc bài, gắn Buff & đi quân.'
        });
      }
    }
    // 4. Player progressed to a new step within their turn
    else if (isPlayer && prev.phase !== currPhase) {
      if (currPhase === 'SELECT_CARDS') {
        showAnnouncement({
          category: 'draw',
          badge: '🃏 THÔNG BÁO BỐC BÀI',
          title: 'ĐÃ BỐC ĐỦ 7 LÁ BÀI PHÉP',
          subtitle: 'Hãy chọn 5 lá bài hợp thành bộ Poker mạnh nhất rồi nhấn Kích Hoạt Phép.'
        });
      } else if (currPhase === 'EMPOWER_UNIT') {
        const comboName = gameState.poker?.committedCombo?.nameVi || 'Phép Bài';
        const atkB = gameState.poker?.committedCombo?.atkBonus ?? 0;
        const armB = gameState.poker?.committedCombo?.armorBonus ?? 0;
        showAnnouncement({
          category: 'buff',
          badge: '✨ ĐÃ CHỐT BÀI • ẨN KHAY BÀI',
          title: `KÍCH HOẠT: ${comboName.toUpperCase()} (+${atkB}⚔${armB > 0 ? ` · +${armB}🛡` : ''})`,
          subtitle: 'Khay bài đã tự ẩn! Chọn 1 quân đồng minh trên bàn 3D để truyền Buff.'
        });
      } else if (currPhase === 'ULTIMATE_TARGETING') {
        showAnnouncement({
          category: 'buff',
          badge: '⚡ THÔNG BÁO THIÊN PHẠT',
          title: 'ĐÃ CHỐT TỨ QUÝ — TỰ ĐỘNG ẨN KHAY BÀI',
          subtitle: 'Chọn tối đa 8 quân địch trên bàn cờ 3D để giáng Thiên Phạt!'
        });
      } else if (currPhase === 'MOVE_UNIT') {
        const empPos = gameState.poker?.empoweredUnitPos;
        const empU =
          empPos && gameState.friendlyUnits
            ? gameState.friendlyUnits.find((u) => u.r === empPos.r && u.c === empPos.c)
            : null;
        showAnnouncement({
          category: 'move',
          badge: '🛡 ĐÃ GẮN BUFF • ĐI QUÂN & COMBAT',
          title: empU
            ? `ĐÃ BUFF ${empU.icon} ${empU.nameVi.toUpperCase()} (${empU.algebraic.toUpperCase()}) — HÃY ĐI QUÂN!`
            : 'ĐÃ CHỐT BUFF — MỞ KHÓA BÀN CỜ 3D!',
          subtitle: 'Chọn quân đồng minh trên bàn 3D để di chuyển & Combat.'
        });
      }
    }

    prevFlowRef.current = { turn: currTurn, phase: currPhase, hadCombat: currCombat };
  }, [gameState, handsOnActive]);

  // Real-time Hands-On Spotlight & 3D Board Pointer tracker ("Cầm Tay Chỉ Việc")
  useEffect(() => {
    if (!handsOnActive || !gameState?.isLoaded || gameState?.gameOver || skinStoreOpen || rulesModalOpen || mainMenuOpen || onlineModalOpen) {
      setHandsOnSpot(null);
      return;
    }

    if (pokerDockMinimized && (turnPhase === 'DRAW_PHASE' || turnPhase === 'SELECT_CARDS')) {
      setPokerDockMinimized(false);
    }

    const computeSpotlight = () => {
      if (!isPlayerTurn || gameState?.isAnimatingMove) {
        setHandsOnSpot(null);
        return;
      }

      // STEP 1: Point directly at "🃏 Bốc 5 Lá Bài Mới" button
      if (turnPhase === 'DRAW_PHASE') {
        const el = document.getElementById('btn-tutorial-draw-cards');
        if (el) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            setHandsOnSpot({
              kind: 'dom',
              stepBadge: 'BƯỚC 1 / 4',
              actionText: 'Bấm vào đây để rút 5 lá bài!',
              rect: { left: r.left, top: r.top, width: r.width, height: r.height }
            });
            return;
          }
        }
      }

      // STEP 2: Point at "Tự chọn 5 lá" first, then "🔥 Kích Hoạt Phép" once 5 cards are selected
      if (turnPhase === 'SELECT_CARDS') {
        if (!poker?.isFiveSelected) {
          const el = document.getElementById('btn-tutorial-autoselect-5');
          if (el) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
              setHandsOnSpot({
                kind: 'dom',
                stepBadge: 'BƯỚC 2 / 4',
                actionText: 'Bấm đây tự ghép 5 lá bài mạnh nhất!',
                rect: { left: r.left, top: r.top, width: r.width, height: r.height }
              });
              return;
            }
          }
        } else {
          const el = document.getElementById('btn-tutorial-commit-combo');
          if (el) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
              setHandsOnSpot({
                kind: 'dom',
                stepBadge: 'BƯỚC 2 / 4',
                actionText: `Bấm Kích Hoạt Phép (${poker.evaluatedCombo?.nameVi || 'Poker'})!`,
                rect: { left: r.left, top: r.top, width: r.width, height: r.height }
              });
              return;
            }
          }
        }
      }

      // STEP 3 (ULTIMATE): Point at "⚡ Giáng Thiên Phạt"
      if (turnPhase === 'ULTIMATE_TARGETING') {
        const el =
          document.getElementById('btn-tutorial-ultimate-confirm') ||
          document.querySelector('.director-action-btn.ultimate');
        if (el) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            setHandsOnSpot({
              kind: 'dom',
              stepBadge: 'BƯỚC 3 / 4',
              actionText: 'Bấm đây để Giáng Thiên Phạt!',
              rect: { left: r.left, top: r.top, width: r.width, height: r.height }
            });
            return;
          }
        }
      }

      // STEP 3 & STEP 4: Point directly at the 3D chess piece or 3D destination square on the board!
      const boardTarget = getEngine()?.getTutorial3DTargetScreenPos?.();
      if (boardTarget) {
        if (boardTarget.stepType === 'EMPOWER_3D_UNIT') {
          setHandsOnSpot({
            kind: 'board3d',
            stepBadge: 'BƯỚC 3 / 4',
            actionText: `Bấm vào ${boardTarget.unitIcon} ${boardTarget.unitNameVi} (${boardTarget.algebraic.toUpperCase()}) để gắn Buff!`,
            subHint: '+Công ⚔ & +Giáp 🛡 cho quân này',
            point: { x: boardTarget.x, y: boardTarget.y }
          });
          return;
        }
        if (boardTarget.stepType === 'SELECT_3D_UNIT') {
          setHandsOnSpot({
            kind: 'board3d',
            stepBadge: 'BƯỚC 4 / 4',
            actionText: `Bấm chọn ${boardTarget.unitIcon} ${boardTarget.unitNameVi} (${boardTarget.algebraic.toUpperCase()}) trên bàn 3D!`,
            subHint: 'Để hiện các ô di chuyển & tấn công',
            point: { x: boardTarget.x, y: boardTarget.y }
          });
          return;
        }
        if (boardTarget.stepType === 'CLICK_3D_DEST') {
          setHandsOnSpot({
            kind: 'board3d',
            stepBadge: 'BƯỚC 4 / 4',
            actionText: boardTarget.isCapture
              ? `Bấm vào ô ĐỎ ${boardTarget.algebraic.toUpperCase()} để CHÉM ĐỊCH ⚔!`
              : `Bấm vào ô XANH ${boardTarget.algebraic.toUpperCase()} để TIẾN QUÂN ♟!`,
            subHint: `${boardTarget.unitIcon} ${boardTarget.unitNameVi} ${(boardTarget.fromAlgebraic || '').toUpperCase()} ➔ ${boardTarget.algebraic.toUpperCase()}`,
            point: { x: boardTarget.x, y: boardTarget.y },
            isCapture: boardTarget.isCapture
          });
          return;
        }
      }

      setHandsOnSpot(null);
    };

    computeSpotlight();
    const timer = setInterval(computeSpotlight, 90);
    window.addEventListener('resize', computeSpotlight);
    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', computeSpotlight);
    };
  }, [
    handsOnActive,
    gameState,
    turnPhase,
    isPlayerTurn,
    poker,
    pokerDockMinimized,
    skinStoreOpen,
    rulesModalOpen,
    mainMenuOpen,
    onlineModalOpen
  ]);

  const outcomeMeta: Record<
    CombatForecastUI['outcome'],
    { label: string; sub: string; colorClass: string }
  > = {
    BREAKTHROUGH: {
      label: '⚔ ĐỘT PHÁ — CHIẾM Ô',
      sub: 'Tiêu diệt mục tiêu và tiến vào chiếm ô',
      colorClass: 'outcome-breakthrough'
    },
    CLASH_REPEL: {
      label: '🛡 GIẰNG CO — DỘI NGƯỢC VỀ Ô CŨ',
      sub: 'Cả hai cùng sống sót • Quân tấn công lùi về vị trí xuất phát',
      colorClass: 'outcome-clash'
    },
    COUNTER_KILL: {
      label: '💀 PHẢN SÁT — QUÂN TA TỬ TRẬN',
      sub: 'Mục tiêu sống sót và phản đòn hạ gục quân tấn công',
      colorClass: 'outcome-counter'
    },
    MUTUAL_DESTRUCTION: {
      label: '💥 ĐỒNG QUY VU TẬN',
      sub: 'Cả hai quân cùng vỡ vụn trên chiến trường',
      colorClass: 'outcome-mutual'
    }
  };

  return (
    <>
      <div id="loading-overlay">
        <div className="loader-title">Vương Quyền • Hearthstone Chess</div>
        <div className="loader-bar-wrap">
          <div className="loader-bar" id="loader-bar"></div>
        </div>
        <div id="loader-text">Summoning Sanctum Architecture &amp; Sculpted Pieces...</div>
      </div>

      <div id="canvas-container"></div>

      <button
        type="button"
        className="hud-btn mobile-only-restore-ui"
        id="btn-mobile-show-ui"
        onClick={handleRestoreUI}
        title="Show HUD Controls"
      >
        Show UI
      </button>

      {/* OPPONENT DISCONNECTION BANNER & RECONNECTION COUNTDOWN */}
      {opponentDisconnectNotice && (
        <div className="opponent-disconnect-alert" role="alert">
          <span className="alert-pulse-icon">⚠</span>
          <div className="alert-content">
            <div className="alert-title">
              ĐỐI THỦ MẤT KẾT NỐI: <strong>{opponentDisconnectNotice.opponentName}</strong>
            </div>
            <div className="alert-desc">
              Đang chờ kết nối lại... còn{' '}
              <span className="alert-countdown">{opponentDisconnectNotice.secondsLeft}s</span>
              {' '}— Nếu hết giờ, bạn sẽ tự động giành chiến thắng xử thua (+Elo, +Vàng)!
            </div>
          </div>
        </div>
      )}

      {/* SINGLE-ROW NON-WRAPPING TOP BAR + POPOVER MENU */}
      <div id="hud-top">
        <div className="hud-group" id="hud-left">
          <div className="brand-pill">
            <span className="brand-title">♔ Vương Quyền</span>
          </div>

          <div
            className={[
              'status-pill',
              isConsideringMove
                ? 'turn-pulse'
                : gameState?.isAnimatingMove
                  ? 'move-executing'
                  : 'game-ended',
              currentTurnColor === 'b' ? 'black-turn' : 'white-turn',
              isPlayerTurn ? 'player-considering' : 'opponent-considering',
              isTimerLow && isConsideringMove ? 'urgent-pulse' : ''
            ]
              .filter(Boolean)
              .join(' ')}
            id="status-pill"
          >
            <span
              className={`turn-dot${currentTurnColor === 'b' ? ' black' : ''}${isConsideringMove ? ' pulsing' : ''}`}
              id="turn-dot"
            ></span>
            <span id="turn-text">White to Move</span>
            <span className="mode-badge" id="mode-badge">Playing as White</span>
          </div>

          {/* Compact Single-Line 30s Turn Timer */}
          <div
            className={`turn-timer-pill ${isTimerLow ? 'low-time-pulse' : ''}`}
            id="turn-timer-pill"
            role="timer"
            aria-live="off"
            title="Thời gian suy nghĩ mỗi lượt (30 giây). Tự động kết thúc lượt khi về 0s."
          >
            <span className="timer-icon" aria-hidden="true">
              {isTimerLow ? '⚠' : '⏳'}
            </span>
            <span className="timer-digits" id="turn-timer-digits">
              {String(Math.floor(turnSeconds / 60)).padStart(2, '0')}:
              {String(turnSeconds % 60).padStart(2, '0')}
            </span>
          </div>

          {/* Compact Royal King Vitality Strip (Smooth Sliding HP + Hearthstone ATK/HP/Armor Orbs) */}
          {wKing && bKing && (() => {
            const wHpPct = Math.max(0, Math.min(100, (wKing.hp / Math.max(1, wKing.maxHp)) * 100));
            const bHpPct = Math.max(0, Math.min(100, (bKing.hp / Math.max(1, bKing.maxHp)) * 100));
            return (
              <div className="king-vitality-strip">
                <div className="king-hp-chip white-king">
                  <span className="king-chip-crown" title="Vua Trắng">♔</span>
                  <span className="hs-king-badge atk" title={`Sức công Vua Trắng: ${wKing.atk}`}>
                    ⚔{wKing.atk}
                  </span>
                  <div
                    className="king-hp-bar-outer"
                    title={`Máu Vua Trắng: ${wKing.hp}/${wKing.maxHp} HP (${Math.round(wHpPct)}%)`}
                  >
                    <div
                      className="king-hp-bar-damage-trail"
                      style={{ width: `${wHpPct}%` }}
                    />
                    <div
                      className={`king-hp-bar-fill white ${wHpPct <= 35 ? 'low-hp' : ''}`}
                      style={{ width: `${wHpPct}%` }}
                    />
                  </div>
                  <span className="hs-king-badge hp" title={`Máu Vua Trắng: ${wKing.hp}/${wKing.maxHp}`}>
                    💧{wKing.hp}
                  </span>
                  {wKing.armor > 0 && (
                    <span className="hs-king-badge armor" title={`Giáp Vua Trắng: ${wKing.armor}`}>
                      🛡{wKing.armor}
                    </span>
                  )}
                </div>

                <span className="king-vs-sep">⚔</span>

                <div className="king-hp-chip black-king">
                  <span className="king-chip-crown" title="Vua Đen">♚</span>
                  <span className="hs-king-badge atk" title={`Sức công Vua Đen: ${bKing.atk}`}>
                    ⚔{bKing.atk}
                  </span>
                  <div
                    className="king-hp-bar-outer"
                    title={`Máu Vua Đen: ${bKing.hp}/${bKing.maxHp} HP (${Math.round(bHpPct)}%)`}
                  >
                    <div
                      className="king-hp-bar-damage-trail"
                      style={{ width: `${bHpPct}%` }}
                    />
                    <div
                      className={`king-hp-bar-fill black ${bHpPct <= 35 ? 'low-hp' : ''}`}
                      style={{ width: `${bHpPct}%` }}
                    />
                  </div>
                  <span className="hs-king-badge hp" title={`Máu Vua Đen: ${bKing.hp}/${bKing.maxHp}`}>
                    💧{bKing.hp}
                  </span>
                  {bKing.armor > 0 && (
                    <span className="hs-king-badge armor" title={`Giáp Vua Đen: ${bKing.armor}`}>
                      🛡{bKing.armor}
                    </span>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Right Compact Quick Toolbar (Never wraps onto multiple rows) */}
        <div className="hud-quick-toolbar">
          {/* Real-time FPS & Performance Mode Switcher */}
          <button
            type="button"
            className={`hud-btn fps-perf-btn ${
              gameState?.performancePreset === 'performance'
                ? 'perf-mode'
                : gameState?.performancePreset === 'ultra'
                  ? 'ultra-mode'
                  : 'balanced-mode'
            }`}
            id="btn-perf-preset"
            title={`Tốc độ khung hình: ${gameState?.fps ?? 60} FPS | Cấu hình: ${
              gameState?.performancePreset === 'performance'
                ? '⚡ Siêu Mượt (Max FPS)'
                : gameState?.performancePreset === 'ultra'
                  ? '💎 Đồ Họa Cao (Ultra)'
                  : '⚖ Cân Bằng (Balanced)'
            } — Nhấp để đổi cấu hình tối ưu FPS`}
            onMouseEnter={() => getEngine()?.playUIHover?.()}
            onClick={() => {
              getEngine()?.playUIClick?.();
              getEngine()?.cyclePerformancePreset?.();
            }}
          >
            <span
              className={`fps-dot ${
                (gameState?.fps ?? 60) >= 50
                  ? 'fps-good'
                  : (gameState?.fps ?? 60) >= 30
                    ? 'fps-med'
                    : 'fps-low'
              }`}
            />
            <span className="fps-val">{gameState?.fps ?? 60} FPS</span>
            <span className="perf-badge">
              {gameState?.performancePreset === 'performance'
                ? '⚡ Max'
                : gameState?.performancePreset === 'ultra'
                  ? '💎 Ultra'
                  : '⚖ Chuẩn'}
            </span>
          </button>
          <button
            type="button"
            className="hud-btn elo-rank-top-pill"
            id="btn-elo-rank-top"
            title={`Hạng hiện tại: ${
              gameState?.commercial?.rankInfo?.tierNameVi || 'Tân Binh Đồng'
            } (${gameState?.commercial?.elo ?? 1000} Elo) | Độ khó AI: ${
              gameState?.commercial?.botDifficulty?.nameVi || 'Bot Tân Binh Đồng'
            } (${gameState?.commercial?.botDifficulty?.descVi || 'Tăng dần theo Elo'}) — Nhấn để xem Bảng Xếp Hạng Elo`}
            onMouseEnter={() => getEngine()?.playUIHover?.()}
            onClick={() => {
              getEngine()?.playUIClick?.();
              setStoreTab('elo');
              setSkinStoreOpen(true);
              setMobileSheetOpen(false);
            }}
          >
            <span className="elo-tier-icon">
              {gameState?.commercial?.rankInfo?.tierIcon || '🥉'}
            </span>
            <span className="elo-score-text">{gameState?.commercial?.elo ?? 1000} Elo</span>
            <span
              className="bot-elo-tier-tag"
              style={{
                color: gameState?.commercial?.botDifficulty?.colorHex || '#f5d76e'
              }}
            >
              {gameState?.commercial?.botDifficulty?.badgeVi || '🤖 Bot Lv.1'}
            </span>
          </button>

          <button
            type="button"
            className="hud-btn skin-store-top-btn"
            id="btn-skin-store"
            title="Mở Cửa Hàng 10 Bộ Skin Cờ 3D (Mua bằng Vàng & Mở khóa theo Elo — Chỉ trang trí, không cộng chỉ số)"
            onMouseEnter={() => getEngine()?.playUIHover?.()}
            onClick={() => {
              getEngine()?.playUIClick?.();
              setStoreTab('skins');
              setSkinStoreOpen(true);
              setMobileSheetOpen(false);
            }}
          >
            <span className="store-icon">🛒 Skin</span>
            <span className="gold-wallet-pill">
              🪙 {(gameState?.commercial?.gold ?? 0).toLocaleString()}
            </span>
          </button>

          <button
            type="button"
            className={`hud-btn tutorial-top-btn ${handsOnActive ? 'active' : ''}`}
            id="btn-tutorial-open"
            title="Bật / Tắt Chế Độ Cầm Tay Chỉ Việc (Bàn tay chỉ thẳng từng nút & từng ô cờ 3D trên màn hình)"
            onMouseEnter={() => getEngine()?.playUIHover?.()}
            onClick={() => {
              getEngine()?.playUIClick?.();
              setHandsOnActive((prev) => !prev);
              setMobileSheetOpen(false);
            }}
          >
            {handsOnActive ? '👆 Chỉ Việc: BẬT' : '👆 Chỉ Việc'}
          </button>

          <button
            type="button"
            className={`hud-btn tactical-ping-top-btn ${gameState?.tacticalPingMode ? 'active' : ''}`}
            id="btn-tactical-ping"
            title="Chế độ Ping Chiến Thuật trên bàn cờ 3D (Phím tắt: G hoặc Alt/Shift + Click vào ô cờ để chỉ điểm cho AI)"
            onMouseEnter={() => getEngine()?.playUIHover?.()}
            onClick={() => {
              getEngine()?.toggleTacticalPingMode?.();
            }}
          >
            <span>{gameState?.tacticalPingMode ? '📍 Ping: BẬT' : '📍 Ping Ô'}</span>
            {(gameState?.activeTacticalPings?.length || 0) > 0 && (
              <span className="ping-count-badge">
                {gameState?.activeTacticalPings?.length}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`hud-btn pathing-top-btn ${
              (gameState?.unitPathing?.displayMode || 'ALL') !== 'OFF' ? 'active' : ''
            }`}
            id="btn-pathing-mode"
            title="Chuyển chế độ hiển thị Quỹ Đạo Dự Kiến & Lịch Sử Di Chuyển 3D của quân cờ đang chọn"
            onMouseEnter={() => getEngine()?.playUIHover?.()}
            onClick={() => {
              getEngine()?.cyclePathingDisplayMode?.();
            }}
          >
            <span>
              {(() => {
                const mode = gameState?.unitPathing?.displayMode || 'ALL';
                if (mode === 'ALL') return '🧭 Quỹ Đạo: Đầy Đủ';
                if (mode === 'TRAJECTORY') return '🎯 Chỉ Hướng Đi';
                if (mode === 'HISTORY') return '📜 Chỉ Lịch Sử';
                return '🧭 Quỹ Đạo: Tắt';
              })()}
            </span>
          </button>

          <button
            type="button"
            className="hud-btn restart-top-btn"
            id="btn-restart-top"
            title="Khởi động lại ván đấu mới (Restart)"
            onMouseEnter={() => getEngine()?.playUIHover?.()}
            onClick={() => {
              getEngine()?.restartGame?.();
            }}
          >
            🔄 Restart
          </button>

          <button
            type="button"
            className={`hud-btn audio-pill-btn ${gameState?.bgmPlaying ? 'active bgm-playing' : ''}`}
            id="btn-bgm-toggle"
            title={`${(gameState as any)?.bgmTrack?.title || 'Symphony Battle Orchestra'} — Bấm để Bật/Tắt`}
            onMouseEnter={() => getEngine()?.playUIHover?.()}
            onClick={() => {
              getEngine()?.toggleBattleMusic?.();
            }}
          >
            <span className="audio-icon" aria-hidden="true">
              {gameState?.bgmPlaying ? '🎻' : '🎼'}
            </span>
            <span className="audio-btn-label">
              {gameState?.bgmPlaying ? 'Nhạc Chiến Trận' : 'Bật Nhạc'}
            </span>
            {gameState?.bgmPlaying && (
              <span className="bgm-eq-bars" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            )}
          </button>

          {gameState?.bgmPlaying && (
            <button
              type="button"
              className="hud-btn audio-next-track-btn"
              id="btn-bgm-next"
              title={`Đổi bài tiếp theo: ${(gameState as any)?.bgmTrack?.title || 'Kế tiếp'}`}
              onMouseEnter={() => getEngine()?.playUIHover?.()}
              onClick={() => {
                getEngine()?.nextBattleTrack?.();
              }}
            >
              ⏭ Đổi Bài
            </button>
          )}

          <button
            type="button"
            className="hud-btn main-menu-trigger-btn"
            id="btn-main-menu-trigger"
            onClick={() => {
              getEngine()?.playUIClick?.();
              setMainMenuOpen(true);
              setMobileSheetOpen(false);
            }}
            title="Mở Menu Chính: Đấu Máy, Đấu Online 1vs1, Cửa Hàng & Cài Đặt"
          >
            ☰ Menu Chính
          </button>

          <button
            type="button"
            className="hud-btn primary"
            onClick={() => {
              setRulesModalOpen(true);
              setMobileSheetOpen(false);
            }}
            title="Xem Luật Chơi Hearthstone Chess & Bảng Phép Bài"
          >
            📖 Luật
          </button>

          <button
            type="button"
            className={`hud-btn menu-popover-trigger ${mobileSheetOpen ? 'active' : ''}`}
            id="btn-mobile-controls"
            aria-expanded={mobileSheetOpen}
            aria-controls="hud-right"
            onClick={() => setMobileSheetOpen((prev) => !prev)}
            title="Mở bảng Góc Nhìn Camera, Đổi Phe, AI Move & Âm Thanh"
          >
            {mobileSheetOpen ? '✕ Đóng' : '⚙ Menu & Camera'}
          </button>
        </div>

        <div
          className={`mobile-sheet-backdrop ${mobileSheetOpen ? 'open' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setMobileSheetOpen(false);
          }}
          aria-hidden="true"
        ></div>

        {/* Popover Control Panel (Contains all required engine button IDs without cluttering the top bar) */}
        <div
          className={`hud-group hud-popover-drawer ${mobileSheetOpen ? 'mobile-sheet-open' : ''}`}
          id="hud-right"
        >
          <div
            className="mobile-sheet-handle-wrap"
            onClick={(e) => {
              e.stopPropagation();
              setMobileSheetOpen(false);
            }}
            aria-hidden="true"
          >
            <div className="mobile-sheet-handle"></div>
          </div>

          <div className="mobile-sheet-header">
            <span className="mobile-sheet-title">Góc Nhìn &amp; Tùy Chọn</span>
            <button
              type="button"
              className="mobile-sheet-close"
              id="btn-mobile-sheet-close"
              onClick={(e) => {
                e.stopPropagation();
                setMobileSheetOpen(false);
              }}
              aria-label="Close Controls"
            >
              Đóng ✕
            </button>
          </div>

          <div className="mobile-sheet-section-label">Điều Khiển Ván Đấu</div>

          <button
            className="hud-btn"
            id="btn-side-toggle"
            title="Switch between Playing as White and Playing as Black"
            onMouseEnter={() => getEngine()?.playUIHover?.()}
            onClick={() => {
              getEngine()?.playUIClick?.();
              setMobileSheetOpen(false);
            }}
          >
            Play as Black
          </button>
          <button
            className="hud-btn"
            id="btn-ai-move"
            style={{ display: 'none' }}
            aria-hidden="true"
            tabIndex={-1}
          >
            Auto Move Locked
          </button>
          <button
            className="hud-btn"
            id="btn-reset"
            title="Khởi động lại ván cờ mới (Restart)"
            onMouseEnter={() => getEngine()?.playUIHover?.()}
            onClick={() => {
              setMobileSheetOpen(false);
            }}
          >
            🔄 Restart
          </button>

          <div className="mobile-sheet-section-label">
            <span>Góc Nhìn Camera 3D</span>
            <span className="mobile-sheet-section-sub">Nhấn lần 2 để đảo chiều</span>
          </div>

          <button
            className="hud-btn active"
            id="btn-cam-player"
            title="Player Camera (Click again to flip White / Black view)"
          >
            Player Cam
          </button>
          <button
            className="hud-btn"
            id="btn-cam-top"
            title="Overhead Board View (Click again to flip White / Black orientation)"
          >
            Overhead
          </button>
          <button
            className="hud-btn"
            id="btn-cam-side"
            title="Side Profile View (Click again to switch East / West side)"
          >
            Side
          </button>
          <button
            className="hud-btn"
            id="btn-cam-wide"
            title="Wide Cathedral View (Click again to switch North Rose / South Narthex)"
          >
            Cathedral
          </button>

          <div className="mobile-sheet-section-label">Âm Thanh &amp; Giao Diện</div>

          <button
            type="button"
            className={`hud-btn audio-pill-btn ${!gameState?.sfxMuted ? 'active' : 'muted'}`}
            id="btn-sfx-toggle"
            title="Bật / Tắt Hiệu Ứng Âm Thanh Tương Tác Chi Tiết (SFX)"
            onMouseEnter={() => getEngine()?.playUIHover?.()}
            onClick={() => {
              getEngine()?.toggleSoundMute?.();
            }}
          >
            <span>{gameState?.sfxMuted ? '🔇 SFX: TẮT' : '🔊 SFX: BẬT'}</span>
          </button>

          <button
            className="hud-btn"
            id="btn-hide-ui"
            title="Toggle HUD visibility (Shortcut: H)"
            onClick={() => setMobileSheetOpen(false)}
          >
            Hide UI [H]
          </button>

          <div className="mobile-sheet-hint">
            <strong>Mẹo:</strong> Kéo chuột trái xoay góc nhìn • Chuột phải di chuyển • Giữ Alt/Shift + Click hoặc nhấn phím G để Ping ô cờ 3D
          </div>
        </div>
      </div>

      {/* 3D TACTICAL TILE PING COMMAND BAR (SHOWN WHEN PING MODE IS ACTIVE OR ACTIVE PINGS EXIST ON BOARD) */}
      {(gameState?.tacticalPingMode || (gameState?.activeTacticalPings?.length || 0) > 0) && (
        <div
          className={`tactical-ping-bar ${gameState?.tacticalPingMode ? 'ping-mode-active' : ''}`}
          id="tactical-ping-bar"
          role="region"
          aria-label="Bảng Điều Khiển Ping Chiến Thuật 3D"
        >
          <div className="tactical-ping-intents">
            <span className="tactical-ping-bar-title">
              {gameState?.tacticalPingMode
                ? '📍 CHỌN Ô CỜ 3D ĐỂ PING:'
                : '📍 PING CHIẾN THUẬT AI:'}
            </span>
            {Object.values(TACTICAL_PING_INTENTS).map((intentDef) => {
              const isSelected = (gameState?.selectedPingIntent || 'AUTO') === intentDef.id;
              return (
                <button
                  key={intentDef.id}
                  type="button"
                  className={`ping-intent-btn ${isSelected ? 'active' : ''}`}
                  style={
                    isSelected
                      ? {
                          borderColor: intentDef.colorHex,
                          color: intentDef.colorHex
                        }
                      : undefined
                  }
                  title={intentDef.desc}
                  onClick={() => {
                    getEngine()?.setTacticalPingIntent?.(intentDef.id);
                  }}
                >
                  <span>{intentDef.icon}</span>
                  <span>{intentDef.shortLabel}</span>
                </button>
              );
            })}
          </div>

          {(gameState?.activeTacticalPings?.length || 0) > 0 && (
            <div className="tactical-ping-active-list">
              {gameState?.activeTacticalPings?.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="active-ping-chip"
                  style={{ borderColor: p.colorHex, color: p.colorHex }}
                  title={`${p.label} tại ${p.algebraic.toUpperCase()} (${p.unitDesc || ''}) — Bấm để xóa Ping này`}
                  onClick={() => {
                    getEngine()?.removeTacticalPingAt?.(p.r, p.c);
                  }}
                >
                  <span>{p.icon}</span>
                  <strong>{p.algebraic.toUpperCase()}</strong>
                  <span className="ping-chip-label">{p.shortLabel || p.label}</span>
                  <span className="ping-chip-timer">{p.remainingSec}s</span>
                  <span className="ping-chip-remove">✕</span>
                </button>
              ))}
              <button
                type="button"
                className="ping-clear-all-btn"
                title="Xóa toàn bộ Ping chiến thuật trên bàn cờ"
                onClick={() => {
                  getEngine()?.clearTacticalPings?.();
                }}
              >
                ✕ Xóa Hết
              </button>
            </div>
          )}

          {gameState?.tacticalPingMode && (
            <div className="tactical-ping-hint">
              Click vào bất kỳ ô cờ 3D nào để đặt cọc tiêu ánh sáng chỉ điểm cho AI • Nhấn <strong>G</strong> hoặc{' '}
              <button
                type="button"
                className="ping-mode-exit-inline"
                onClick={() => getEngine()?.toggleTacticalPingMode?.(false)}
              >
                Thoát Ping
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3D VISUAL PATHING & TRAJECTORY INDICATOR BAR (SHOWN WHEN A UNIT IS SELECTED OR HAS MOVE HISTORY) */}
      {gameState?.unitPathing &&
        gameState.unitPathing.displayMode !== 'OFF' &&
        gameState.unitPathing.subjectUnit &&
        (Boolean(gameState.selectedSquare) ||
          (gameState.unitPathing.pathHistory?.length || 0) > 1) && (
          <div
            className="unit-pathing-telemetry-bar"
            id="unit-pathing-bar"
            role="region"
            aria-label="Chỉ Báo Lịch Sử Di Chuyển & Quỹ Đạo Quân Cờ 3D"
          >
            <div className="upb-unit-badge">
              <span className="upb-unit-icon">{gameState.unitPathing.subjectUnit.icon}</span>
              <span className="upb-unit-name">
                {gameState.unitPathing.subjectUnit.nameVi} Lv.{gameState.unitPathing.subjectUnit.level}
              </span>
              <span className="upb-unit-coord">
                {gameState.unitPathing.subjectUnit.algebraic.toUpperCase()}
              </span>
            </div>

            {/* Move History Breadcrumb Trail */}
            {(gameState.unitPathing.displayMode === 'ALL' ||
              gameState.unitPathing.displayMode === 'HISTORY') && (
              <div className="upb-section history-trail">
                <span className="upb-label">📜 Lịch sử:</span>
                <div className="upb-breadcrumbs">
                  {(gameState.unitPathing.pathHistory || []).slice(-6).map((step, idx, arr) => (
                    <span key={`${step.turn}_${step.algebraic}_${idx}`} className="upb-crumb-wrap">
                      <span
                        className={`upb-crumb kind-${step.kind.toLowerCase()} ${
                          idx === arr.length - 1 ? 'current' : ''
                        }`}
                        title={
                          step.kind === 'SPAWN'
                            ? `Vị trí khởi điểm (${step.algebraic.toUpperCase()})`
                            : step.kind === 'CLASH_REPEL'
                              ? `Lượt ${step.turn}: Đụng độ tại ${(step.targetAlgebraic || '').toUpperCase()} và dội về ${step.algebraic.toUpperCase()}`
                              : `Lượt ${step.turn}: ${step.algebraic.toUpperCase()} (${step.kind})`
                        }
                      >
                        {step.kind === 'CLASH_REPEL' && step.targetAlgebraic
                          ? `⚡${step.targetAlgebraic.toUpperCase()}↩${step.algebraic.toUpperCase()}`
                          : step.algebraic.toUpperCase()}
                      </span>
                      {idx < arr.length - 1 && (
                        <span className="upb-crumb-arrow" aria-hidden="true">
                          ➔
                        </span>
                      )}
                    </span>
                  ))}
                  {(gameState.unitPathing.pathHistory?.length || 0) <= 1 && (
                    <span className="upb-muted-note">(Chưa di chuyển)</span>
                  )}
                </div>
              </div>
            )}

            {/* Intended Trajectory Indicator */}
            {(gameState.unitPathing.displayMode === 'ALL' ||
              gameState.unitPathing.displayMode === 'TRAJECTORY') &&
              gameState.unitPathing.intendedTrajectory && (
                <div className="upb-section intended-traj">
                  <span className="upb-label">
                    {gameState.unitPathing.intendedTrajectory.isHoveredTarget
                      ? '🎯 Quỹ đạo chọn:'
                      : '🧭 Quỹ đạo gợi ý:'}
                  </span>
                  <span
                    className={`upb-traj-badge ${
                      gameState.unitPathing.intendedTrajectory.isCapture
                        ? 'capture'
                        : gameState.unitPathing.intendedTrajectory.isCastle
                          ? 'castle'
                          : 'move'
                    }`}
                  >
                    <strong>
                      {gameState.unitPathing.intendedTrajectory.fromAlgebraic.toUpperCase()} ➔{' '}
                      {gameState.unitPathing.intendedTrajectory.toAlgebraic.toUpperCase()}
                    </strong>
                    <span>
                      {gameState.unitPathing.intendedTrajectory.isCapture
                        ? '⚔ Tấn công'
                        : gameState.unitPathing.intendedTrajectory.isCastle
                          ? '🏰 Nhập thành'
                          : gameState.unitPathing.intendedTrajectory.isKnightJump
                            ? '🐴 Nhảy chữ L'
                            : `${gameState.unitPathing.intendedTrajectory.distance} ô`}
                    </span>
                  </span>
                  {(() => {
                    const inter = gameState.unitPathing.intendedTrajectory.waypoints.filter(
                      (w) => w.isIntermediate
                    );
                    if (inter.length === 0) return null;
                    return (
                      <span className="upb-waypoints-note">
                        Qua: {inter.map((w) => w.algebraic.toUpperCase()).join(' › ')}
                      </span>
                    );
                  })()}
                </div>
              )}

            {/* Quick Mode Filter Buttons */}
            <div className="upb-mode-Controls">
              {(
                [
                  { id: 'ALL', label: 'Đầy Đủ' },
                  { id: 'TRAJECTORY', label: 'Hướng Đi' },
                  { id: 'HISTORY', label: 'Lịch Sử' },
                  { id: 'OFF', label: 'Ẩn' }
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`upb-mode-btn ${
                    gameState.unitPathing?.displayMode === m.id ? 'active' : ''
                  }`}
                  onClick={() => getEngine()?.setPathingDisplayMode?.(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

      {/* TEMPORARY 'TIME EXPIRED' TOAST NOTIFICATION WHEN TURN TIMER REACHES 0 */}
      {timeoutToast && (
        <div
          className="turn-timeout-toast"
          id="turn-timeout-toast"
          role="alert"
          aria-live="assertive"
        >
          <div className="timeout-toast-icon" aria-hidden="true">
            ⌛
          </div>
          <div className="timeout-toast-body">
            <div className="timeout-toast-title">
              TIME EXPIRED • HẾT GIỜ SUY NGHĨ (30s)
            </div>
            <div className="timeout-toast-desc">
              {timeoutToast.expiredSide === (gameState?.playerColor || 'w') ? (
                <>
                  <strong>Your turn has been skipped!</strong> Lượt của bạn (
                  {timeoutToast.expiredSide === 'w' ? 'Quân Trắng' : 'Quân Đen'}) đã bị bỏ qua — Chuyển lượt sang phe{' '}
                  <strong>{timeoutToast.nextSide === 'w' ? 'Trắng' : 'Đen'}</strong>.
                </>
              ) : (
                <>
                  <strong>Turn skipped!</strong> Lượt của phe{' '}
                  {timeoutToast.expiredSide === 'w' ? 'Trắng' : 'Đen'} đã hết giờ — Chuyển quyền chỉ huy sang phe{' '}
                  <strong>{timeoutToast.nextSide === 'w' ? 'Trắng' : 'Đen'}</strong>.
                </>
              )}
            </div>
            <div className="timeout-toast-progress" key={timeoutToast.id}>
              <div className="timeout-toast-progress-bar" />
            </div>
          </div>
          <button
            type="button"
            className="timeout-toast-close"
            onClick={() => setTimeoutToast(null)}
            aria-label="Dismiss Time Expired alert"
          >
            ✕
          </button>
        </div>
      )}

      {/* Active Combat Clash Banner & Vignette disabled completely for max FPS */}

      {/* BOTTOM-DOCKED TURN & COMBAT STATUS BAR (SHOWN ONLY WHEN THE CARD DOCK IS AUTO-HIDDEN) */}
      {gameState && gameState.isLoaded && !gameState.gameOver && !isCardDockVisible && !mainMenuOpen && (
        <div
          className={`turn-flow-director-bar phase-${turnPhase.toLowerCase()} ${
            gameState.activeCombatBanner ? 'in-combat' : !isPlayerTurn ? 'opponent-turn' : ''
          }`}
          id="turn-flow-director-bar"
          role="status"
          aria-live="polite"
        >
          <div className="director-steps-track">
            <span className={`director-step-chip ${isPlayerTurn ? 'active-turn' : 'enemy-turn'}`}>
              {isPlayerTurn ? '👑 Lượt Bạn' : '⏳ Lượt Địch'} (
              {currentTurnColor === 'w' ? 'Trắng' : 'Đen'})
            </span>
            <span className="director-sep" aria-hidden="true">›</span>
            <span className="director-step-chip completed">① Bốc Bài</span>
            <span className="director-sep" aria-hidden="true">›</span>
            <span
              className={`director-step-chip ${
                turnPhase === 'EMPOWER_UNIT' || turnPhase === 'ULTIMATE_TARGETING'
                  ? 'current'
                  : 'completed'
              }`}
            >
              ② Buff Quân
            </span>
            <span className="director-sep" aria-hidden="true">›</span>
            <span
              className={`director-step-chip ${
                gameState.activeCombatBanner
                  ? 'combat-active'
                  : turnPhase === 'MOVE_UNIT'
                    ? 'current'
                    : ''
              }`}
            >
              ③ Đi Quân &amp; Combat
            </span>
          </div>

          <div className="director-live-message">
            {gameState.activeCombatBanner ? (
              <span className="director-msg-combat">
                ⚔ <strong>COMBAT:</strong> {gameState.activeCombatBanner.attackerIcon}{' '}
                {gameState.activeCombatBanner.attackerName} vs{' '}
                {gameState.activeCombatBanner.defenderIcon}{' '}
                {gameState.activeCombatBanner.defenderName} — Khay bài sẽ hiện lại sau khi Combat xong!
              </span>
            ) : !isPlayerTurn ? (
              <span className="director-msg-wait">
                ⏳ Đối thủ ({currentTurnColor === 'w' ? 'Trắng' : 'Đen'}) đang bốc bài, gắn Buff và đi quân...
              </span>
            ) : turnPhase === 'EMPOWER_UNIT' ? (
              <span>
                ✨ <strong>Đã chốt bài {poker?.committedCombo?.nameVi || 'Phép'}</strong> (
                <strong style={{ color: poker?.committedCombo?.badgeColor || '#fde047' }}>
                  +{poker?.committedCombo?.atkBonus ?? 0}⚔
                  {(poker?.committedCombo?.armorBonus ?? 0) > 0
                    ? ` +${poker?.committedCombo?.armorBonus}🛡`
                    : ''}
                </strong>
                ) — Nhấn vào 1 quân đồng minh trên bàn 3D để gắn Buff!
              </span>
            ) : turnPhase === 'ULTIMATE_TARGETING' ? (
              <span>
                ⚡ <strong>Tứ Quý Thiên Phạt:</strong> Chọn tối đa{' '}
                <strong>{gameState.maxUltimateTargets || 8} quân địch</strong> trên bàn 3D (
                {gameState.ultimateTargetSquares.length || 0}/{gameState.maxUltimateTargets || 8})
              </span>
            ) : (
              <span>
                ⚔ <strong>Đã gắn Buff!</strong>{' '}
                {empoweredUnit && poker?.committedCombo ? (
                  <>
                    <strong style={{ color: poker.committedCombo.badgeColor }}>
                      {empoweredUnit.icon} {empoweredUnit.nameVi} ({empoweredUnit.algebraic.toUpperCase()})
                    </strong>{' '}
                    •{' '}
                  </>
                ) : null}
                Chọn quân trên bàn 3D để di chuyển &amp; Combat!
              </span>
            )}
          </div>

          {isPlayerTurn && !gameState.activeCombatBanner && turnPhase === 'EMPOWER_UNIT' && (
            <div className="director-actions">
              <button
                type="button"
                className="director-action-btn primary"
                onClick={() => getEngine()?.triggerTutorialStepAction?.()}
                title="Tự động gắn Buff cho quân tiên phong tốt nhất"
              >
                ⚡ Tự Gắn Buff
              </button>
              <button
                type="button"
                className="director-action-btn secondary"
                onClick={() => getEngine()?.skipEmpowerPhase?.()}
                title="Bỏ qua bước buff và đi quân ngay"
              >
                ⏭ Đi Quân Ngay
              </button>
            </div>
          )}

          {isPlayerTurn && !gameState.activeCombatBanner && turnPhase === 'ULTIMATE_TARGETING' && (
            <div className="director-actions">
              <button
                type="button"
                className="director-action-btn ultimate"
                onClick={() => getEngine()?.confirmFourKingsUltimate?.()}
              >
                ⚡ Giáng Thiên Phạt ({gameState.ultimateTargetSquares.length || 'Tự Chọn 8'})
              </button>
            </div>
          )}

          {isPlayerTurn && !gameState.activeCombatBanner && turnPhase === 'MOVE_UNIT' && (
            <div className="director-actions">
              <button
                type="button"
                className="director-action-btn secondary"
                onClick={() => setPeekDockDuringMove(true)}
                title="Xem lại khay bài đang giữ"
              >
                🃏 Xem Bài
              </button>
              <button
                type="button"
                className="director-action-btn primary"
                onClick={() => getEngine()?.endPlayerTurnNow?.()}
                title="Kết thúc lượt ngay"
              >
                ⌛ Kết Thúc Lượt
              </button>
            </div>
          )}
        </div>
      )}

      {/* ANIMATED PHASE / TURN / BUFF / COMBAT MILESTONE ANNOUNCEMENT TOAST */}
      {phaseAnnouncement && gameState?.isLoaded && !gameState?.gameOver && !mainMenuOpen && (
        <div
          key={phaseAnnouncement.id}
          className={`phase-announcement-banner cat-${phaseAnnouncement.category}`}
          id="phase-announcement-banner"
          role="status"
          aria-live="polite"
        >
          <span className="phase-ann-badge">{phaseAnnouncement.badge}</span>
          <span className="phase-ann-title">{phaseAnnouncement.title}</span>
          <span className="phase-ann-sub">{phaseAnnouncement.subtitle}</span>
        </div>
      )}

      {/* LIVE COMBAT FORECAST BANNER (WHEN HOVERING AN ENEMY TARGET) */}
      {forecast && (
        <div className={`combat-forecast-card ${outcomeMeta[forecast.outcome].colorClass}`}>
          <div className="forecast-header">
            <span className="forecast-outcome-title">{outcomeMeta[forecast.outcome].label}</span>
            <span className="forecast-coords">
              {forecast.fromAlgebraic.toUpperCase()} ➔ {forecast.toAlgebraic.toUpperCase()}
            </span>
          </div>
          <div className="forecast-sub">{outcomeMeta[forecast.outcome].sub}</div>

          <div className="forecast-duel-row">
            <div className="forecast-fighter">
              <div className="fighter-name">
                {forecast.attackerUnit.icon} {forecast.attackerUnit.nameVi} (Ta • Lv.{forecast.attackerUnit.level})
              </div>
              <div className="fighter-stats">
                <span>Tổng Công: <strong>{forecast.attTotalAtk}⚔</strong></span>
                <span>
                  Máu sau đòn:{' '}
                  <strong className={forecast.attAfterHp <= 0 ? 'dead-num' : 'alive-num'}>
                    {forecast.attAfterHp}/{forecast.attackerUnit.maxHp}❤
                  </strong>
                </span>
              </div>
            </div>

            <div className="forecast-vs">⚡</div>

            <div className="forecast-fighter right">
              <div className="fighter-name">
                {forecast.defenderUnit.icon} {forecast.defenderUnit.nameVi} (Địch • Lv.{forecast.defenderUnit.level})
              </div>
              <div className="fighter-stats">
                <span>Phản Đòn: <strong>{forecast.firstStrikeTriggered ? '0 (Bị Phủ Đầu)' : `${forecast.defTotalAtk}⚔`}</strong></span>
                <span>
                  Máu sau đòn:{' '}
                  <strong className={forecast.defAfterHp <= 0 ? 'dead-num' : 'alive-num'}>
                    {forecast.defAfterHp}/{forecast.defenderUnit.maxHp}❤
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {forecast.notes.length > 0 && (
            <div className="forecast-notes">
              {forecast.notes.map((n, i) => (
                <span key={i} className="forecast-note-tag">
                  ✦ {n}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STREAMLINED HEARTHSTONE CARD DOCK (AUTO-HIDES WHEN BUFF IS LOCKED IN, REAPPEARS AFTER COMBAT) */}
      {isCardDockVisible && poker && (
        <section
          className={`poker-hand-dock hs-tavern-dock phase-${turnPhase.toLowerCase()} ${
            pokerDockMinimized ? 'minimized' : ''
          }`}
          aria-label="Khay bài phép & điều khiển lượt"
        >
          {/* Compact Single-Line Header: 4 Steps + Mana + Optional Tools */}
          <div className="poker-dock-topbar">
            <div className="poker-step-pills">
              <span
                className={`step-pill ${
                  turnPhase === 'DRAW_PHASE' ? 'active' : poker.hasDrawnThisTurn ? 'done' : ''
                }`}
              >
                1. Bốc bài
              </span>
              <span className="step-arrow" aria-hidden="true">·</span>
              <span
                className={`step-pill ${
                  turnPhase === 'SELECT_CARDS' ? 'active' : poker.committedCombo ? 'done' : ''
                }`}
              >
                2. Ghép 5 lá
              </span>
              <span className="step-arrow" aria-hidden="true">·</span>
              <span
                className={`step-pill ${
                  turnPhase === 'EMPOWER_UNIT' || turnPhase === 'ULTIMATE_TARGETING'
                    ? 'active'
                    : turnPhase === 'MOVE_UNIT'
                      ? 'done'
                      : ''
                }`}
              >
                3. {turnPhase === 'ULTIMATE_TARGETING' ? 'Thiên Phạt' : 'Gắn Buff'}
              </span>
              <span className="step-arrow" aria-hidden="true">·</span>
              <span className={`step-pill ${turnPhase === 'MOVE_UNIT' ? 'active' : ''}`}>
                4. Đi quân
              </span>
            </div>

            <div className="hs-mana-tray" title="Tinh thể Mana hiện tại">
              <span className="hs-mana-label">
                💎 <strong>{poker.mana}/{poker.maxMana}</strong>
              </span>
              <div className="hs-mana-gems" aria-hidden="true">
                {Array.from({ length: Math.max(poker.maxMana, 5) }).map((_, i) => {
                  const isFilled = i < poker.mana;
                  const isPreviewCost =
                    turnPhase === 'SELECT_CARDS' &&
                    poker.evaluatedCombo &&
                    isFilled &&
                    i >= poker.mana - (poker.evaluatedCombo.manaCost || 1);
                  return (
                    <span
                      key={i}
                      className={`hs-mana-gem ${isFilled ? 'filled' : 'empty'} ${
                        isPreviewCost ? 'preview-spend' : ''
                      }`}
                    />
                  );
                })}
              </div>
              {poker.coinAvailable && isPlayerTurn && (
                <button
                  type="button"
                  className="hs-coin-btn"
                  onClick={() => getEngine()?.useManaCoin?.()}
                  title="Dùng Đồng Xu Linh Lực: +2💎 Mana trong lượt này"
                >
                  🪙 +2💎
                </button>
              )}
            </div>

            <div className="poker-deck-counters">
              <span>Cỗ bài: <strong>{poker.drawCount}</strong></span>
              <button
                type="button"
                className="dock-toggle-btn"
                onClick={() => setPokerDockMinimized((p) => !p)}
                title={pokerDockMinimized ? 'Mở rộng khay bài' : 'Thu gọn khay bài'}
              >
                {pokerDockMinimized ? '▲ Mở' : '▼ Thu gọn'}
              </button>
            </div>
          </div>

          {!pokerDockMinimized && (
            <>
              {/* STEP 1: CLEAN ONE-CLICK DRAW VIEW (No cluttered overlapping overlays) */}
              {turnPhase === 'DRAW_PHASE' && (
                <div className="hs-clean-draw-stage">
                  <div className="hs-held-preview">
                    <span className="hs-held-label">Đang giữ ({poker.hand.length} lá):</span>
                    <div className="hs-mini-cards">
                      {poker.hand.map((card) => (
                        <span key={card.id} className={`hs-mini-card ${card.color}`}>
                          {card.rankLabel}
                          {card.suitSymbol}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    id="btn-tutorial-draw-cards"
                    className="poker-btn commit hs-draw-primary hs-clean-draw-btn"
                    onClick={() => getEngine()?.drawTurnCards?.()}
                    disabled={!isPlayerTurn}
                  >
                    🃏 Bốc {Math.max(0, 7 - poker.hand.length)} Lá Bài Mới (Đủ 7 Lá)
                  </button>
                </div>
              )}

              {/* STEP 2: CLEAN 7-CARD FAN & SINGLE ACTION ROW */}
              {turnPhase === 'SELECT_CARDS' && (
                <>
                  <div className="poker-cards-fan hs-clean-fan">
                    {poker.hand.map((card, idx) => {
                      const isSelected = poker.selectedIndices.includes(idx);
                      const total = poker.hand.length;
                      const mid = (total - 1) / 2;
                      const offset = idx - mid;
                      const rotDeg = offset * 2.4;
                      const liftY = Math.abs(offset) * 1.8;
                      return (
                        <button
                          key={card.id}
                          type="button"
                          style={{
                            transform: isSelected
                              ? `translateY(-12px) rotate(0deg) scale(1.05)`
                              : `translateY(${liftY}px) rotate(${rotDeg}deg)`
                          }}
                          className={`playing-card hs-card ${card.color} ${
                            isSelected ? 'selected playable-glow' : ''
                          }`}
                          onMouseEnter={() => getEngine()?.playUIHover?.()}
                          onClick={() => getEngine()?.toggleCardSelectionIndex?.(idx)}
                          disabled={!isPlayerTurn}
                          title={`${card.rankLabel}${card.suitSymbol} — Click để chọn/bỏ chọn`}
                        >
                          <div className="card-corner top">
                            <span className="card-rank">{card.rankLabel}</span>
                            <span className="card-suit-sm">{card.suitSymbol}</span>
                          </div>
                          <div className="card-center-suit">{card.suitSymbol}</div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="poker-combo-bar hs-spell-bar">
                    <div className="combo-preview-info">
                      {poker.evaluatedCombo ? (
                        <>
                          <span
                            className="combo-clean-title"
                            style={{ color: poker.evaluatedCombo.badgeColor }}
                          >
                            ✦ {poker.evaluatedCombo.nameVi} ({poker.evaluatedCombo.manaCost}💎)
                          </span>
                          <span className="combo-effect-summary">
                            {poker.evaluatedCombo.isUltimate ? (
                              <strong>{poker.evaluatedCombo.descVi}</strong>
                            ) : (
                              <>
                                <strong>+{poker.evaluatedCombo.atkBonus}⚔ Công</strong>
                                {poker.evaluatedCombo.armorBonus > 0
                                  ? ` · +${poker.evaluatedCombo.armorBonus}🛡 Giáp`
                                  : ''}
                                {poker.evaluatedCombo.instantHeal > 0
                                  ? ` · +${poker.evaluatedCombo.instantHeal}❤ Máu`
                                  : ''}
                                {' · '}
                                {poker.evaluatedCombo.shortTag}
                              </>
                            )}
                          </span>
                        </>
                      ) : (
                        <span className="combo-effect-summary">
                          Hãy chọn đủ <strong>5 lá bài</strong> trên tay ({poker.selectedIndices.length}/5)
                        </span>
                      )}
                    </div>

                    <div className="poker-action-buttons">
                      <button
                        type="button"
                        id="btn-tutorial-autoselect-5"
                        className="poker-btn secondary"
                        onClick={() => getEngine()?.autoSelectBest5Cards?.()}
                        disabled={!isPlayerTurn}
                      >
                        Tự chọn 5 lá
                      </button>
                      <button
                        type="button"
                        id="btn-tutorial-commit-combo"
                        className={`poker-btn commit ${
                          poker.evaluatedCombo?.isUltimate ? 'ultimate-commit' : ''
                        }`}
                        onClick={() => getEngine()?.commitSelected5CardCombo?.()}
                        disabled={!isPlayerTurn || !poker.isFiveSelected}
                      >
                        {poker.evaluatedCombo?.isUltimate
                          ? `⚡ Kích Hoạt ${poker.evaluatedCombo.nameVi} (${poker.evaluatedCombo.manaCost}💎)`
                          : `🔥 Kích Hoạt Phép (${poker.evaluatedCombo?.manaCost ?? 1}💎)`}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* STEP 3: COMPACT BUFF TARGET BAR (Cards tucked away so 3D board is clear) */}
              {turnPhase === 'EMPOWER_UNIT' && poker.committedCombo && (
                <div className="hs-compact-phase-bar">
                  <div className="hs-compact-phase-top">
                    <span className="hs-compact-prompt">
                      🎯 Chọn quân đồng minh nhận Buff{' '}
                      <strong style={{ color: poker.committedCombo.badgeColor }}>
                        {poker.committedCombo.nameVi} (+{poker.committedCombo.atkBonus}⚔
                        {poker.committedCombo.armorBonus > 0
                          ? ` +${poker.committedCombo.armorBonus}🛡`
                          : ''}
                        )
                      </strong>
                      :
                    </span>
                    <button
                      type="button"
                      className="poker-btn commit"
                      onClick={() => getEngine()?.skipEmpowerPhase?.()}
                      disabled={!isPlayerTurn}
                    >
                      ⚡ Gắn Nhanh Cho Hậu/Vua
                    </button>
                  </div>

                  {friendlyUnits.length > 0 && (
                    <div className="empower-unit-chips">
                      {friendlyUnits.slice(0, 8).map((u) => (
                        <button
                          key={`${u.r}_${u.c}`}
                          type="button"
                          className="empower-unit-chip"
                          onClick={() => getEngine()?.empowerFriendlyUnitAt?.(u.r, u.c)}
                        >
                          <span>{u.icon}</span>
                          <span>{u.nameVi}</span>
                          <span className="chip-coord">{u.algebraic.toUpperCase()}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: SLIM BOARD MOVEMENT & COMBAT BAR */}
              {(turnPhase === 'MOVE_UNIT' || turnPhase === 'ULTIMATE_TARGETING') && (
                <div className="hs-compact-move-bar">
                  <span className="hs-compact-prompt">
                    {turnPhase === 'ULTIMATE_TARGETING' ? (
                      <>⚡ Click chọn tối đa 8 quân địch trên bàn cờ 3D để Giáng Thiên Phạt</>
                    ) : (
                      <>
                        ⚔ <strong>Đã mở khóa bàn cờ!</strong> Click quân cờ đồng minh trên bàn 3D để di chuyển hoặc tấn công
                        {empoweredUnit && poker.committedCombo && (
                          <>
                            {' · '}Buff:{' '}
                            <strong style={{ color: poker.committedCombo.badgeColor }}>
                              {empoweredUnit.icon} {empoweredUnit.nameVi} {empoweredUnit.algebraic.toUpperCase()}
                            </strong>
                          </>
                        )}
                      </>
                    )}
                  </span>

                  <div className="poker-action-buttons">
                    {turnPhase === 'ULTIMATE_TARGETING' ? (
                      <button
                        type="button"
                        id="btn-tutorial-ultimate-confirm"
                        className="poker-btn commit ultimate-commit"
                        onClick={() => getEngine()?.confirmFourKingsUltimate?.()}
                        disabled={!isPlayerTurn}
                      >
                        ⚡ Giáng Thiên Phạt ({gameState?.ultimateTargetSquares.length || 'Tự Chọn 8'})
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="poker-btn commit"
                        onClick={() => getEngine()?.endPlayerTurnNow?.()}
                        disabled={!isPlayerTurn}
                      >
                        ⌛ Kết Thúc Lượt
                      </button>
                    )}
                  </div>
                </div>
              )}

            </>
          )}
        </section>
      )}

      {/* HANDS-ON INTERACTIVE POINTER & SPOTLIGHT OVERLAY ("CẦM TAY CHỈ VIỆC" — ZERO WALL OF TEXT) */}
      {handsOnActive && handsOnSpot && gameState?.isLoaded && !gameState?.gameOver && (
        <div
          className="hands-on-overlay-layer"
          id="hands-on-overlay"
          aria-live="polite"
        >
          {/* Case 1: Highlighting a DOM Button (Step 1 Draw, Step 2 Auto-Select, Step 2 Commit) */}
          {handsOnSpot.kind === 'dom' && handsOnSpot.rect && handsOnSpot.rect.width > 15 && handsOnSpot.rect.height > 15 && (() => {
            const { left, top, width, height } = handsOnSpot.rect;
            const centerX = Math.max(150, Math.min(window.innerWidth - 150, left + width / 2));
            const bubbleTop = Math.max(64, top - 66);
            return (
              <>
                <div
                  className="hands-on-dom-spotlight"
                  style={{
                    left: `${left - 5}px`,
                    top: `${top - 5}px`,
                    width: `${width + 10}px`,
                    height: `${height + 10}px`
                  }}
                  onClick={() => getEngine()?.triggerTutorialStepAction?.()}
                />
                <div
                  className="hands-on-pointer-bubble dom-target"
                  style={{
                    left: `${centerX}px`,
                    top: `${bubbleTop}px`
                  }}
                  onClick={() => getEngine()?.triggerTutorialStepAction?.()}
                  title="Bấm trực tiếp vào nút được khoanh sáng bên dưới!"
                >
                  <div className="hop-content">
                    <span className="hop-step-pill">{handsOnSpot.stepBadge}</span>
                    <span className="hop-action-label">{handsOnSpot.actionText}</span>
                    <button
                      type="button"
                      className="hop-skip-x"
                      onClick={(e) => {
                        e.stopPropagation();
                        finishHandsOnTutorial();
                      }}
                      title="Tắt hướng dẫn cầm tay chỉ việc"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="hop-bouncing-hand" aria-hidden="true">
                    👇
                  </div>
                </div>
              </>
            );
          })()}

          {/* Case 2: Pointing Directly at a 3D Chess Piece or 3D Destination Square on the WebGL Canvas */}
          {handsOnSpot.kind === 'board3d' && handsOnSpot.point && (() => {
            const px = Math.max(150, Math.min(window.innerWidth - 150, handsOnSpot.point.x));
            const py = Math.max(120, Math.min(window.innerHeight - 120, handsOnSpot.point.y));
            return (
              <>
                <div
                  className={`hands-on-3d-reticle ${handsOnSpot.isCapture ? 'capture-reticle' : ''}`}
                  style={{
                    left: `${px}px`,
                    top: `${py}px`
                  }}
                  aria-hidden="true"
                >
                  <span className="reticle-ring-outer" />
                  <span className="reticle-ring-inner" />
                </div>

                <div
                  className={`hands-on-pointer-bubble board-target ${
                    handsOnSpot.isCapture ? 'capture-bubble' : ''
                  }`}
                  style={{
                    left: `${px}px`,
                    top: `${Math.max(62, py - 92)}px`
                  }}
                  onClick={() => getEngine()?.triggerTutorialStepAction?.()}
                >
                  <div className="hop-content">
                    <span className="hop-step-pill">{handsOnSpot.stepBadge}</span>
                    <div className="hop-text-stack">
                      <span className="hop-action-label">{handsOnSpot.actionText}</span>
                      {handsOnSpot.subHint && (
                        <span className="hop-sub-hint">{handsOnSpot.subHint}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="hop-skip-x"
                      onClick={(e) => {
                        e.stopPropagation();
                        finishHandsOnTutorial();
                      }}
                      title="Tắt hướng dẫn cầm tay chỉ việc"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="hop-bouncing-hand" aria-hidden="true">
                    👇
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* BOTTOM HUD (PRESERVES REQUIRED TEST IDS #controls-hint AND #captured-tray) */}
      <div id="hud-bottom">
        <div className="hint-pill" id="controls-hint">
          <strong>Chuẩn Hearthstone:</strong> ① Bốc Bài ➔ ② Kích Hoạt Phép (💎Mana) ➔ ③ Gắn Buff Quân Cờ ➔ ④ Đi Quân &amp; Combat
        </div>
        <div className="captured-pill" id="captured-tray"></div>
      </div>

      {/* MOBILE PORTRAIT ORIENTATION ENCOURAGEMENT OVERLAY */}
      {isPortrait && !dismissPortraitPrompt && (
        <aside
          className="portrait-orientation-overlay"
          role="region"
          aria-label="Cảnh báo xoay màn hình ngang"
        >
          <div className="portrait-orientation-card">
            <div className="rotate-phone-anim">
              <span className="phone-icon">📱</span>
              <span className="rotate-arrow">⟳</span>
            </div>
            <h2 className="rotate-title">VUI LÒNG XOAY NGANG MÀN HÌNH</h2>
            <p className="rotate-desc">
              Game Poker Chess 3D được thiết kế tối ưu nhất ở chế độ màn hình nằm ngang (Landscape) để quan sát trọn vẹn bàn cờ và bộ bài phép.
            </p>
            <div className="rotate-actions">
              <button
                type="button"
                className="rotate-btn primary"
                onClick={async () => {
                  await requestLandscapeLock();
                }}
              >
                ⛶ Toàn Màn Hình &amp; Xoay Ngang
              </button>
              <button
                type="button"
                className="rotate-btn secondary"
                onClick={() => setDismissPortraitPrompt(true)}
              >
                Tiếp Tục Chế Độ Dọc
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* PWA ADD TO HOME SCREEN FIRST-TIME PROMPT MODAL */}
      {showA2HSModal && !isInstalledApp && (
        <div
          className="a2hs-modal-backdrop"
          onClick={handleDismissA2HS}
          role="dialog"
          aria-modal="true"
        >
          <div className="a2hs-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="a2hs-badge-row">
              <span className="a2hs-app-icon">👑</span>
              <div className="a2hs-app-info">
                <h3 className="a2hs-title">CÀI ĐẶT POKER CHESS 3D</h3>
                <span className="a2hs-subtitle">Thêm Vào Màn Hình Chính (Web App Native)</span>
              </div>
            </div>

            <p className="a2hs-benefit-text">
              ✨ <strong>Trải nghiệm tối đa:</strong> Chơi mượt mà toàn màn hình, đồ họa sắc nét, không bị che bởi thanh công cụ và mở game ngay lập tức từ màn hình chính!
            </p>

            {isIOSDevice ? (
              <div className="a2hs-ios-guide">
                <div className="ios-step">
                  <span className="step-num">1</span>
                  <span>Nhấn nút <strong>Chia sẻ</strong> <span className="ios-icon">⎋</span> ở thanh dưới Safari</span>
                </div>
                <div className="ios-step">
                  <span className="step-num">2</span>
                  <span>Cuộn xuống chọn <strong>Thêm vào MH chính</strong> <span className="ios-icon">➕</span></span>
                </div>
                <div className="ios-step">
                  <span className="step-num">3</span>
                  <span>Bấm <strong>Thêm (Add)</strong> ở góc trên bên phải để hoàn tất</span>
                </div>
              </div>
            ) : (
              <div className="a2hs-actions">
                <button
                  type="button"
                  className="a2hs-install-btn"
                  onClick={handleInstallAppClick}
                >
                  📲 Cài Đặt Vào Màn Hình Chính Ngay
                </button>
              </div>
            )}

            <button
              type="button"
              className="a2hs-dismiss-btn"
              onClick={handleDismissA2HS}
            >
              Để Sau • Chơi Tiếp Tục Trên Trình Duyệt ➔
            </button>
          </div>
        </div>
      )}

      {/* COMPREHENSIVE MAIN MENU MODAL */}
      {mainMenuOpen && (
        <div
          className="main-menu-backdrop"
          onClick={() => setMainMenuOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          {/* Ethereal background floating mana motes */}
          <div className="menu-magic-particles" aria-hidden="true">
            <span className="magic-spark spark-1" />
            <span className="magic-spark spark-2" />
            <span className="magic-spark spark-3" />
            <span className="magic-spark spark-4" />
            <span className="magic-spark spark-5" />
            <span className="magic-spark spark-6" />
          </div>

          <div
            className="main-menu-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ornamental gold corner runes & ambient gleam */}
            <div className="card-corner-rune top-left" aria-hidden="true" />
            <div className="card-corner-rune top-right" aria-hidden="true" />
            <div className="card-corner-rune bottom-left" aria-hidden="true" />
            <div className="card-corner-rune bottom-right" aria-hidden="true" />
            <div className="menu-light-sweep" aria-hidden="true" />

            <div className="main-menu-header">
              <div className="main-menu-title-wrap">
                <span className="main-menu-crest">👑</span>
                <div>
                  <h2 className="main-menu-title">VƯƠNG QUYỀN • POKER CHESS 3D</h2>
                  <div className="main-menu-subtitle">Hệ Thống Menu Chiến Thuật &amp; Điều Khiển Toàn Diện</div>
                </div>
              </div>
              <button
                type="button"
                className="main-menu-close-btn"
                onClick={() => setMainMenuOpen(false)}
                title="Đóng Menu Chính"
              >
                ✕
              </button>
            </div>

            {/* Profile Ribbon */}
            <div className="main-menu-profile-ribbon">
              <div className="profile-ribbon-left">
                <span className="profile-avatar">🧙</span>
                <span className="profile-name">
                  {gameState?.commercial?.rankInfo?.tierNameVi
                    ? `${gameState.commercial.rankInfo.tierNameVi} • Kỳ Thủ`
                    : 'Kỳ Thủ Vương Quyền'}
                </span>
                <span className="profile-rank-tag">
                  {gameState?.commercial?.rankInfo?.tierIcon || '🏆'} {gameState?.commercial?.elo ?? 1000} Elo
                </span>
              </div>
              <div className="profile-ribbon-right">
                <span className="profile-gold-badge">
                  🪙 {(gameState?.commercial?.gold ?? 0).toLocaleString()} Vàng
                </span>
              </div>
            </div>

            {/* Menu Body Cards Grid */}
            <div className="main-menu-body">
              <div className="main-menu-grid">
                {/* 1. Single Player vs AI Card */}
                <div className="menu-card-btn card-ai">
                  <div className="menu-card-header">
                    <span className="menu-card-icon">🤖</span>
                    <span className="menu-card-badge bot-badge">Chơi Đơn • AI</span>
                  </div>
                  <h3 className="menu-card-title">Đấu Với Máy (Luyện Tập)</h3>
                  <p className="menu-card-desc">
                    Luyện cờ Poker Chess theo cấp độ Bot Elo. Không tính điểm xếp hạng Online.
                  </p>

                  <div className="sp-config-tray">
                    <div className="sp-config-row">
                      <span className="sp-config-label">Chọn Phe:</span>
                      <div className="sp-chip-group">
                        <button
                          type="button"
                          className={`sp-chip-btn ${spSide === 'w' ? 'active' : ''}`}
                          onClick={() => setSpSide('w')}
                        >
                          ⚪ Trắng (Trước)
                        </button>
                        <button
                          type="button"
                          className={`sp-chip-btn ${spSide === 'b' ? 'active' : ''}`}
                          onClick={() => setSpSide('b')}
                        >
                          ⚫ Đen (Sau)
                        </button>
                      </div>
                    </div>

                    <div className="sp-config-row">
                      <span className="sp-config-label">Cấp Độ Bot:</span>
                      <div className="sp-chip-group">
                        <button
                          type="button"
                          className={`sp-chip-btn ${spBotLevel === 1 ? 'active' : ''}`}
                          onClick={() => setSpBotLevel(1)}
                        >
                          🥉 Dễ (800)
                        </button>
                        <button
                          type="button"
                          className={`sp-chip-btn ${spBotLevel === 2 ? 'active' : ''}`}
                          onClick={() => setSpBotLevel(2)}
                        >
                          🥈 Vừa (1100)
                        </button>
                        <button
                          type="button"
                          className={`sp-chip-btn ${spBotLevel === 3 ? 'active' : ''}`}
                          onClick={() => setSpBotLevel(3)}
                        >
                          🥇 Khó (1400)
                        </button>
                        <button
                          type="button"
                          className={`sp-chip-btn ${spBotLevel === 4 ? 'active' : ''}`}
                          onClick={() => setSpBotLevel(4)}
                        >
                          💎 Thầy (1700)
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="sp-start-btn"
                      onClick={() => {
                        getEngine()?.startSinglePlayerMatch?.(spSide, spBotLevel);
                        setMainMenuOpen(false);
                      }}
                    >
                      ⚔️ Bắt Đầu Trận Đấu Máy
                    </button>
                  </div>
                </div>

                {/* 2. Realtime 1v1 Online Card */}
                <div
                  className="menu-card-btn featured-online"
                  onClick={() => {
                    setOnlineModalOpen(true);
                    setMainMenuOpen(false);
                  }}
                >
                  <div className="menu-card-header">
                    <span className="menu-card-icon">⚔️</span>
                    <span className="menu-card-badge online-badge">
                      🟢 Trực Tuyến ({serverStats.onlinePlayers} Người)
                    </span>
                  </div>
                  <h3 className="menu-card-title">Đấu Online 1vs1 Thời Gian Thực</h3>
                  <p className="menu-card-desc">
                    Ghép trận Realtime Matchmaking (100 CCU Server) theo Rank Elo, hoặc tự tạo phòng thách đấu riêng cùng bạn bè!
                  </p>
                  <button type="button" className="custom-room-btn primary" style={{ marginTop: 'auto' }}>
                    ⚡ Vào Sảnh Đấu Online ➔
                  </button>
                </div>

                {/* 3. Skin Store Card */}
                <div
                  className="menu-card-btn card-skin"
                  onClick={() => {
                    setStoreTab('skins');
                    setSkinStoreOpen(true);
                    setMainMenuOpen(false);
                  }}
                >
                  <div className="menu-card-header">
                    <span className="menu-card-icon">🛒</span>
                    <span className="menu-card-badge">Vật Phẩm 3D</span>
                  </div>
                  <h3 className="menu-card-title">Kho Skin 3D Quân Cờ</h3>
                  <p className="menu-card-desc">
                    Trang bị &amp; thử nghiệm các bộ skin 3D độc quyền: Neon Cyberpunk, Huyết Nguyệt, Bạch Kim Tối Thượng.
                  </p>
                  <button type="button" className="custom-room-btn" style={{ marginTop: 'auto' }}>
                    Mở Kho Skin ➔
                  </button>
                </div>

                {/* 4. Elo Leaderboard Card */}
                <div
                  className="menu-card-btn card-leaderboard"
                  onClick={() => {
                    setStoreTab('elo');
                    setSkinStoreOpen(true);
                    setMainMenuOpen(false);
                  }}
                >
                  <div className="menu-card-header">
                    <span className="menu-card-icon">🏆</span>
                    <span className="menu-card-badge online-badge">Xếp Hạng</span>
                  </div>
                  <h3 className="menu-card-title">Bảng Xếp Hạng Elo</h3>
                  <p className="menu-card-desc">
                    Xem thứ hạng kỳ thủ toàn cầu, các mốc thăng hạng từ Tân Binh Đồng đến Đại Kiện Tướng và phần thưởng mùa giải.
                  </p>
                  <button type="button" className="custom-room-btn" style={{ marginTop: 'auto' }}>
                    Xem BXH Elo ➔
                  </button>
                </div>

                {/* 5. Rules & Codex Card */}
                <div
                  className="menu-card-btn card-codex"
                  onClick={() => {
                    setRulesModalOpen(true);
                    setMainMenuOpen(false);
                  }}
                >
                  <div className="menu-card-header">
                    <span className="menu-card-icon">📖</span>
                    <span className="menu-card-badge">Sổ Tay</span>
                  </div>
                  <h3 className="menu-card-title">Luật Chơi &amp; Sổ Tay Phép Bài</h3>
                  <p className="menu-card-desc">
                    Chi tiết 9 cấp bậc Poker, thuộc tính RPG Công ⚔, Giáp 🛡, Máu ❤ và hiệu ứng đặc biệt của các Ô Thánh Tích.
                  </p>
                  <button type="button" className="custom-room-btn" style={{ marginTop: 'auto' }}>
                    Mở Sổ Tay Luật ➔
                  </button>
                </div>
              </div>

              {/* Settings, Camera & Audio Controls Quick Strip */}
              <div className="sp-config-tray" style={{ marginTop: '4px' }}>
                <div className="sp-config-row">
                  <span className="sp-config-label">⚙️ Cài Đặt Nhanh:</span>
                  <div className="sp-chip-group">
                    <button
                      type="button"
                      className="sp-chip-btn"
                      onClick={() => getEngine()?.toggleBattleMusic?.()}
                    >
                      {gameState?.bgmPlaying ? '🎵 Tắt BGM' : '🎵 Bật BGM'}
                    </button>
                    <button
                      type="button"
                      className="sp-chip-btn"
                      onClick={() => getEngine()?.toggleSoundMute?.()}
                    >
                      {gameState?.sfxMuted ? '🔊 Bật SFX' : '🔇 Tắt SFX'}
                    </button>
                    <button
                      type="button"
                      className="sp-chip-btn"
                      onClick={() => setHandsOnActive((prev) => !prev)}
                    >
                      {handsOnActive ? '💡 Chỉ Việc: BẬT' : '💡 Chỉ Việc: TẮT'}
                    </button>
                    <button
                      type="button"
                      className="sp-chip-btn"
                      onClick={() => {
                        getEngine()?.restartGame?.();
                        setMainMenuOpen(false);
                      }}
                    >
                      🔄 Reset Ván Mới
                    </button>
                  </div>
                </div>
              </div>

              {/* DONATE / COFFEE SUPPORT SECTION IN MAIN MENU */}
              <div className="checkmate-donate-card" style={{ margin: '8px 0 0', maxWidth: '100%' }}>
                <div className="donate-header">
                  <span className="donate-badge">☕ ỦNG HỘ TÁC GIẢ (DONATE)</span>
                  <span className="donate-tagline">Tiếp lửa phát triển &amp; duy trì máy chủ Poker Chess 3D</span>
                </div>
                <div className="donate-body">
                  <div className="donate-qr-wrapper">
                    <img
                      src={donateQrImage}
                      alt="Mã VietQR Donate - TRƯƠNG MINH HOÀNG"
                      className="donate-qr-img"
                      loading="lazy"
                    />
                  </div>
                  <div className="donate-info">
                    <p className="donate-message">
                      Cảm ơn bạn đã trải nghiệm trò chơi! Nếu yêu thích Poker Chess 3D, hãy ủng hộ tác giả một ly cà phê nhé!
                    </p>
                    <div className="donate-details">
                      <div className="donate-row">
                        <span className="d-label">Chủ TK:</span>
                        <span className="d-val d-name">TRUONG MINH HOANG</span>
                      </div>
                      <div className="donate-row">
                        <span className="d-label">Ngân hàng:</span>
                        <span className="d-val">MB Bank (Quân Đội)</span>
                      </div>
                      <div className="donate-row">
                        <span className="d-label">Số TK:</span>
                        <span className="d-val d-acc">0937057055</span>
                        <button
                          type="button"
                          className="donate-copy-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (navigator.clipboard) {
                              navigator.clipboard.writeText('0937057055');
                            }
                            const target = e.currentTarget;
                            target.textContent = '✓ Đã chép!';
                            setTimeout(() => {
                              target.textContent = '📋 Chép STK';
                            }, 2000);
                          }}
                          title="Sao chép số tài khoản"
                        >
                          📋 Chép STK
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1VS1 ONLINE MULTIPLAYER REALTIME MODAL */}
      {onlineModalOpen && (
        <div
          className="main-menu-backdrop"
          onClick={() => {
            if (isSearchingMatch) {
              multiplayerClient.leaveMatchmaking();
              setIsSearchingMatch(false);
            }
            setOnlineModalOpen(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="online-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="main-menu-header">
              <div className="main-menu-title-wrap">
                <span className="main-menu-crest">⚔️</span>
                <div>
                  <h2 className="main-menu-title">ĐẤU ONLINE 1VS1 THỜI GIAN THỰC</h2>
                  <div className="main-menu-subtitle">Máy Chủ Phục Vụ 100 Kỳ Thủ • Realtime Move Sync</div>
                </div>
              </div>
              <button
                type="button"
                className="main-menu-close-btn"
                onClick={() => {
                  if (isSearchingMatch) {
                    multiplayerClient.leaveMatchmaking();
                    setIsSearchingMatch(false);
                  }
                  setOnlineModalOpen(false);
                }}
              >
                ✕
              </button>
            </div>

            {/* Server Status Header */}
            <div className="online-server-status-bar">
              <span>
                <span className="online-status-dot" />
                Máy Chủ Trực Tuyến: <strong>{serverStats.onlinePlayers}</strong> người chơi đang online
              </span>
              <span>
                ⚔️ <strong>{serverStats.activeMatches}</strong> trận đang đấu • ⏳ <strong>{serverStats.queuedPlayers}</strong> người trong hàng chờ
              </span>
            </div>

            {/* Case A: Match Found Transition Screen */}
            {matchFoundInfo ? (
              <div className="match-found-banner">
                <h3 style={{ color: '#fde047', margin: 0, fontSize: '1.2rem', textTransform: 'uppercase' }}>
                  🔥 ĐÃ TÌM THẤY TRẬN ĐẤU!
                </h3>
                <div className="match-found-versus">
                  <div className="vs-combatant-card">
                    <span className="vs-icon-badge">🧙</span>
                    <span className="vs-name">Bạn</span>
                    <span className="vs-role">
                      {matchFoundInfo.myColor === 'w' ? '⚪ Quân Trắng (Đi Trước)' : '⚫ Quân Đen (Đi Sau)'}
                    </span>
                  </div>

                  <span className="vs-sep-badge">VS</span>

                  <div className="vs-combatant-card">
                    <span className="vs-icon-badge">👤</span>
                    <span className="vs-name">{matchFoundInfo.opponent?.name || 'Đối Thủ Bí Ẩn'}</span>
                    <span className="vs-role">
                      🏆 {matchFoundInfo.opponent?.elo || 1050} Elo • {matchFoundInfo.myColor === 'w' ? '⚫ Quân Đen' : '⚪ Quân Trắng'}
                    </span>
                  </div>
                </div>
                <div style={{ color: '#38bdf8', fontSize: '0.85rem', fontWeight: 700 }}>
                  Đang khởi tạo bàn cờ 3D và bước vào trận chiến...
                </div>
              </div>
            ) : isSearchingMatch ? (
              /* Case B: Searching Radar Pulse Screen */
              <div className="online-radar-container">
                <div className="radar-circle-wrap">
                  <div className="radar-ring" />
                  <div className="radar-ring" />
                  <div className="radar-ring" />
                  <span className="radar-center-icon">📡</span>
                </div>
                <h3 className="radar-title">Đang Tìm Đối Thủ Ngang Trình Elo...</h3>
                <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                  Hệ thống đang ghép cặp người chơi có điểm xếp hạng tương đương trên máy chủ
                </div>
                <div className="radar-timer">
                  00:{String(searchQueueSeconds).padStart(2, '0')}
                </div>
                <button
                  type="button"
                  className="radar-cancel-btn"
                  onClick={() => {
                    multiplayerClient.leaveMatchmaking();
                    setIsSearchingMatch(false);
                  }}
                >
                  ✕ Hủy Tìm Trận
                </button>
              </div>
            ) : (
              /* Case C: Online Lobby Idle State */
              <div className="main-menu-body">
                {/* 1. Quick Matchmaking Option */}
                <div
                  className="menu-card-btn featured-online"
                  onClick={() => {
                    multiplayerClient.joinMatchmaking();
                    setIsSearchingMatch(true);
                    setSearchQueueSeconds(0);
                  }}
                >
                  <div className="menu-card-header">
                    <span className="menu-card-icon">⚡</span>
                    <span className="menu-card-badge online-badge">Xếp Hạng Elo</span>
                  </div>
                  <h3 className="menu-card-title">Tìm Trận Nhanh (Ranked Match)</h3>
                  <p className="menu-card-desc">
                    Tự động tìm kiếm đối thủ gần mức Elo của bạn. Chiến thắng nhận thưởng Elo và Vàng tích lũy!
                  </p>
                  <button type="button" className="custom-room-btn primary" style={{ marginTop: 'auto' }}>
                    🎮 Bắt Đầu Tìm Trận Ngay
                  </button>
                </div>

                {/* 2. Custom Room Section */}
                <div className="online-custom-room-section">
                  <div className="custom-room-title">🏰 Phòng Tùy Chỉnh (Giao Hữu Bạn Bè)</div>

                  <div className="custom-room-row">
                    <button
                      type="button"
                      className="custom-room-btn"
                      onClick={() => multiplayerClient.createCustomRoom()}
                    >
                      🎲 Tạo Mã Phòng Mới
                    </button>
                    {createdRoomCode && (
                      <span style={{ color: '#fde047', fontSize: '0.82rem', fontWeight: 800 }}>
                        Mã của bạn: <strong>{createdRoomCode}</strong>
                      </span>
                    )}
                  </div>

                  <div className="custom-room-row">
                    <input
                      type="text"
                      className="custom-room-input"
                      placeholder="Nhập mã phòng 4 ký tự (VD: A8K2)..."
                      maxLength={6}
                      value={customRoomInput}
                      onChange={(e) => setCustomRoomInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customRoomInput.trim()) {
                          multiplayerClient.joinCustomRoom(customRoomInput.trim().toUpperCase());
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="custom-room-btn primary"
                      disabled={!customRoomInput.trim()}
                      onClick={() => {
                        if (customRoomInput.trim()) {
                          multiplayerClient.joinCustomRoom(customRoomInput.trim().toUpperCase());
                        }
                      }}
                    >
                      Vào Phòng ➔
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RULES & COMBO CODEX MODAL */}
      {rulesModalOpen && (
        <div
          className="codex-modal-backdrop"
          onClick={() => setRulesModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="codex-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="codex-modal-header">
              <div>
                <div className="codex-subtitle">CẨM NANG CHIẾN THUẬT HEARTHSTONE CHESS</div>
                <h2 className="codex-title">VƯƠNG QUYỀN — BỐC BÀI • GẮN BUFF • COMBAT</h2>
              </div>
              <button
                type="button"
                className="codex-close-btn"
                onClick={() => setRulesModalOpen(false)}
              >
                Đóng ✕
              </button>
            </div>

            <div className="codex-modal-body">
              <div className="codex-section">
                <h3>1. Trình Tự 4 Bước Mỗi Lượt Chuẩn Hearthstone</h3>
                <ul className="codex-list">
                  <li>
                    <strong>Bước 1 — Bốc Bài &amp; Nạp Tinh Thể Mana (Draw Phase):</strong> Đầu mỗi lượt, giới hạn Mana tăng thêm +1💎 (tối đa 10💎) và nạp đầy. Bạn phải bấm <strong>Bốc Bài Đầu Lượt</strong> để rút thêm 5 lá mới từ Cỗ Bài (cùng 2 lá giữ lại từ lượt trước tạo thành 7 lá trên tay).
                  </li>
                  <li>
                    <strong>Bước 2 — Kích Hoạt Bài Phép (Cast Spell):</strong> Chọn 5 lá bài để ghép thành 1 Bài Phép Hearthstone, tiêu hao từ <strong>1💎 đến 5💎 Mana</strong> (có thể dùng <em>Đồng Xu Linh Lực +2💎</em>).
                  </li>
                  <li>
                    <strong>Bước 3 — Gắn Buff Cho Quân Cờ (Buff Minion):</strong> Click trực tiếp vào <strong>1 quân cờ đồng minh trên bàn 3D</strong> (hoặc chọn trong thanh Gắn Buff Nhanh) để truyền chỉ số <strong>+Công ⚔, +Giáp 🛡, +Máu ❤</strong> và Hiệu Ứng Phép.
                  </li>
                  <li>
                    <strong>Bước 4 — Đi Quân &amp; Giao Chiến (Move &amp; Minion Combat):</strong> Chỉ sau khi hoàn tất Gắn Buff, bàn cờ mới mở khóa cho phép di chuyển quân hoặc lao vào đâm sầm (Ramming Minion Combat) như Hearthstone!
                  </li>
                </ul>
              </div>

              <div className="codex-section">
                <h3>2. Hệ Thống 9 Combo Poker &amp; 2 Quyền Năng Tối Thượng</h3>
                <div className="codex-table-wrap">
                  <table className="codex-table">
                    <thead>
                      <tr>
                        <th>Combo Poker</th>
                        <th>Chỉ Số Cộng Thêm</th>
                        <th>Quyền Năng Chiến Thuật / Ultimate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(POKER_COMBO_DEFS).map((c: any) => (
                        <tr key={c.id} className={c.isUltimate ? 'ultimate-row' : ''}>
                          <td style={{ color: c.colorHex, fontWeight: 700 }}>{c.name}</td>
                          <td>
                            {c.isUltimate
                              ? 'ULTIMATE'
                              : `+${c.atkBonus}⚔ Công | +${c.armorBonus}🛡 Giáp${
                                  c.healInstant > 0 ? ` | +${c.healInstant}❤ Máu` : ''
                                }`}
                          </td>
                          <td>{c.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="codex-section">
                <h3>3. Chỉ Số Khởi Điểm (Lv.1) &amp; Kỹ Năng Đặc Trưng 6 Quân Cờ</h3>
                <div className="codex-table-wrap">
                  <table className="codex-table">
                    <thead>
                      <tr>
                        <th>Quân Cờ</th>
                        <th>Lv.1 (Công / Máu)</th>
                        <th>Lv.5 (Công / Máu)</th>
                        <th>Kỹ Năng Đặc Trưng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(UNIT_BASE_STATS).map(([type, st]) => {
                        const sk = UNIT_SKILLS[type as keyof typeof UNIT_SKILLS];
                        return (
                          <tr key={type}>
                            <td>
                              <strong>
                                {st.icon} {st.name}
                              </strong>
                            </td>
                            <td>
                              {st.atk}⚔ / {st.hp}❤
                            </td>
                            <td>
                              {st.atk + 4}⚔ / {st.hp + 16}❤
                            </td>
                            <td>
                              <strong>{sk.name}:</strong> {sk.desc}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COMMERCIAL SKIN COLLECTION STORE (10 3D SETS) & ELO RANKED PROGRESSION MODAL */}
      {skinStoreOpen && (() => {
        const comm = gameState?.commercial;
        const currentElo = comm?.elo ?? 1000;
        const peakElo = Math.max(currentElo, comm?.peakElo ?? 1000);
        const currentGold = comm?.gold ?? 0;
        const ownedIds = comm?.ownedSkinIds || ['classic_sanctum'];
        const equippedId = comm?.equippedSkinId || 'classic_sanctum';
        const previewId = comm?.previewSkinId || null;
        const rankInfo = comm?.rankInfo || getEloRankInfo(currentElo);

        const filteredSkins = CHESS_SKIN_CATALOG.filter((skin) => {
          if (skinFilter === 'gold') return skin.requiredElo === 0 && skin.goldCost > 0;
          if (skinFilter === 'elo') return skin.requiredElo > 0;
          if (skinFilter === 'owned') return ownedIds.includes(skin.id);
          return true;
        });

        const equippedSkinObj =
          CHESS_SKIN_CATALOG.find((s) => s.id === equippedId) || CHESS_SKIN_CATALOG[0];

        return (
          <div
            className="codex-modal-backdrop skin-store-backdrop"
            onClick={() => {
              if (previewId) {
                getEngine()?.previewChessSkin3D?.(null);
              }
              setSkinStoreOpen(false);
            }}
            role="dialog"
            aria-modal="true"
            id="skin-store-modal"
          >
            <div
              className="codex-modal-card skin-store-modal-card"
              onClick={(e) => e.stopPropagation()}
            >
              {/* MODAL HEADER */}
              <div className="skin-store-header">
                <div className="skin-store-title-group">
                  <div className="codex-subtitle">
                    🏛️ THÁNH ĐƯỜNG VƯƠNG QUYỀN • BỘ SƯU TẬP &amp; XẾP HẠNG ELO
                  </div>
                  <h2 className="codex-title">
                    10 BỘ SKIN CỜ 3D &amp; HỆ THỐNG ELO XẾP HẠNG
                  </h2>
                </div>

                <div className="skin-store-wallet-strip">
                  <div
                    className="store-stat-pill elo"
                    style={{ borderColor: rankInfo.tierColor }}
                    title={`Elo cao nhất đạt được: ${peakElo} Elo`}
                  >
                    <span className="stat-icon">{rankInfo.tierIcon}</span>
                    <div className="stat-meta">
                      <span className="stat-label">{rankInfo.tierNameVi}</span>
                      <strong className="stat-val" style={{ color: rankInfo.tierColor }}>
                        {currentElo} ELO
                      </strong>
                    </div>
                  </div>

                  <div className="store-stat-pill gold">
                    <span className="stat-icon">🪙</span>
                    <div className="stat-meta">
                      <span className="stat-label">Ngân Khố Vàng</span>
                      <strong className="stat-val">{currentGold.toLocaleString()} Vàng</strong>
                    </div>
                  </div>

                  <div className="store-stat-pill collection">
                    <span className="stat-icon">♟️</span>
                    <div className="stat-meta">
                      <span className="stat-label">Bộ Sưu Tập</span>
                      <strong className="stat-val">
                        {ownedIds.length} / {CHESS_SKIN_CATALOG.length} Skin
                      </strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="codex-close-btn"
                    onClick={() => {
                      if (previewId) {
                        getEngine()?.previewChessSkin3D?.(null);
                      }
                      setSkinStoreOpen(false);
                    }}
                  >
                    Đóng ✕
                  </button>
                </div>
              </div>

              {/* FAIR-PLAY COSMETIC GUARANTEE & QUICK EARN BAR */}
              <div className="skin-store-fairplay-banner">
                <div className="fairplay-badge-text">
                  <span className="fairplay-shield">✨ CAM KẾT THƯƠNG MẠI FAIR-PLAY:</span>
                  <span>
                    Mọi bộ Skin cờ chỉ thay đổi <strong>ngoại hình điêu khắc 3D, bàn cờ và hào quang kiếm khí</strong> —{' '}
                    <strong>KHÔNG tăng sức mạnh hay cộng chỉ số chiến đấu</strong>. Đang trang bị:{' '}
                    <strong style={{ color: equippedSkinObj.rarityColor }}>
                      {equippedSkinObj.icon} {equippedSkinObj.nameVi}
                    </strong>
                    {previewId && (
                      <span className="live-preview-pill">
                        👁 Đang xem thử trên bàn 3D:{' '}
                        {CHESS_SKIN_CATALOG.find((s) => s.id === previewId)?.nameVi}
                      </span>
                    )}
                  </span>
                </div>

                <div className="skin-store-quick-actions">
                  <div className="grind-reward-pill" title="Cơ chế tự cày Elo & Vàng trong ván đấu thực chiến">
                    <span>⚔ Hạ quân địch: <strong>+25~150 🪙</strong></span>
                    <span>•</span>
                    <span>🏆 Thắng ván cờ: <strong>+36 Elo &amp; +200~450 🪙</strong></span>
                  </div>
                  <button
                    type="button"
                    className="store-earn-btn ranked"
                    onClick={() => {
                      if (previewId) {
                        getEngine()?.previewChessSkin3D?.(null);
                      }
                      setSkinStoreOpen(false);
                    }}
                    title="Đóng cửa hàng và vào bàn cờ 3D để tự cày Elo & Vàng qua thực chiến"
                  >
                    ⚔ Vào Bàn Cờ Thực Chiến
                  </button>
                </div>
              </div>

              {storeFeedback && (
                <div className={`store-feedback-toast ${storeFeedback.type}`}>
                  <span>{storeFeedback.text}</span>
                  <button type="button" onClick={() => setStoreFeedback(null)}>
                    ✕
                  </button>
                </div>
              )}

              {/* TABS & SKIN FILTER BAR */}
              <div className="skin-store-nav-bar">
                <div className="skin-store-tabs">
                  <button
                    type="button"
                    className={`store-tab-btn ${storeTab === 'skins' ? 'active' : ''}`}
                    onClick={() => setStoreTab('skins')}
                  >
                    🎨 Cửa Hàng 10 Bộ Skin Cờ 3D ({CHESS_SKIN_CATALOG.length})
                  </button>
                  <button
                    type="button"
                    className={`store-tab-btn ${storeTab === 'elo' ? 'active' : ''}`}
                    onClick={() => setStoreTab('elo')}
                  >
                    🏆 Hệ Thống Bậc Rank Elo ({ELO_RANK_TIERS.length} Bậc)
                  </button>
                </div>

                {storeTab === 'skins' && (
                  <div className="skin-store-filters">
                    <button
                      type="button"
                      className={`skin-filter-chip ${skinFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setSkinFilter('all')}
                    >
                      Tất Cả (10)
                    </button>
                    <button
                      type="button"
                      className={`skin-filter-chip ${skinFilter === 'gold' ? 'active' : ''}`}
                      onClick={() => setSkinFilter('gold')}
                    >
                      🪙 Mua Bằng Vàng (3)
                    </button>
                    <button
                      type="button"
                      className={`skin-filter-chip ${skinFilter === 'elo' ? 'active' : ''}`}
                      onClick={() => setSkinFilter('elo')}
                    >
                      🏆 Mở Khóa Đủ Elo (6)
                    </button>
                    <button
                      type="button"
                      className={`skin-filter-chip ${skinFilter === 'owned' ? 'active' : ''}`}
                      onClick={() => setSkinFilter('owned')}
                    >
                      ✓ Đã Sở Hữu ({ownedIds.length})
                    </button>
                  </div>
                )}
              </div>

              {/* MODAL BODY */}
              <div className="codex-modal-body skin-store-body">
                {storeTab === 'skins' ? (
                  <div className="skin-catalog-grid">
                    {filteredSkins.map((skin) => {
                      const isOwned = ownedIds.includes(skin.id);
                      const isEquipped = equippedId === skin.id;
                      const isPreviewing = previewId === skin.id;
                      const eloMet = peakElo >= skin.requiredElo;
                      const canAffordGold = currentGold >= skin.goldCost;
                      const sw = skin.previewSwatches;

                      return (
                        <div
                          key={skin.id}
                          className={`skin-card-item ${isEquipped ? 'equipped' : ''} ${
                            isOwned ? 'owned' : ''
                          } ${!eloMet && !isOwned ? 'elo-locked' : ''}`}
                          style={
                            {
                              '--skin-accent': skin.rarityColor,
                              '--skin-trail': sw.trailHex
                            } as React.CSSProperties
                          }
                        >
                          {/* Top Rarity & Index Header */}
                          <div className="skin-card-top">
                            <span className="skin-index-tag">BỘ #{skin.index}</span>
                            <span
                              className="skin-rarity-badge"
                              style={{
                                color: skin.rarityColor,
                                borderColor: `${skin.rarityColor}66`,
                                background: `${skin.rarityColor}1a`
                              }}
                            >
                              ✦ {skin.rarity}
                            </span>
                          </div>

                          {/* Bespoke 3D Sculpted Model Silhouette Showcase & Material Swatches */}
                          <div className="skin-visual-stage">
                            <div className="skin-3d-blueprint-wrap">
                              {renderSkin3DModelSilhouette(skin)}
                            </div>

                            <div className="skin-swatch-row">
                              <span
                                className="swatch-dot"
                                style={{ background: sw.whiteHex }}
                                title="Tượng Quân Trắng"
                              />
                              <span
                                className="swatch-dot"
                                style={{ background: sw.blackHex }}
                                title="Tượng Quân Đen"
                              />
                              <span
                                className="swatch-dot"
                                style={{ background: sw.trimHex }}
                                title="Viền Vương Miện & Giáp"
                              />
                              <span
                                className="swatch-dot"
                                style={{ background: sw.bladeHex }}
                                title="Lưỡi Gươm / Cánh 3D"
                              />
                              <span
                                className="swatch-dot trail"
                                style={{
                                  background: sw.trailHex,
                                  boxShadow: `0 0 8px ${sw.trailHex}`
                                }}
                                title="Hào Quang Vũ Khí 3D"
                              />
                            </div>
                          </div>

                          {/* Title, Subtitle, Bespoke 3D Model Architecture Badge & Lore */}
                          <div className="skin-card-info">
                            <h3 className="skin-name-vi">{skin.nameVi}</h3>
                            <div className="skin-name-en">{skin.nameEn}</div>
                            {(skin as { modelBadgeVi?: string }).modelBadgeVi && (
                              <div
                                className="skin-model-arch-badge"
                                style={{
                                  borderColor: `${skin.rarityColor}66`,
                                  color: skin.rarityColor,
                                  background: `${skin.rarityColor}14`
                                }}
                              >
                                {(skin as { modelBadgeVi?: string }).modelBadgeVi}
                              </div>
                            )}
                            <p className="skin-lore-desc">{skin.loreVi}</p>
                            <div className="skin-cosmetic-pill">
                              🛡️ {skin.cosmeticOnlyTag}
                            </div>
                          </div>

                          {/* Unlock Requirements (Gold + Elo Threshold) */}
                          <div className="skin-requirements-box">
                            <div className="req-row">
                              <span className="req-label">Giá Mở Khóa:</span>
                              <strong className="req-val gold">
                                {skin.goldCost === 0
                                  ? 'Miễn Phí (Mặc Định)'
                                  : `🪙 ${skin.goldCost.toLocaleString()} Vàng`}
                              </strong>
                            </div>
                            <div className="req-row">
                              <span className="req-label">Điều Kiện Rank:</span>
                              <strong
                                className={`req-val ${
                                  skin.requiredElo === 0 || eloMet ? 'elo-ok' : 'elo-locked'
                                }`}
                              >
                                {skin.requiredElo === 0
                                  ? '✓ Không yêu cầu Elo'
                                  : eloMet
                                    ? `✓ Đạt ${skin.requiredElo}+ Elo`
                                    : `🔒 Cần ${skin.requiredElo} Elo (${skin.requiredRankName.split('(')[0].trim()})`}
                              </strong>
                            </div>
                          </div>

                          {/* Action Buttons: 3D Preview + Buy/Equip */}
                          <div className="skin-card-actions">
                            <button
                              type="button"
                              className={`skin-preview-btn ${isPreviewing ? 'active' : ''}`}
                              onClick={() => {
                                const nextPreview = isPreviewing ? null : skin.id;
                                getEngine()?.previewChessSkin3D?.(nextPreview);
                                setStoreFeedback({
                                  type: 'info',
                                  text: nextPreview
                                    ? `👁 Đang áp dụng thử nghiệm 3D bộ Skin "${skin.nameVi}" trực tiếp trên bàn cờ phía sau!`
                                    : `Đã quay về hiển thị bộ Skin đang trang bị.`
                                });
                              }}
                              title="Xem thử chất liệu 3D của bộ Skin này trực tiếp trên các quân cờ ngoài bàn đấu"
                            >
                              {isPreviewing ? '👁 Đang Xem 3D' : '👁 Thử 3D'}
                            </button>

                            {isEquipped ? (
                              <button
                                type="button"
                                className="skin-main-action-btn equipped"
                                disabled
                              >
                                ✓ Đang Trang Bị
                              </button>
                            ) : isOwned ? (
                              <button
                                type="button"
                                className="skin-main-action-btn equip"
                                onClick={() => {
                                  const res = getEngine()?.equipChessSkin?.(skin.id);
                                  if (res?.ok) {
                                    setStoreFeedback({
                                      type: 'success',
                                      text: `✨ Đã trang bị bộ Skin 3D "${skin.nameVi}" cho toàn bộ quân cờ!`
                                    });
                                  }
                                }}
                              >
                                ✨ Trang Bị Ngay
                              </button>
                            ) : !eloMet ? (
                              <button
                                type="button"
                                className="skin-main-action-btn locked-elo"
                                onClick={() => {
                                  setStoreFeedback({
                                    type: 'error',
                                    text: `🔒 Bộ Skin "${skin.nameVi}" yêu cầu đạt ${skin.requiredElo} Elo (Hiện tại: ${peakElo} Elo). Hãy chiến thắng các ván đấu trên bàn cờ để tăng điểm Elo xếp hạng!`
                                  });
                                }}
                              >
                                🔒 Cần {skin.requiredElo} Elo
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={`skin-main-action-btn buy ${
                                  !canAffordGold ? 'insufficient-gold' : ''
                                }`}
                                onClick={() => {
                                  const res = getEngine()?.buyAndEquipChessSkin?.(skin.id);
                                  if (res?.ok) {
                                    setStoreFeedback({
                                      type: 'success',
                                      text: `🎉 Chúc mừng! Đã mua và trang bị bộ Skin 3D "${skin.nameVi}" (-${skin.goldCost.toLocaleString()} Vàng)!`
                                    });
                                  } else if (res?.message) {
                                    setStoreFeedback({
                                      type: 'error',
                                      text: res.message
                                    });
                                  }
                                }}
                              >
                                🪙 Mua ({skin.goldCost.toLocaleString()})
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* TAB 2: ELO RANKED LADDER & UNLOCK MILESTONES */
                  <div className="elo-ladder-container">
                    <div className="elo-profile-hero">
                      <div className="elo-hero-badge" style={{ borderColor: rankInfo.tierColor }}>
                        <span className="elo-hero-icon">{rankInfo.tierIcon}</span>
                        <div>
                          <div className="elo-hero-sub">BẬC XẾP HẠNG HIỆN TẠI</div>
                          <div className="elo-hero-tier" style={{ color: rankInfo.tierColor }}>
                            {rankInfo.tierNameVi} ({rankInfo.tierNameEn})
                          </div>
                          <div className="elo-hero-score">
                            Điểm hiện tại: <strong>{currentElo} Elo</strong> • Đỉnh cao:{' '}
                            <strong>{peakElo} Elo</strong>
                          </div>
                        </div>
                      </div>

                      <div className="elo-hero-progress-wrap">
                        <div className="elo-progress-labels">
                          <span>Tiến độ thăng bậc tiếp theo: {rankInfo.nextTierNameVi}</span>
                          <strong>
                            {rankInfo.eloToNextTier > 0
                              ? `Còn thiếu ${rankInfo.eloToNextTier} Elo (Mốc ${rankInfo.nextTierElo})`
                              : 'Đã đạt bậc Chí Tôn tối thượng!'}
                          </strong>
                        </div>
                        <div className="elo-progress-bar-bg">
                          <div
                            className="elo-progress-bar-fill"
                            style={{
                              width: `${rankInfo.progressPct}%`,
                              background: `linear-gradient(90deg, ${rankInfo.tierColor}, #fde047)`
                            }}
                          />
                        </div>
                        <div className="elo-kpi-strip">
                          <span>
                            🏆 Thắng: <strong>{comm?.wins ?? 0}</strong>
                          </span>
                          <span>
                            💀 Thua: <strong>{comm?.losses ?? 0}</strong>
                          </span>
                          <span>
                            🔥 Chuỗi thắng: <strong>{comm?.winStreak ?? 0}</strong>
                          </span>
                          <span>
                            ⚔ Hạ gục quân: <strong>{comm?.totalKills ?? 0}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <h3 className="elo-section-heading">
                      6 Bậc Xếp Hạng Elo &amp; Đặc Quyền Mở Khóa Skin Cờ
                    </h3>
                    <div className="elo-tiers-grid">
                      {ELO_RANK_TIERS.map((tier) => {
                        const isReached = peakElo >= tier.minElo;
                        const isCurrent = rankInfo.tierId === tier.id;
                        const tierSkins = CHESS_SKIN_CATALOG.filter(
                          (s) =>
                            s.requiredElo >= tier.minElo &&
                            s.requiredElo <= tier.maxElo &&
                            s.requiredElo > 0
                        );
                        return (
                          <div
                            key={tier.id}
                            className={`elo-tier-card ${isReached ? 'reached' : 'locked'} ${
                              isCurrent ? 'current-tier' : ''
                            }`}
                            style={{ borderColor: isCurrent ? tier.colorHex : undefined }}
                          >
                            <div className="elo-tier-header">
                              <span className="tier-medal">{tier.icon}</span>
                              <div>
                                <div
                                  className="tier-title"
                                  style={{ color: tier.colorHex }}
                                >
                                  {tier.nameVi}
                                </div>
                                <div className="tier-range">
                                  {tier.minElo} – {tier.maxElo > 10000 ? '∞' : tier.maxElo} Elo
                                </div>
                              </div>
                              <span className={`tier-status-tag ${isReached ? 'ok' : ''}`}>
                                {isCurrent
                                  ? '★ HIỆN TẠI'
                                  : isReached
                                    ? '✓ ĐÃ ĐẠT'
                                    : '🔒 CHƯA ĐẠT'}
                              </span>
                            </div>

                            <div className="tier-bounty-line">
                              Thưởng mỗi trận thắng: <strong>+{tier.winBonusGold} 🪙 Vàng</strong>
                            </div>

                            <div className="tier-unlocks-box">
                              <span className="tier-unlocks-label">Skin Mở Khóa Ở Bậc Này:</span>
                              {tierSkins.length === 0 ? (
                                <span className="tier-skin-pill default">
                                  Mở khóa 4 bộ Skin Mua Bằng Vàng cơ bản
                                </span>
                              ) : (
                                tierSkins.map((sk) => (
                                  <button
                                    key={sk.id}
                                    type="button"
                                    className="tier-skin-pill"
                                    style={{ borderColor: sk.rarityColor }}
                                    onClick={() => {
                                      setStoreTab('skins');
                                      setSkinFilter('elo');
                                    }}
                                  >
                                    {sk.icon} {sk.nameVi} ({sk.requiredElo} Elo •{' '}
                                    {sk.goldCost.toLocaleString()}🪙)
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* VICTORY / CHECKMATE OVERLAY */}
      <div id="checkmate-overlay" role="status" aria-live="polite">
        <canvas
          id="checkmate-confetti-canvas"
          className="checkmate-confetti-canvas"
          aria-hidden="true"
        />
        <div className="checkmate-banner">
          <div className="checkmate-ornament">✦ &nbsp; Sanctum Judgment &nbsp; ✦</div>
          <div className="checkmate-crown" id="checkmate-crown">♔</div>
          <div className="checkmate-title" id="checkmate-title">Checkmate</div>
          <div className="checkmate-rule"></div>
          <div className="checkmate-subtitle" id="checkmate-subtitle">
            White Triumphs • The Black King Has Fallen
          </div>
                    {/* DONATE / COFFEE SUPPORT CARD AFTER MATCH */}
          <div className="checkmate-donate-card">
            <div className="donate-header">
              <span className="donate-badge">☕ ỦNG HỘ TÁC GIẢ</span>
              <span className="donate-tagline">Tiếp lửa phát triển Poker Chess 3D</span>
            </div>
            <div className="donate-body">
              <div className="donate-qr-wrapper">
                <img
                  src={donateQrImage}
                  alt="Mã VietQR Donate - TRƯƠNG MINH HOÀNG"
                  className="donate-qr-img"
                  loading="lazy"
                />
              </div>
              <div className="donate-info">
                <p className="donate-message">
                  Cảm ơn bạn đã thi đấu! Nếu yêu thích trò chơi, hãy ủng hộ tác giả một ly cà phê nhé!
                </p>
                <div className="donate-details">
                  <div className="donate-row">
                    <span className="d-label">Chủ TK:</span>
                    <span className="d-val d-name">TRUONG MINH HOANG</span>
                  </div>
                  <div className="donate-row">
                    <span className="d-label">Ngân hàng:</span>
                    <span className="d-val">MB Bank (Quân Đội)</span>
                  </div>
                  <div className="donate-row">
                    <span className="d-label">Số TK:</span>
                    <span className="d-val d-acc">0937057055</span>
                    <button
                      type="button"
                      className="donate-copy-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (navigator.clipboard) {
                          navigator.clipboard.writeText('0937057055');
                        }
                        const target = e.currentTarget;
                        target.textContent = '✓ Đã chép!';
                        setTimeout(() => {
                          target.textContent = '📋 Chép STK';
                        }, 2000);
                      }}
                      title="Sao chép số tài khoản"
                    >
                      📋 Chép STK
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="checkmate-actions">
            <button className="checkmate-btn" id="btn-checkmate-replay">
              Replay King Fall
            </button>
            <button className="checkmate-btn" id="btn-checkmate-newgame">
              New Game
            </button>
            <button className="checkmate-btn secondary" id="btn-checkmate-dismiss">
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
