// Seed the database with realistic demo data so the dashboard and AI engine
// have something to show without hardware. Run: npm run seed
import { upsertDevice, insertAlert } from '../src/db.js';

const DEVICE = 'esp32-s3-demo';
upsertDevice({ id: DEVICE, name: 'Lobby Sensor (demo)', ip: '192.168.1.42', firmware: 'nobify-fw/1.0.0-demo' });

const now = Date.now();
const HOUR = 3600 * 1000;
let inserted = 0;

// Generate 3 days of presence sessions with a daily activity curve.
for (let h = 72; h >= 0; h--) {
  const t0 = now - h * HOUR;
  const hourOfDay = new Date(t0).getHours();
  // Busy 8-11 and 13-18, quiet at night.
  const activity = (hourOfDay >= 8 && hourOfDay <= 11) ? 0.8
    : (hourOfDay >= 13 && hourOfDay <= 18) ? 0.9
    : (hourOfDay >= 6 && hourOfDay <= 22) ? 0.35 : 0.05;
  const sessions = Math.random() < activity ? 1 + Math.floor(Math.random() * 3) : 0;
  for (let s = 0; s < sessions; s++) {
    const start = t0 + Math.floor(Math.random() * HOUR);
    const dwell = 3000 + Math.floor(Math.random() * 40000);
    let dist = 60 + Math.floor(Math.random() * 300);
    const rssi = -45 - Math.floor(Math.random() * 30);
    // Ambient light tracks time of day (0..50 lux; low at night).
    const lux = (hourOfDay >= 7 && hourOfDay <= 18) ? 20 + Math.floor(Math.random() * 30)
      : (hourOfDay >= 19 && hourOfDay <= 21) ? 5 + Math.floor(Math.random() * 15)
      : Math.floor(Math.random() * 4);
    // A session emits several detections; mmWave + occasionally WiFi CSI.
    let prevDist = dist;
    for (let t = start; t <= start + dwell; t += 1500) {
      const step = Math.floor(Math.random() * 40) - 20;
      dist = Math.max(30, prevDist + step);
      const speed = Math.round((dist - prevDist) / 1.5); // cm per 1.5s -> ~cm/s
      const direction = Math.abs(speed) < 2 ? 'stationary' : (speed < 0 ? 'approaching' : 'leaving');
      insertAlert({ ts: t, device_id: DEVICE, source: 'mmwave', present: true, distance_cm: dist, speed_cms: speed, direction, lux, rssi, confidence: 0.7 + Math.random() * 0.3 });
      inserted++;
      if (Math.random() < 0.4) { insertAlert({ ts: t + 200, device_id: DEVICE, source: 'wifi', present: true, lux, rssi, confidence: 0.5 + Math.random() * 0.3 }); inserted++; }
      prevDist = dist;
    }
    insertAlert({ ts: start + dwell + 1000, device_id: DEVICE, source: 'mmwave', present: false, lux, rssi });
    inserted++;
  }
}

// Add a live "present now" burst so the dashboard lights up immediately.
for (let t = now - 4000; t <= now; t += 1200) {
  insertAlert({ ts: t, device_id: DEVICE, source: 'mmwave', present: true, distance_cm: 140 + Math.random() * 20, speed_cms: -6, direction: 'approaching', lux: 3, rssi: -52, confidence: 0.92 });
  insertAlert({ ts: t + 150, device_id: DEVICE, source: 'wifi', present: true, lux: 3, rssi: -52, confidence: 0.71 });
  inserted += 2;
}

console.log(`Seeded ${inserted} detections for device "${DEVICE}".`);
