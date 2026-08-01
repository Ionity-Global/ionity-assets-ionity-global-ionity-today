// Nobify AI — a self-contained, dependency-free reasoning engine.
// It turns raw presence events into human-readable insights and answers
// natural-language questions. No external API/model required: everything is
// deterministic statistics + intent matching so it runs anywhere, offline.
import { listAlerts, listDevices, stats } from './db.js';
import { config } from './config.js';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

const fmtAgo = (ms) => {
  if (ms == null) return 'never';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};
const clamp01 = (n) => Math.max(0, Math.min(1, n));
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const std = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2)));
};

// Group consecutive "present" detections into occupancy sessions.
function buildSessions(alerts, gap = config.presenceHoldMs) {
  const present = alerts.filter((a) => a.present).sort((x, y) => x.ts - y.ts);
  const sessions = [];
  let cur = null;
  for (const a of present) {
    if (cur && a.ts - cur.end <= gap) {
      cur.end = a.ts;
      cur.count++;
      if (a.distance_cm != null) cur.distances.push(a.distance_cm);
      cur.sources.add(a.source);
    } else {
      if (cur) sessions.push(cur);
      cur = { start: a.ts, end: a.ts, count: 1, distances: a.distance_cm != null ? [a.distance_cm] : [], sources: new Set([a.source]) };
    }
  }
  if (cur) sessions.push(cur);
  return sessions;
}

// Detect the "live" presence state from the most recent events.
export function liveState() {
  const recent = listAlerts({ limit: 50 });
  const now = Date.now();
  const active = recent.find((a) => a.present && now - a.ts <= config.presenceHoldMs);
  const lastPresent = recent.find((a) => a.present) || null;
  const lastWithDistance = recent.find((a) => a.present && a.distance_cm != null) || null;
  const lastWithMotion = recent.find((a) => a.present && a.direction != null) || null;
  const lastWithLux = recent.find((a) => a.lux != null) || null;
  const sourcesActive = new Set(recent.filter((a) => a.present && now - a.ts <= config.presenceHoldMs).map((a) => a.source));
  const lux = lastWithLux?.lux ?? null;
  return {
    present: !!active,
    sources: [...sourcesActive],
    lastPresent,
    lastDistanceCm: lastWithDistance?.distance_cm ?? null,
    speedCms: lastWithMotion?.speed_cms ?? null,
    direction: lastWithMotion?.direction ?? null,
    lux,
    dark: lux != null ? lux <= config.darkLuxThreshold : null,
    sinceMs: lastPresent ? now - lastPresent.ts : null,
  };
}

// The core analytics report.
export function insights({ windowMs = DAY } = {}) {
  const s = stats(windowMs);
  const alerts = listAlerts({ limit: 5000, since: Date.now() - Math.max(windowMs, 7 * DAY) });
  const sessions = buildSessions(alerts.filter((a) => a.ts >= Date.now() - windowMs));
  const live = liveState();

  // Peak hour over the window.
  const hours = s.byHour;
  let peakHour = null, peakCount = 0;
  for (const [h, c] of Object.entries(hours)) if (c > peakCount) { peakCount = c; peakHour = Number(h); }

  // Sensor fusion agreement: for each mmwave "present", was there a wifi
  // "present" within a short window (and vice versa)?
  const agreement = sensorAgreement(alerts);

  // Anomaly detection: compare last-hour rate against the per-hour baseline
  // built from the trailing 7 days.
  const anomaly = detectAnomaly(alerts);

  // Session/dwell metrics.
  const durations = sessions.map((x) => x.end - x.start);
  const avgDwellMs = durations.length ? mean(durations) : 0;
  const longest = sessions.reduce((m, x) => Math.max(m, x.end - x.start), 0);

  const messages = [];
  if (live.present) {
    const move = live.direction ? `, ${live.direction}${live.speedCms != null ? ` at ~${Math.abs(Math.round(live.speedCms))} cm/s` : ''}` : '';
    messages.push(`Someone is present right now (${live.sources.join(' + ') || 'sensor'}${live.lastDistanceCm != null ? `, ~${Math.round(live.lastDistanceCm)} cm away` : ''}${move}).`);
  } else {
    messages.push(`No one detected — last presence ${fmtAgo(live.sinceMs)}.`);
  }
  if (live.dark != null) messages.push(`It's currently ${live.dark ? 'dark' : 'bright'} in the area (${Math.round(live.lux)} lux).`);
  messages.push(`${s.windowDetections} detections in the last ${Math.round(windowMs / HOUR)}h across ${sessions.length} occupancy session(s).`);
  if (peakHour != null) messages.push(`Busiest hour is ${String(peakHour).padStart(2, '0')}:00 (${peakCount} detections).`);
  if (avgDwellMs > 0) messages.push(`Average time a person stays is ~${Math.round(avgDwellMs / 1000)}s (longest ${Math.round(longest / 1000)}s).`);
  if (s.avgDistanceCm != null) messages.push(`Typical detection distance is ~${s.avgDistanceCm} cm.`);
  messages.push(agreement.message);
  if (anomaly.isAnomaly) messages.push(`⚠ ${anomaly.message}`);

  const recommendations = buildRecommendations({ s, agreement, anomaly, sessions, live });

  return {
    generatedAt: Date.now(),
    windowMs,
    live,
    summary: messages.join(' '),
    headline: live.present ? 'Presence active' : 'Area clear',
    metrics: {
      detections: s.windowDetections,
      sessions: sessions.length,
      peakHour,
      peakCount,
      avgDwellSec: Math.round(avgDwellMs / 1000),
      longestDwellSec: Math.round(longest / 1000),
      avgDistanceCm: s.avgDistanceCm,
      bySource: s.bySource,
    },
    fusion: agreement,
    anomaly,
    recommendations,
  };
}

