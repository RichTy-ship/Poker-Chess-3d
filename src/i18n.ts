export type Language = 'vi' | 'en';

export interface Translations {
  // Brand & Header
  brandTitle: string;
  brandSub: string;
  fpsLabel: string;
  perfMax: string;
  perfUltra: string;
  perfBalanced: string;
  rulesQuick: string;
  menuQuick: string;
  closeQuick: string;
  restoreUi: string;

  // HUD Center & Turn
  turnWhite: string;
  turnBlack: string;
  yourTurn: string;
  opponentTurn: string;
  timeRemaining: string;
  botLevelPrefix: string;
  botEasy: string;
  botMedium: string;
  botHard: string;
  botMaster: string;

  // Action Dock & 4 Phases
  phase1: string;
  phase2: string;
  phase3: string;
  phase4: string;
  deck: string;
  collapse: string;
  expand: string;
  holdingCards: string;
  draw5CardsBtn: string;
  lockComboBtn: string;
  selectUnitToBuff: string;
  skipBuffBtn: string;
  selectUnitToMove: string;
  waitingOpponent: string;
  yourTurnNotice: string;
  firstBloodBonus: string;
  instantHeal: string;
  atkBonusLabel: string;
  armorBonusLabel: string;

  // Main Menu
  mainMenuTitle: string;
  mainMenuSubtitle: string;
  profileRankSub: string;
  profileGold: string;
  renameBtn: string;
  shareBtn: string;
  shareCopied: string;
  tabModes: string;
  tabSkins: string;
  tabRank: string;
  tabRules: string;
  tabSettings: string;
  modeAiTitle: string;
  modeAiBadge: string;
  modeAiDesc: string;
  modeAiChooseSide: string;
  modeAiSideWhite: string;
  modeAiSideBlack: string;
  modeAiSideRandom: string;
  modeAiBotLevel: string;
  modeAiStartBtn: string;
  modeOnlineTitle: string;
  modeOnlineBadge: string;
  modeOnlineDesc: string;
  modeOnlineFindBtn: string;
  modeOnlineCancelBtn: string;
  modeOnlineSearching: string;
  modeStoryTitle: string;
  modeStoryBadge: string;
  modeStoryDesc: string;

  // Rename Modal
  renameTitle: string;
  renameSub: string;
  renamePlaceholder: string;
  renameSave: string;
  renameCancel: string;
  renameSuggestions: string;
  sugGrandmaster: string;
  sugChessLegend: string;
  sugArchmage: string;
  sugPokerKing: string;
  sugSanctumLord: string;

  // Rules Modal
  rulesModalTitle: string;
  rulesTab1: string;
  rulesTab2: string;
  rulesTab3: string;
  rulesTab4: string;

  // Loading Screen
  loadingInit: string;
  loadingTitle: string;
  loadingSub: string;
  loadingTipBadge: string;
  loadingTipContent: string;

  // Checkmate / Victory
  checkmateBanner: string;
  checkmateWhiteWin: string;
  checkmateBlackWin: string;
  replayKingFall: string;
  newGameBtn: string;
  dismissBtn: string;
  donateTitle: string;
  donateTagline: string;
  donateMessage: string;
  donateAccOwner: string;
  donateBank: string;
  donateAccNum: string;
  donateCopyBtn: string;
  donateCopiedBtn: string;

  // Tactical Unit Inspector & Combat
  inspectorTitle: string;
  atkStat: string;
  hpStat: string;
  armorStat: string;
  levelStat: string;
  skillLabel: string;
  activeComboLabel: string;
  outcomeBreakthrough: string;
  outcomeClashRepel: string;
  outcomeCounterKill: string;
  outcomeMutual: string;

  // Quick Controls Drawer
  drawerTitle: string;
  drawerSectionTactical: string;
  drawerSectionCamera: string;
  drawerSectionMatch: string;
  drawerSkinStore: string;
  drawerHandsOn: string;
  drawerTacticalPing: string;
  drawerInvite: string;
  drawerMainMenu: string;
  drawerRestart: string;
  drawerHideUi: string;
  drawerCamPlayer: string;
  drawerCamWide: string;
  drawerCamTop: string;
  drawerCamSide: string;
  drawerLanguage: string;
}

