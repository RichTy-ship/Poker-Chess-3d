import WebSocket from 'ws';
const URL = 'ws://127.0.0.1:3917';
function mk(name) {
  return new Promise((res) => {
    const ws = new WebSocket(URL);
    const c = { ws, name, msgs: [], send: (t, p = {}) => ws.send(JSON.stringify({ type: t, ...p })) };
    ws.on('message', (d) => c.msgs.push(JSON.parse(d.toString())));
    ws.on('open', () => res(c));
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const has = (c, t) => c.msgs.find((m) => m.type === t);

async function match() {
  const a = await mk('A'); const b = await mk('B');
  a.send('UPDATE_PROFILE', { name: 'A', elo: 1000 }); b.send('UPDATE_PROFILE', { name: 'B', elo: 1000 });
  a.send('JOIN_QUEUE'); b.send('JOIN_QUEUE');
  for (let i = 0; i < 40 && !(has(a, 'MATCH_FOUND') && has(b, 'MATCH_FOUND')); i++) await sleep(250);
  const ma = has(a, 'MATCH_FOUND');
  if (!ma) throw new Error('no match found');
  const white = ma.yourColor === 'w' ? a : b, black = white === a ? b : a;
  return { a, b, white, black };
}
async function play(t, turns) {
  for (let i = 0; i < turns; i++) {
    const side = i % 2 === 0 ? t.white : t.black;
    side.send('CHESS_MOVE', { from: { r: 6, c: i }, to: { r: 5, c: i }, pieceType: 'pawn' });
    await sleep(200);
  }
}
let fail = 0;
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fail++; };

// T1: early claim rejected
let t = await match();
t.white.send('MATCH_VICTORY_CHECK', { winnerColor: 'w' }); await sleep(500);
ok(!has(t.white, 'MATCH_ENDED'), 'early claim rejected');
// T2: malformed move does not crash
t.white.send('CHESS_MOVE', { from: { r: 99 }, to: null }); await sleep(300);
ok(has(t.white, 'ERROR'), 'malformed move rejected with ERROR');
await play(t, 4);
// T3: lone self-claim accepted after window
t.white.send('MATCH_VICTORY_CHECK', { winnerColor: 'w' });
await sleep(1000); ok(!has(t.white, 'MATCH_ENDED'), 'self-claim waits for confirmation');
await sleep(6000); ok(has(t.white, 'MATCH_ENDED') && has(t.black, 'MATCH_ENDED'), 'silent opponent => claim accepted after window');
// T4: concession immediate
t = await match(); await play(t, 4);
t.black.send('MATCH_VICTORY_CHECK', { winnerColor: t.white.color || 'w' });
t.black.send('MATCH_VICTORY_CHECK', { winnerColor: 'w' === (has(t.white, 'MATCH_FOUND').yourColor) ? 'w' : 'b' });
await sleep(500); ok(has(t.white, 'MATCH_ENDED'), 'concession ends match immediately');
// T5: dispute does not end
t = await match(); await play(t, 4);
const wc = has(t.white, 'MATCH_FOUND').yourColor, bc = has(t.black, 'MATCH_FOUND').yourColor;
t.white.send('MATCH_VICTORY_CHECK', { winnerColor: wc }); t.black.send('MATCH_VICTORY_CHECK', { winnerColor: bc });
await sleep(7500); ok(!has(t.white, 'MATCH_ENDED'), 'disputed claims do not end match');
// T6: agreement
t = await match(); await play(t, 4);
const w2 = has(t.white, 'MATCH_FOUND').yourColor;
t.white.send('MATCH_VICTORY_CHECK', { winnerColor: w2 }); t.black.send('MATCH_VICTORY_CHECK', { winnerColor: w2 });
await sleep(500); ok(has(t.white, 'MATCH_ENDED'), 'both agree => ends immediately');
console.log(fail ? `${fail} FAILED` : 'ALL PASSED');
process.exit(fail ? 1 : 0);