function sensorAgreement(alerts, windowMs = 4000) {
  const mm = alerts.filter((a) => a.present && a.source === 'mmwave').map((a) => a.ts);
  const wf = alerts.filter((a) => a.present && a.source === 'wifi').map((a) => a.ts);
  if (!mm.length && !wf.length) return { score: null, message: 'Not enough data yet to judge sensor agreement.', mmwave: 0, wifi: 0 };
  const near = (list, t) => list.some((x) => Math.abs(x - t) <= windowMs);
  let agreed = 0;
  for (const t of mm) if (near(wf, t)) agreed++;
  const denom = Math.max(1, mm.length);
  const score = clamp01(agreed / denom);
  let message;
  if (score >= 0.7) message = `Sensors strongly agree (${Math.round(score * 100)}%) — high-confidence human detection.`;
  else if (score >= 0.3) message = `Sensors partially agree (${Math.round(score * 100)}%); mmWave and WiFi see different coverage zones.`;
  else message = `Low sensor overlap (${Math.round(score * 100)}%) — most detections come from a single sensor.`;
  return { score, message, mmwave: mm.length, wifi: wf.length, agreed };
}

function detectAnomaly(alerts) {
  const now = Date.now();
  const lastHour = alerts.filter((a) => a.present && now - a.ts <= HOUR).length;
  // Baseline: detections per hour bucket over the previous 7 days (excl. last hour).
  const buckets = new Map();
  for (const a of alerts) {
    if (!a.present) continue;
    if (now - a.ts <= HOUR) continue;
    if (now - a.ts > 7 * DAY) continue;
    const b = Math.floor(a.ts / HOUR);
    buckets.set(b, (buckets.get(b) || 0) + 1);
  }
  const values = [...buckets.values()];
  const m = mean(values);
  const sd = std(values);
  const z = sd > 0 ? (lastHour - m) / sd : (lastHour > m ? 3 : 0);
  const isAnomaly = values.length >= 6 && lastHour > 0 && z >= 2;
  return {
    isAnomaly,
    zScore: Number(z.toFixed(2)),
    lastHour,
    baselinePerHour: Number(m.toFixed(2)),
    message: isAnomaly
      ? `Unusual activity: ${lastHour} detections this hour vs a baseline of ${m.toFixed(1)} (z=${z.toFixed(1)}).`
      : `Activity is within normal range (${lastHour} this hour, baseline ${m.toFixed(1)}).`,
  };
}

function buildRecommendations({ s, agreement, anomaly, sessions, live }) {
  const recs = [];
  if (anomaly.isAnomaly) recs.push('Review the live feed — detection rate is spiking above normal.');
  if (agreement.score != null && agreement.score < 0.3 && agreement.mmwave > 5 && agreement.wifi > 5)
    recs.push('mmWave and WiFi rarely agree — check that both sensors cover the same area and re-aim the radar.');
  if (s.deviceCount === 0) recs.push('No devices have reported yet — flash the ESP32-S3 firmware and set the server URL.');
  if (!live.present && sessions.length === 0) recs.push('No presence recorded in this window; the area appears unoccupied.');
  if (s.avgDistanceCm != null && s.avgDistanceCm > 400) recs.push('Detections are far away (>4 m). Lower the radar max-distance gate to cut false positives.');
  if (!recs.length) recs.push('System healthy — sensors reporting and no anomalies detected.');
  return recs;
}