export const DICTIONARY: Record<Language, Translations> = {
  vi: {
    brandTitle: 'POKER CHESS',
    brandSub: '3D VƯƠNG QUYỀN',
    fpsLabel: 'FPS',
    perfMax: '⚡ Siêu Mượt',
    perfUltra: '💎 Đồ Họa Cao',
    perfBalanced: '⚖ Cân Bằng',
    rulesQuick: '📖 Luật',
    menuQuick: '☰ Menu',
    closeQuick: '✕ Đóng',
    restoreUi: 'Hiện UI',

    turnWhite: 'Lượt Trắng',
    turnBlack: 'Lượt Đen',
    yourTurn: 'Lượt Của Bạn',
    opponentTurn: 'Lượt Đối Thủ',
    timeRemaining: 'Thời gian',
    botLevelPrefix: 'Bot',
    botEasy: 'Lv.1 • Dễ',
    botMedium: 'Lv.2 • Vừa',
    botHard: 'Lv.3 • Khó',
    botMaster: 'Lv.4 • Đại Sư',

    phase1: '1. Bốc bài',
    phase2: '2. Ghép 5 lá',
    phase3: '3. Gắn Buff',
    phase4: '4. Đi quân',
    deck: 'Cổ bài',
    collapse: 'Thu gọn',
    expand: 'Mở rộng',
    holdingCards: 'Đang giữ',
    draw5CardsBtn: 'Bốc 5 Lá Bài Mới (Dù 7 Lá)',
    lockComboBtn: 'Khóa Bộ Bài Này',
    selectUnitToBuff: 'Chạm 1 quân cờ đồng minh để gắn Buff phép này',
    skipBuffBtn: 'Bỏ Lượt Gắn Buff',
    selectUnitToMove: 'Chọn 1 quân cờ để di chuyển hoặc tấn công',
    waitingOpponent: 'Đang chờ đối thủ thao tác...',
    yourTurnNotice: 'ĐẾN LƯỢT CỦA BẠN',
    firstBloodBonus: 'Bạo kích mở màn',
    instantHeal: 'Hồi phục',
    atkBonusLabel: 'Công',
    armorBonusLabel: 'Giáp',

    mainMenuTitle: 'VƯƠNG QUYỀN • POKER CHESS 3D',
    mainMenuSubtitle: 'Hệ Thống Menu Chiến Thuật & Điều Khiển Toàn Diện',
    profileRankSub: 'Bậc Rank',
    profileGold: 'Vàng',
    renameBtn: '✏️ Đổi Tên',
    shareBtn: '📢 Mời Bạn Bè',
    shareCopied: '✓ Đã chép link!',
    tabModes: '🎮 Chế Độ',
    tabSkins: '👑 Kho Skin',
    tabRank: '🏆 Xếp Hạng',
    tabRules: '📜 Bí Kíp',
    tabSettings: '⚙ Cài Đặt',
    modeAiTitle: 'Đấu Với Máy (Luyện Tập)',
    modeAiBadge: 'Chơi Đơn • AI',
    modeAiDesc: 'Luyện cờ Poker Chess theo cấp độ Bot Elo. Không tính điểm xếp hạng Online.',
    modeAiChooseSide: 'Chọn Phe:',
    modeAiSideWhite: '⚪ Trắng (Đi Trước)',
    modeAiSideBlack: '⚫ Đen (Đi Sau)',
    modeAiSideRandom: '🎲 Ngẫu Nhiên',
    modeAiBotLevel: 'Cấp Độ Bot:',
    modeAiStartBtn: '⚔ Vào Trận Đấu Máy',
    modeOnlineTitle: 'Đấu Online 1vs1 Thời Gian Thực',
    modeOnlineBadge: 'Trực Tuyến (2 Người)',
    modeOnlineDesc: 'Ghép trận Realtime Matchmaking (100 CCU Server)',
    modeOnlineFindBtn: '🌐 Tìm Trận Online Ngay',
    modeOnlineCancelBtn: '✕ Hủy Tìm Trận',
    modeOnlineSearching: 'Đang tìm kiếm đối thủ...',
    modeStoryTitle: 'Chiến Dịch Thánh Địa (Sắp Ra Mắt)',
    modeStoryBadge: 'Cốt Truyện • PvE',
    modeStoryDesc: 'Vượt ải 10 Tầng Tháp Vương Quyền thu thập Cổ Vật & Thần Khí Poker.',

    renameTitle: 'Đổi Tên Kỳ Thủ',
    renameSub: 'Tên hiển thị khi thi đấu, trên BXH Elo và cho đối thủ thấy',
    renamePlaceholder: 'Nhập tên kỳ thủ...',
    renameSave: '💾 Lưu Tên',
    renameCancel: 'Hủy',
    renameSuggestions: 'Gợi ý danh hiệu:',
    sugGrandmaster: 'Đại Kiện Tướng',
    sugChessLegend: 'Thần Cờ 3D',
    sugArchmage: 'Vua Phép Thuật',
    sugPokerKing: 'Poker King',
    sugSanctumLord: 'Kỳ Thánh',

    rulesModalTitle: 'Luật Chơi Vương Quyền Poker Chess 3D',
    rulesTab1: '1. Vòng Đấu 4 Pha',
    rulesTab2: '2. 10 Phép Bài Poker',
    rulesTab3: '3. Chỉ Số & Tác Động Cờ',
    rulesTab4: '4. Mẹo Chiến Thuật',

    loadingInit: 'Khởi tạo thánh địa và điêu khắc quân cờ 3D...',
    loadingTitle: 'VƯƠNG QUYỀN • POKER CHESS 3D',
    loadingSub: 'Đại Chiến Cờ Thần & Phép Thuật Poker 3D',
    loadingTipBadge: '⚜ BÍ KÍP VƯƠNG QUYỀN ⚜',
    loadingTipContent: 'Ghép bộ Cù Lũ (Full House) hoặc Thùng Phá Sảnh để triệu hồi Thiên Phạt ⚡ nhận lượng lớn Giáp 🛡 và Sức Mạnh ⚔!',

    checkmateBanner: '✦ Sanctum Judgment • Phán Quyết Thánh Địa ✦',
    checkmateWhiteWin: 'Quân Trắng Đại Thắng • Vua Đen Đã Bại Trận',
    checkmateBlackWin: 'Quân Đen Đại Thắng • Vua Trắng Đã Bại Trận',
    replayKingFall: 'Xem Lại Vua Đổ',
    newGameBtn: 'Ván Mới',
    dismissBtn: 'Đóng',
    donateTitle: '☕ ỦNG HỘ TÁC GIẢ',
    donateTagline: 'Tiếp lửa phát triển Poker Chess 3D',
    donateMessage: 'Cảm ơn bạn đã thi đấu! Nếu yêu thích trò chơi, hãy ủng hộ tác giả một ly cà phê nhé!',
    donateAccOwner: 'Chủ TK:',
    donateBank: 'Ngân hàng:',
    donateAccNum: 'Số TK:',
    donateCopyBtn: '📋 Chép STK',
    donateCopiedBtn: '✓ Đã chép!',

    inspectorTitle: 'Kính Ngắm Chiến Thuật',
    atkStat: 'Công',
    hpStat: 'Máu',
    armorStat: 'Giáp',
    levelStat: 'Cấp',
    skillLabel: 'Kỹ Năng Nội Tại',
    activeComboLabel: 'Ấn Bài Đang Kích Hoạt',
    outcomeBreakthrough: '⚡ ĐỘT PHÁ',
    outcomeClashRepel: '🛡 BẬT LÙI',
    outcomeCounterKill: '⚔ PHẢN ĐÒN',
    outcomeMutual: '💥 ĐỒNG QUY VU TẬN',

    drawerTitle: '♔ Menu & Cài Đặt',
    drawerSectionTactical: 'Chiến Thuật & Cửa Hàng',
    drawerSectionCamera: 'Góc Nhìn Camera',
    drawerSectionMatch: 'Trận Đấu & Hệ Thống',
    drawerSkinStore: '🛒 Cửa Hàng Skin',
    drawerHandsOn: '👆 Chỉ Việc (Hướng Dẫn)',
    drawerTacticalPing: '📍 Ping Ô 3D',
    drawerInvite: '📢 Mời Bạn Bè Chơi',
    drawerMainMenu: '👑 Menu Chính',
    drawerRestart: '🔄 Khởi Động Lại',
    drawerHideUi: '👁 Ẩn Giao Diện',
    drawerCamPlayer: 'Người Chơi',
    drawerCamWide: 'Toàn Cảnh',
    drawerCamTop: 'Từ Trên Xuống',
    drawerCamSide: 'Góc Cạnh',
    drawerLanguage: '🌐 Ngôn Ngữ: 🇻🇳 Tiếng Việt'
  },
  en: {
    brandTitle: 'POKER CHESS',
    brandSub: '3D SOVEREIGN SANCTUM',
    fpsLabel: 'FPS',
    perfMax: '⚡ Performance',
    perfUltra: '💎 Ultra Quality',
    perfBalanced: '⚖ Balanced',
    rulesQuick: '📖 Rules',
    menuQuick: '☰ Menu',
    closeQuick: '✕ Close',
    restoreUi: 'Show UI',

    turnWhite: 'White Turn',
    turnBlack: 'Black Turn',
    yourTurn: 'Your Turn',
    opponentTurn: 'Opponent Turn',
    timeRemaining: 'Time',
    botLevelPrefix: 'Bot',
    botEasy: 'Lv.1 • Easy',
    botMedium: 'Lv.2 • Medium',
    botHard: 'Lv.3 • Hard',
    botMaster: 'Lv.4 • Master',

    phase1: '1. Draw Cards',
    phase2: '2. Build 5',
    phase3: '3. Apply Buff',
    phase4: '4. Move Unit',
    deck: 'Deck',
    collapse: 'Collapse',
    expand: 'Expand',
    holdingCards: 'Holding',
    draw5CardsBtn: 'Draw 5 New Cards (Keep 7)',
    lockComboBtn: 'Lock This Combo',
    selectUnitToBuff: 'Tap an ally piece to imbue with this Poker spell',
    skipBuffBtn: 'Skip Buff Phase',
    selectUnitToMove: 'Select a piece to move or attack',
    waitingOpponent: 'Waiting for opponent move...',
    yourTurnNotice: "IT'S YOUR TURN",
    firstBloodBonus: 'First blood bonus',
    instantHeal: 'Instant heal',
    atkBonusLabel: 'Attack',
    armorBonusLabel: 'Armor',

    mainMenuTitle: 'SOVEREIGN • POKER CHESS 3D',
    mainMenuSubtitle: 'Comprehensive Tactical System & Control Hub',
    profileRankSub: 'Rank Tier',
    profileGold: 'Gold',
    renameBtn: '✏️ Rename',
    shareBtn: '📢 Invite Friends',
    shareCopied: '✓ Copied Link!',
    tabModes: '🎮 Modes',
    tabSkins: '👑 Armory',
    tabRank: '🏆 Rankings',
    tabRules: '📜 Guide',
    tabSettings: '⚙ Settings',
    modeAiTitle: 'Single Player vs AI (Practice)',
    modeAiBadge: 'Solo • AI',
    modeAiDesc: 'Train your skills against tactical Bot Elo. Casual practice without rank loss.',
    modeAiChooseSide: 'Choose Side:',
    modeAiSideWhite: '⚪ White (First Move)',
    modeAiSideBlack: '⚫ Black (Second Move)',
    modeAiSideRandom: '🎲 Random Side',
    modeAiBotLevel: 'Bot Level:',
    modeAiStartBtn: '⚔ Start AI Practice',
    modeOnlineTitle: 'Realtime 1vs1 Online Duel',
    modeOnlineBadge: 'Multiplayer (2 Players)',
    modeOnlineDesc: 'Live matchmaking against players worldwide (100 CCU Dedicated Server)',
    modeOnlineFindBtn: '🌐 Find Online Match',
    modeOnlineCancelBtn: '✕ Cancel Matchmaking',
    modeOnlineSearching: 'Searching for opponent...',
    modeStoryTitle: 'Sanctum Campaign (Coming Soon)',
    modeStoryBadge: 'Story • PvE',
    modeStoryDesc: 'Conquer 10 Sanctum Tower trials to claim ancient relics & Poker artifacts.',

    renameTitle: 'Change Player Name',
    renameSub: 'Name displayed in matches, on the Elo leaderboard, and to rivals',
    renamePlaceholder: 'Enter player name...',
    renameSave: '💾 Save Name',
    renameCancel: 'Cancel',
    renameSuggestions: 'Title suggestions:',
    sugGrandmaster: 'Grandmaster',
    sugChessLegend: 'Chess Legend',
    sugArchmage: 'Archmage',
    sugPokerKing: 'Poker King',
    sugSanctumLord: 'Sanctum Lord',

    rulesModalTitle: 'Sovereign Poker Chess 3D Rules & Spells',
    rulesTab1: '1. Turn Sequence',
    rulesTab2: '2. 10 Poker Spells',
    rulesTab3: '3. RPG Stats & Combat',
    rulesTab4: '4. Tactical Guide',

    loadingInit: 'Initializing Sanctum arena and carving 3D pieces...',
    loadingTitle: 'SOVEREIGN • POKER CHESS 3D',
    loadingSub: 'Realm of Divine Chess & Arcane Poker',
    loadingTipBadge: '⚜ SANCTUM PRO TIP ⚜',
    loadingTipContent: 'Assemble a Full House or Straight Flush to unleash Divine Judgment ⚡, gaining massive Armor 🛡 and Attack ⚔!',

    checkmateBanner: '✦ Sanctum Judgment • King Fall ✦',
    checkmateWhiteWin: 'White Triumphs • The Black King Has Fallen',
    checkmateBlackWin: 'Black Triumphs • The White King Has Fallen',
    replayKingFall: 'Replay King Fall',
    newGameBtn: 'New Game',
    dismissBtn: 'Dismiss',
    donateTitle: '☕ SUPPORT THE CREATOR',
    donateTagline: 'Fueling continuous development of Poker Chess 3D',
    donateMessage: 'Thank you for playing! If you enjoy the game, buy the creator a cup of coffee!',
    donateAccOwner: 'Account Name:',
    donateBank: 'Bank:',
    donateAccNum: 'Account No:',
    donateCopyBtn: '📋 Copy No',
    donateCopiedBtn: '✓ Copied!',

    inspectorTitle: 'Tactical Unit Inspector',
    atkStat: 'Atk',
    hpStat: 'HP',
    armorStat: 'Armor',
    levelStat: 'Level',
    skillLabel: 'Innate Skill',
    activeComboLabel: 'Active Poker Seal',
    outcomeBreakthrough: '⚡ BREAKTHROUGH',
    outcomeClashRepel: '🛡 CLASH REPEL',
    outcomeCounterKill: '⚔ COUNTER KILL',
    outcomeMutual: '💥 MUTUAL DESTRUCTION',

    drawerTitle: '♔ Menu & Settings',
    drawerSectionTactical: 'Tactics & Armory',
    drawerSectionCamera: 'Camera Presets',
    drawerSectionMatch: 'Match & System',
    drawerSkinStore: '🛒 Skin Armory',
    drawerHandsOn: '👆 Step-by-Step Guide',
    drawerTacticalPing: '📍 3D Tactical Ping',
    drawerInvite: '📢 Invite Friends',
    drawerMainMenu: '👑 Main Menu',
    drawerRestart: '🔄 Restart Match',
    drawerHideUi: '👁 Hide HUD UI',
    drawerCamPlayer: 'Player',
    drawerCamWide: 'Wide',
    drawerCamTop: 'Top-Down',
    drawerCamSide: 'Flank',
    drawerLanguage: '🌐 Language: 🇬🇧 English'
  }
};

export function getInitialLanguage(): Language {
  try {
    const saved = localStorage.getItem('pokerchess_lang');
    if (saved === 'en' || saved === 'vi') return saved;
    // Detect browser language
    if (typeof navigator !== 'undefined' && navigator.language) {
      if (!navigator.language.toLowerCase().startsWith('vi')) {
        // Default to English if non-Vietnamese browser
        return 'en';
      }
    }
  } catch (e) {}
  return 'vi';
}
