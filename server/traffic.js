import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_FILE = join(__dirname, 'traffic_data.json');

// In-memory traffic state
let stats = {
  totalVisits: 0,
  uniqueIps: {},
  gamesPlayed: 0,
  pvToday: 0,
  currentDateStr: new Date().toISOString().slice(0, 10),
  sources: {
    'Facebook / Messenger': 0,
    'Zalo': 0,
    'Direct / Bookmark': 0,
    'Telegram': 0,
    'Google / Search': 0,
    'Khác': 0
  },
  devices: {
    'Android': 0,
    'iPhone / iPad': 0,
    'Windows PC': 0,
    'Mac / Linux': 0,
    'Khác': 0
  },
  hourly: {}, // 'HH:00': count
  recentLogs: [] // max 50 entries
};

// Load persistent data if exists
try {
  if (existsSync(DATA_FILE)) {
    const raw = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
    if (raw && typeof raw.totalVisits === 'number') {
      stats.totalVisits = raw.totalVisits || 0;
      stats.uniqueIps = raw.uniqueIps || {};
      stats.gamesPlayed = raw.gamesPlayed || 0;
      stats.pvToday = raw.pvToday || 0;
      stats.currentDateStr = raw.currentDateStr || new Date().toISOString().slice(0, 10);
      stats.sources = { ...stats.sources, ...(raw.sources || {}) };
      stats.devices = { ...stats.devices, ...(raw.devices || {}) };
      stats.hourly = raw.hourly || {};
      stats.recentLogs = Array.isArray(raw.recentLogs) ? raw.recentLogs.slice(0, 50) : [];
    }
  }
} catch (e) {
  console.warn('[Traffic] Could not load traffic_data.json, initializing fresh stats.', e.message);
}

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      writeFileSync(DATA_FILE, JSON.stringify(stats, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Traffic] Save error:', err.message);
    }
  }, 3000);
}

