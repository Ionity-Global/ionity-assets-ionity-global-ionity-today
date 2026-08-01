// End-to-end smoke test: boots the real server on a throwaway DB + port and
// exercises the REST + WebSocket surface. Run: npm test
import assert from 'node:assert';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { WebSocket } from 'ws';

const PORT = 8899;
const dbPath = join(tmpdir(), `nobify-test-${Date.now()}.db`);
process.env.PORT = String(PORT);
process.env.DB_PATH = dbPath;
process.env.SERVE_WEBAPP = 'false';
process.env.PRESENCE_HOLD_MS = '8000';

const base = `http://127.0.0.1:${PORT}`;
let passed = 0;
const ok = (name) => { console.log(`  \u2713 ${name}`); passed++; };

async function waitReady() {
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(`${base}/api/health`); if (r.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not become ready');
}

async function run() {
  await import('../src/server.js');
  await waitReady();

  // health
  let r = await (await fetch(`${base}/api/health`)).json();
  assert.equal(r.ok, true); assert.equal(r.service, 'nobify'); ok('health responds');

  // websocket receives the ingest broadcast
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  const gotAlert = new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('no ws alert')), 4000);
    ws.on('message', (b) => { const m = JSON.parse(b.toString()); if (m.type === 'alert') { clearTimeout(to); resolve(m); } });
  });
  await new Promise((res) => ws.on('open', res));
  ok('websocket connects');

  // ingest a fused reading
  r = await (await fetch(`${base}/api/ingest`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: 'test-esp', firmware: 'fw/test', rssi: -50, events: [
      { source: 'mmwave', present: true, distance_cm: 123, speed_cms: -8, direction: 'approaching', lux: 2, confidence: 0.9 },
      { source: 'wifi', present: true },
    ] }),
  })).json();
  assert.equal(r.ok, true); assert.equal(r.stored, 2); ok('ingest stores 2 events');

  const alertMsg = await gotAlert;
  assert.equal(alertMsg.alert.device_id, 'test-esp'); ok('websocket broadcast received');

  // live state should now be present, with distance + movement + darkness
  r = await (await fetch(`${base}/api/state`)).json();
  assert.equal(r.state.present, true);
  assert.equal(Math.round(r.state.lastDistanceCm), 123);
  assert.equal(r.state.direction, 'approaching');
  assert.equal(r.state.dark, true); ok('live state reflects presence + movement + darkness');

  // alerts history
  r = await (await fetch(`${base}/api/alerts?limit=10`)).json();
  assert.ok(r.alerts.length >= 2); ok('alerts history returns rows');

  // devices
  r = await (await fetch(`${base}/api/devices`)).json();
  assert.ok(r.devices.find((d) => d.id === 'test-esp')); ok('device registered');

  // stats
  r = await (await fetch(`${base}/api/stats`)).json();
  assert.ok(r.windowDetections >= 2); ok('stats aggregates');

  // AI insights
  r = await (await fetch(`${base}/api/ai/insights`)).json();
  assert.ok(typeof r.summary === 'string' && r.summary.length > 0);
  assert.ok(r.metrics && r.fusion && r.anomaly); ok('ai insights generated');

  // AI ask
  r = await (await fetch(`${base}/api/ai/ask`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'is anyone here?' }),
  })).json();
  assert.ok(/yes/i.test(r.answer)); ok('ai answers "is anyone here?"');

  r = await (await fetch(`${base}/api/ai/ask?q=how far away`)).json();
  assert.ok(/cm|distance/i.test(r.answer)); ok('ai answers distance query');

  r = await (await fetch(`${base}/api/ai/ask?q=is it dark`)).json();
  assert.ok(/dark|lux|bright/i.test(r.answer)); ok('ai answers darkness query');

  r = await (await fetch(`${base}/api/ai/ask?q=are they approaching or leaving`)).json();
  assert.ok(/approach|leav|stationary|direction/i.test(r.answer)); ok('ai answers movement query');

  // snooze set + clear
  r = await (await fetch(`${base}/api/snooze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ minutes: 5 }) })).json();
  assert.ok(r.snooze.until > Date.now()); ok('snooze set');
  r = await (await fetch(`${base}/api/snooze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clear: true }) })).json();
  assert.equal(r.snooze, null); ok('snooze cleared');

  ws.close();
  console.log(`\n  ${passed} checks passed.\n`);
}

run().then(() => { setTimeout(() => { try { rmSync(dbPath, { force: true }); rmSync(dbPath + '-wal', { force: true }); rmSync(dbPath + '-shm', { force: true }); } catch {} process.exit(0); }, 150); })
  .catch((e) => { console.error('\n  TEST FAILED:', e.message); setTimeout(() => process.exit(1), 150); });