// ----- Natural-language assistant ----------------------------------------
// Lightweight intent matcher over the same analytics. Deterministic + offline.
export function ask(question = '') {
  const q = String(question).toLowerCase().trim();
  const s = stats(DAY);
  const live = liveState();
  const ins = () => insights({ windowMs: DAY });
  const has = (...w) => w.some((x) => q.includes(x));

  if (!q) return reply("Ask me things like: “is anyone here?”, “how many people today?”, “busiest hour?”, or “how far away?”");

  if (has('help', 'what can you', 'commands'))
    return reply('I can answer: presence now, last detection, counts (today/hour), busiest hour, distance, which sensor, device status, anomalies, and a full summary.');

  if (has('anyone', 'is someone', 'present now', 'right now', 'currently', 'occupied', 'anybody'))
    return reply(live.present
      ? `Yes — presence is active now via ${live.sources.join(' + ') || 'a sensor'}${live.lastDistanceCm != null ? ` at ~${Math.round(live.lastDistanceCm)} cm.` : '.'}`
      : `No one is present right now. Last detection was ${fmtAgo(live.sinceMs)}.`, { live });

  if (has('last', 'most recent', 'when was'))
    return reply(live.lastPresent
      ? `The last person was detected ${fmtAgo(live.sinceMs)} by ${live.lastPresent.source}${live.lastDistanceCm != null ? ` at ~${Math.round(live.lastDistanceCm)} cm.` : '.'}`
      : 'No presence has ever been recorded yet.', { last: live.lastPresent });

  if (has('how far', 'distance', 'how close', 'range'))
    return reply(s.avgDistanceCm != null
      ? `Average detection distance today is ~${s.avgDistanceCm} cm${live.lastDistanceCm != null ? ` (last reading ~${Math.round(live.lastDistanceCm)} cm).` : '.'}`
      : 'No distance data yet — the mmWave radar has not reported a range.');

  if (has('dark', 'light', 'lux', 'bright', 'night', 'day', 'outside'))
    return reply(live.lux != null
      ? `It's ${live.dark ? 'dark' : 'bright'} right now — ambient light is ${Math.round(live.lux)} lux (0=pitch black, 50=bright).`
      : 'No ambient-light reading yet from the sensor.', { lux: live.lux, dark: live.dark });

  if (has('approach', 'leaving', 'direction', 'coming', 'going', 'toward', 'moving'))
    return reply(live.direction
      ? `The last target was ${live.direction}${live.speedCms != null ? ` at ~${Math.abs(Math.round(live.speedCms))} cm/s.` : '.'}`
      : 'No movement/direction data yet.', { direction: live.direction, speed: live.speedCms });

  if (has('how fast', 'speed', 'velocity'))
    return reply(live.speedCms != null
      ? `The last target moved at ~${Math.abs(Math.round(live.speedCms))} cm/s (${live.direction || 'direction unknown'}).`
      : 'No speed data reported yet.');

  if (has('busiest', 'peak', 'what hour', 'which hour', 'when is it busy')) {
    const i = ins();
    return reply(i.metrics.peakHour != null
      ? `The busiest hour is ${String(i.metrics.peakHour).padStart(2, '0')}:00 with ${i.metrics.peakCount} detections.`
      : 'Not enough data to determine a busiest hour yet.');
  }

  if (has('which sensor', 'what sensor', 'mmwave or wifi', 'sensor detect')) {
    const mm = s.bySource.mmwave || 0, wf = s.bySource.wifi || 0;
    const lead = mm === wf ? 'both equally' : mm > wf ? 'the mmWave radar' : 'WiFi CSI';
    return reply(`Today: mmWave ${mm}, WiFi ${wf}, fusion ${s.bySource.fusion || 0}. ${lead} leads detections.`);
  }

  if (has('agree', 'fusion', 'confidence', 'accurate', 'reliable')) {
    const i = ins();
    return reply(i.fusion.message, { fusion: i.fusion });
  }

  if (has('anomaly', 'unusual', 'weird', 'strange', 'spike', 'alert')) {
    const i = ins();
    return reply(i.anomaly.message, { anomaly: i.anomaly });
  }

  if (has('device', 'esp', 'sensor online', 'online', 'connected')) {
    const devs = listDevices();
    const now = Date.now();
    if (!devs.length) return reply('No devices have connected yet.');
    const lines = devs.map((d) => `${d.name || d.id}: ${now - d.last_seen <= config.deviceTimeoutMs ? 'online' : `offline (${fmtAgo(now - d.last_seen)})`}`);
    return reply(`Devices — ${lines.join('; ')}.`, { devices: devs });
  }

  if (has('how many', 'count', 'today', 'number of', 'total')) {
    if (has('hour')) {
      const i = ins();
      return reply(`${i.anomaly.lastHour} detections in the last hour.`);
    }
    return reply(`${s.windowDetections} detections in the last 24h (${s.totalDetections} all-time).`);
  }

  if (has('summary', 'overview', 'status', 'report', 'how are things', 'brief'))
    return reply(ins().summary);

  // Fallback: return the summary so the user always gets something useful.
  return reply(`I wasn't sure exactly, so here's the current status: ${ins().summary}`);
}

function reply(answer, data = {}) {
  return { answer, data, at: Date.now() };
}