// Anonymize IP (e.g. 118.69.123.45 -> 118.69.xxx.xxx)
function anonymizeIp(ip) {
  if (!ip) return 'Ẩn danh';
  const clean = ip.replace(/^::ffff:/, '');
  if (clean.includes('.')) {
    const parts = clean.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.xxx.xxx`;
  }
  return clean.slice(0, 8) + '...';
}

// Detect source from Referrer or query
export function detectSource(referrer = '', userAgent = '') {
  const ref = (referrer || '').toLowerCase();
  const ua = (userAgent || '').toLowerCase();

  if (ref.includes('facebook') || ref.includes('messenger') || ref.includes('fb.me') || ua.includes('fban') || ua.includes('fbav')) {
    return 'Facebook / Messenger';
  }
  if (ref.includes('zalo') || ua.includes('zalo')) {
    return 'Zalo';
  }
  if (ref.includes('t.me') || ref.includes('telegram')) {
    return 'Telegram';
  }
  if (ref.includes('google') || ref.includes('bing') || ref.includes('yahoo')) {
    return 'Google / Search';
  }
  if (!ref || ref === 'direct' || ref.includes('railway.app') || ref.includes('localhost')) {
    return 'Direct / Bookmark';
  }
  return 'Khác';
}

// Detect device category
export function detectDevice(userAgent = '') {
  const ua = (userAgent || '').toLowerCase();
  if (ua.includes('android')) return 'Android';
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'iPhone / iPad';
  if (ua.includes('windows')) return 'Windows PC';
  if (ua.includes('macintosh') || ua.includes('mac os') || ua.includes('linux')) return 'Mac / Linux';
  return 'Khác';
}

// Detect browser
export function detectBrowser(userAgent = '') {
  const ua = (userAgent || '').toLowerCase();
  if (ua.includes('zalo')) return 'Zalo Webview';
  if (ua.includes('fban') || ua.includes('fbav')) return 'Facebook Webview';
  if (ua.includes('edg')) return 'Microsoft Edge';
  if (ua.includes('chrome')) return 'Google Chrome';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'Apple Safari';
  if (ua.includes('firefox')) return 'Mozilla Firefox';
  return 'Trình duyệt khác';
}

// Record traffic event
export function recordTrafficEvent(req, customPayload = {}) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const hourStr = `${String(now.getHours()).padStart(2, '0')}:00`;

  // Reset daily PV on new calendar day
  if (stats.currentDateStr !== todayStr) {
    stats.currentDateStr = todayStr;
    stats.pvToday = 0;
  }

  const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
  const ip = String(rawIp).split(',')[0].trim();
  const ua = req.headers['user-agent'] || '';
  const ref = customPayload.referrer || req.headers['referer'] || '';

  const eventType = customPayload.event || 'PAGE_VIEW';
  const source = customPayload.source || detectSource(ref, ua);
  const device = customPayload.device || detectDevice(ua);
  const browser = detectBrowser(ua);

  if (eventType === 'START_MATCH') {
    stats.gamesPlayed++;
  } else {
    stats.totalVisits++;
    stats.pvToday++;

    // Track unique IP
    if (!stats.uniqueIps[ip]) {
      stats.uniqueIps[ip] = true;
    }

    // Source breakdown
    stats.sources[source] = (stats.sources[source] || 0) + 1;

    // Device breakdown
    stats.devices[device] = (stats.devices[device] || 0) + 1;

    // Hourly
    stats.hourly[hourStr] = (stats.hourly[hourStr] || 0) + 1;

    // Log entry (prepend)
    const timeVi = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    stats.recentLogs.unshift({
      time: timeVi,
      date: todayStr,
      ip: anonymizeIp(ip),
      source,
      device,
      browser,
      event: eventType === 'PAGE_VIEW' ? 'Ghé thăm trang' : eventType
    });
    if (stats.recentLogs.length > 50) {
      stats.recentLogs.pop();
    }
  }

  scheduleSave();
}

// Return JSON summary
export function getTrafficSummary(onlinePlayers = 0, activeMatches = 0) {
  const uniqueCount = Object.keys(stats.uniqueIps).length;
  return {
    status: 'ok',
    live: {
      onlinePlayers,
      activeMatches
    },
    totals: {
      totalVisits: stats.totalVisits,
      uniqueVisitors: uniqueCount,
      todayVisits: stats.pvToday,
      gamesPlayed: stats.gamesPlayed
    },
    sources: stats.sources,
    devices: stats.devices,
    hourly: stats.hourly,
    recentLogs: stats.recentLogs.slice(0, 30),
    serverTime: new Date().toISOString()
  };
}

// Render Standalone Responsive HTML Dashboard
export function renderTrafficDashboardHtml(onlinePlayers = 0, activeMatches = 0) {
  const data = getTrafficSummary(onlinePlayers, activeMatches);
  const totalVisits = Math.max(1, data.totals.totalVisits);

  // Compute source percentages
  const sourceEntries = Object.entries(data.sources).map(([k, v]) => ({
    name: k,
    count: v,
    pct: Math.round((v / totalVisits) * 100)
  })).sort((a, b) => b.count - a.count);

  // Compute device percentages
  const deviceEntries = Object.entries(data.devices).map(([k, v]) => ({
    name: k,
    count: v,
    pct: Math.round((v / totalVisits) * 100)
  })).sort((a, b) => b.count - a.count);

  // Hourly bars for 24 hours
  const hoursList = Array.from({ length: 24 }).map((_, h) => {
    const key = `${String(h).padStart(2, '0')}:00`;
    return { hour: key, count: data.hourly[key] || 0 };
  });
  const maxHourly = Math.max(1, ...hoursList.map(h => h.count));

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vương Quyền Poker Chess 3D — Thống Kê Traffic Realtime</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0e14;
      --card-bg: #141822;
      --card-border: #232b3e;
      --gold: #d8b45b;
      --gold-bright: #f4d98b;
      --text: #f3f4f6;
      --muted: #9ca3af;
      --green: #10b981;
      --blue: #38bdf8;
      --purple: #a855f7;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: radial-gradient(circle at 50% 0%, #171f30 0%, var(--bg) 100%);
      color: var(--text);
      font-family: 'Inter', -apple-system, sans-serif;
      min-height: 100vh;
      padding: 24px 16px 40px;
    }
    .container {
      max-width: 1100px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 22px;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--card-border);
    }
    .brand-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-crest {
      font-size: 2rem;
      background: linear-gradient(135deg, rgba(216, 180, 91, 0.2), rgba(0,0,0,0.5));
      border: 1px solid var(--gold);
      border-radius: 12px;
      padding: 6px 12px;
    }
    h1 {
      font-family: 'Cinzel', serif;
      font-size: 1.35rem;
      color: var(--gold-bright);
      letter-spacing: 0.04em;
    }
    .sub-head {
      font-size: 0.82rem;
      color: var(--muted);
      margin-top: 2px;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .btn {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      color: var(--text);
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
      transition: all 0.15s ease;
    }
    .btn:hover {
      border-color: var(--gold);
      color: var(--gold-bright);
      transform: translateY(-1px);
    }
    .btn.primary {
      background: linear-gradient(135deg, #10b981, #059669);
      border-color: #34d399;
      color: #fff;
    }
    .live-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 10px #10b981;
      display: inline-block;
      animation: pulseLive 1.8s infinite;
    }
    @keyframes pulseLive {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 14px;
    }
    .kpi-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      position: relative;
      overflow: hidden;
    }
    .kpi-card::after {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, var(--gold), transparent);
    }
    .kpi-card.highlight::after {
      background: linear-gradient(90deg, var(--green), transparent);
    }
    .kpi-label {
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .kpi-val {
      font-size: 1.85rem;
      font-weight: 800;
      color: #fff;
      font-family: 'Cinzel', serif;
    }
    .kpi-val.green { color: #34d399; }
    .kpi-val.gold { color: var(--gold-bright); }
    .kpi-val.blue { color: #38bdf8; }
    .kpi-sub {
      font-size: 0.72rem;
      color: var(--muted);
    }

    /* 2-column breakdown section */
    .breakdown-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 16px;
    }
    .panel {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .panel-header {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--gold-bright);
      display: flex;
      align-items: center;
      gap: 8px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .bar-row {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .bar-meta {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
    }
    .bar-meta .count {
      color: var(--muted);
      font-weight: 600;
    }
    .bar-track {
      height: 8px;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 999px;
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, var(--gold), #fef08a);
      transition: width 0.4s ease;
    }
    .bar-fill.source { background: linear-gradient(90deg, #38bdf8, #818cf8); }
    .bar-fill.device { background: linear-gradient(90deg, #34d399, #10b981); }

    /* Hourly Chart */
    .hourly-chart {
      display: flex;
      align-items: flex-end;
      gap: 4px;
      height: 120px;
      padding-top: 14px;
      overflow-x: auto;
    }
    .hour-col {
      flex: 1;
      min-width: 18px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      height: 100%;
      justify-content: flex-end;
    }
    .hour-bar {
      width: 100%;
      max-width: 22px;
      background: linear-gradient(180deg, var(--gold-bright), #b45309);
      border-radius: 4px 4px 0 0;
      min-height: 4px;
      transition: height 0.3s ease;
    }
    .hour-lbl {
      font-size: 0.62rem;
      color: var(--muted);
      writing-mode: vertical-rl;
      transform: rotate(180deg);
    }

    /* Recent Logs Table */
    .table-wrap {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8rem;
      text-align: left;
    }
    th {
      padding: 10px 12px;
      color: var(--muted);
      font-weight: 600;
      border-bottom: 1px solid var(--card-border);
      text-transform: uppercase;
      font-size: 0.7rem;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }
    tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 0.72rem;
      font-weight: 600;
    }
    .badge.fb { background: rgba(59, 130, 246, 0.2); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.4); }
    .badge.zalo { background: rgba(6, 182, 212, 0.2); color: #a5f3fc; border: 1px solid rgba(6, 182, 212, 0.4); }
    .badge.direct { background: rgba(168, 85, 247, 0.2); color: #d8b4fe; border: 1px solid rgba(168, 85, 247, 0.4); }
    .badge.event { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.4); }

    .refresh-chip {
      font-size: 0.72rem;
      color: var(--muted);
      display: flex;
      align-items: center;
      gap: 5px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand-wrap">
        <span class="brand-crest">👑</span>
        <div>
          <h1>VƯƠNG QUYỀN POKER CHESS 3D</h1>
          <div class="sub-head">Hệ Thống Phân Tích &amp; Thống Kê Traffic Thời Gian Thực</div>
        </div>
      </div>
      <div class="header-actions">
        <span class="refresh-chip"><span class="live-dot"></span> Tự động làm mới: 5s</span>
        <a href="/" class="btn primary" target="_blank">🎮 Mở Game</a>
        <button class="btn" onclick="location.reload()">🔄 Tải Lại</button>
      </div>
    </header>

    <!-- KPI Metric Cards -->
    <section class="kpi-grid">
      <div class="kpi-card highlight">
        <div class="kpi-label">
          <span>Người Đang Online</span>
          <span class="live-dot"></span>
        </div>
        <div class="kpi-val green">${data.live.onlinePlayers}</div>
        <div class="kpi-sub">${data.live.activeMatches} trận 1v1 đang diễn ra</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Tổng Lượt Ghé Thăm (PV)</div>
        <div class="kpi-val gold">${data.totals.totalVisits.toLocaleString()}</div>
        <div class="kpi-sub">Hôm nay: +${data.totals.todayVisits.toLocaleString()} lượt</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Kỳ Thủ Độc Nhất (UV)</div>
        <div class="kpi-val blue">${data.totals.uniqueVisitors.toLocaleString()}</div>
        <div class="kpi-sub">Địa chỉ IP phân biệt</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Số Trận Đã Đấu</div>
        <div class="kpi-val gold">${data.totals.gamesPlayed.toLocaleString()}</div>
        <div class="kpi-sub">Bao gồm Đấu Máy &amp; Online</div>
      </div>
    </section>

    <!-- Source & Device Breakdown -->
    <section class="breakdown-grid">
      <div class="panel">
        <div class="panel-header">📍 Nguồn Lưu Lượng (Traffic Sources)</div>
        ${sourceEntries.map(s => `
          <div class="bar-row">
            <div class="bar-meta">
              <span>${s.name}</span>
              <span class="count">${s.count} (${s.pct}%)</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill source" style="width: ${Math.max(2, s.pct)}%"></div>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="panel">
        <div class="panel-header">📱 Thiết Bị Người Dùng (Devices)</div>
        ${deviceEntries.map(d => `
          <div class="bar-row">
            <div class="bar-meta">
              <span>${d.name}</span>
              <span class="count">${d.count} (${d.pct}%)</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill device" style="width: ${Math.max(2, d.pct)}%"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </section>

    <!-- Hourly Activity Chart -->
    <section class="panel">
      <div class="panel-header">⏱ Phân Bố Lưu Lượng Theo Giờ Trong Ngày</div>
      <div class="hourly-chart">
        ${hoursList.map(h => {
          const heightPct = Math.round((h.count / maxHourly) * 100);
          return `
            <div class="hour-col" title="${h.hour}: ${h.count} lượt">
              <div class="hour-bar" style="height: ${Math.max(4, heightPct)}%"></div>
              <span class="hour-lbl">${h.hour.slice(0, 2)}h</span>
            </div>
          `;
        }).join('')}
      </div>
    </section>

    <!-- Recent Visit Log -->
    <section class="panel">
      <div class="panel-header">📋 Nhật Ký 30 Phiên Ghé Thăm Gần Nhất</div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>IP (Ẩn danh)</th>
              <th>Thiết bị</th>
              <th>Trình duyệt</th>
              <th>Nguồn giới thiệu</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            ${data.recentLogs.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px;">Chưa có lượt truy cập mới. Hãy chia sẻ link game để xem dữ liệu realtime!</td></tr>' : data.recentLogs.map(l => {
              const srcClass = l.source.includes('Facebook') ? 'fb' : l.source.includes('Zalo') ? 'zalo' : 'direct';
              return `
                <tr>
                  <td><strong>${l.time}</strong> <span style="font-size:0.7rem;color:var(--muted);">${l.date}</span></td>
                  <td>${l.ip}</td>
                  <td>${l.device}</td>
                  <td>${l.browser}</td>
                  <td><span class="badge ${srcClass}">${l.source}</span></td>
                  <td><span class="badge event">${l.event}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </section>
  </div>

  <script>
    // Auto-refresh every 5 seconds
    setTimeout(() => {
      location.reload();
    }, 5000);
  </script>
</body>
</html>`;
}
