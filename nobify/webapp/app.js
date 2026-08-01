/* Nobify dashboard — vanilla JS, no build step (GitHub Pages friendly). */
(() => {
  'use strict';
  const CFG = window.NOBIFY_CONFIG || {};
  const LS = {
    get url() { return localStorage.getItem('nobify.serverUrl') ?? (CFG.serverUrl || ''); },
    set url(v) { v ? localStorage.setItem('nobify.serverUrl', v) : localStorage.removeItem('nobify.serverUrl'); },
    get sound() { return localStorage.getItem('nobify.sound') === '1'; },
    set sound(v) { localStorage.setItem('nobify.sound', v ? '1' : '0'); },
    get notify() { return localStorage.getItem('nobify.notify') !== '0'; },
    set notify(v) { localStorage.setItem('nobify.notify', v ? '1' : '0'); },
  };

  // Resolve API base + WS URL.
  function apiBase() {
    const u = (LS.url || '').trim();
    if (u) return u.replace(/\/$/, '');
    return location.origin.startsWith('http') ? location.origin : 'http://localhost:8787';
  }
  function wsUrl() {
    const b = apiBase();
    return b.replace(/^http/, 'ws') + '/ws';
  }
  const api = (path, opts) => fetch(apiBase() + path, opts).then((r) => r.json());

  const $ = (id) => document.getElementById(id);
  const now = () => Date.now();

  // ---- Local presence state (drives LEDs + orb) --------------------------
  let holdMs = 8000;
  const sensorLast = { wifi: 0, mmwave: 0, fusion: 0 };
  let wasPresent = false;
  let everSawData = false;   // becomes true once any REAL detection arrives
  let lastNotify = 0;
  let snooze = null;
  let latest = { distance: null, direction: null, speed: null, lux: null, dark: null, rssi: null, source: null, sinceTs: null };

  const fmtAgo = (ts) => {
    if (!ts) return '—';
    const s = Math.round((now() - ts) / 1000);
    if (s < 5) return 'just now';
    if (s < 60) return `${s}s ago`;
    const m = Math.round(s / 60); if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60); if (h < 48) return `${h}h ago`;
    return `${Math.round(h / 24)}d ago`;
  };
  const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // ---- LEDs + orb --------------------------------------------------------
  function noteSource(source, ts) {
    ts = ts || now();
    everSawData = true;
    if (source === 'fusion') { sensorLast.wifi = ts; sensorLast.mmwave = ts; }
    else if (sensorLast[source] !== undefined) sensorLast[source] = ts;
  }
  function renderLive() {
    const t = now();
    const wifiOn = t - sensorLast.wifi <= holdMs;
    const mmOn = t - sensorLast.mmwave <= holdMs;
    $('led-wifi').classList.toggle('on', wifiOn);
    $('led-mmwave').classList.toggle('on', mmOn);

    const present = wifiOn || mmOn;
    const orb = $('orb');
    orb.classList.toggle('orb-present', present);
    orb.classList.toggle('orb-clear', !present);
    orb.classList.toggle('src-wifi', present && wifiOn && !mmOn);
    orb.classList.toggle('src-both', present && wifiOn && mmOn);
    $('orb-state').textContent = present ? 'PRESENT' : (everSawData ? 'CLEAR' : 'WAITING');
    $('orb-sub').textContent = present
      ? (wifiOn && mmOn ? 'mmWave + WiFi' : mmOn ? 'mmWave radar' : 'WiFi CSI')
      : (everSawData ? 'no one detected' : 'waiting for a sensor…');

    // Readout
    $('r-distance').textContent = latest.distance != null ? `${Math.round(latest.distance)} cm` : '—';
    $('r-movement').textContent = latest.direction
      ? `${dirArrow(latest.direction)} ${latest.direction}${latest.speed != null ? ` · ${Math.abs(Math.round(latest.speed))} cm/s` : ''}`
      : '—';
    $('r-light').textContent = latest.lux != null ? `${Math.round(latest.lux)} lux · ${latest.dark ? 'dark' : 'bright'}` : '—';
    $('r-lastseen').textContent = fmtAgo(latest.sinceTs);
    $('r-source').textContent = latest.source || '—';
    $('r-rssi').textContent = latest.rssi != null ? `${latest.rssi} dBm` : '—';

    // Movement speed indicator + arrival ETA
    const mm = $('movemeter');
    const spd = latest.speed != null ? Math.abs(latest.speed) : null;
    if (present && (spd != null || latest.direction)) {
      mm.hidden = false;
      const pct = spd != null ? Math.max(4, Math.min(100, (spd / 200) * 100)) : 0;
      const fill = $('mm-fill');
      fill.style.width = pct + '%';
      fill.className = 'mm-fill ' + (spd == null ? '' : spd < 2 ? 'mm-still' : spd < 150 ? 'mm-walk' : 'mm-fast');
      $('mm-dir').textContent = latest.direction
        ? `${dirArrow(latest.direction)} ${latest.direction}${spd != null ? ` · ${Math.round(spd)} cm/s` : ''}`
        : (spd != null ? `${Math.round(spd)} cm/s` : '—');
      let eta = '';
      if (latest.direction === 'approaching' && spd != null && spd >= 2 && latest.distance != null) {
        eta = `arriving in ~${Math.max(0, latest.distance / spd).toFixed(1)}s`;
      } else if (latest.direction === 'leaving') { eta = 'moving away'; }
      $('mm-eta').textContent = eta;
    } else { mm.hidden = true; }

    // Day/night chip
    const dn = $('daynight');
    if (latest.lux != null) {
      dn.style.display = '';
      dn.classList.toggle('is-dark', !!latest.dark);
      $('daynight-icon').textContent = latest.dark ? '🌙' : '☀️';
      $('daynight-lux').textContent = `${Math.round(latest.lux)} lux`;
    } else { dn.style.display = 'none'; }

    // Presence transition → notify
    if (present && !wasPresent) onPresenceStart();
    wasPresent = present;
  }
  const dirArrow = (d) => d === 'approaching' ? '⬇' : d === 'leaving' ? '⬆' : '•';

  function applyState(state) {
    if (!state) return;
    if (state.lastDistanceCm != null) latest.distance = state.lastDistanceCm;
    if (state.direction != null) latest.direction = state.direction;
    if (state.speedCms != null) latest.speed = state.speedCms;
    if (state.lux != null) { latest.lux = state.lux; latest.dark = state.dark; }
    if (state.lastPresent) { latest.rssi = state.lastPresent.rssi ?? latest.rssi; latest.source = state.lastPresent.source; latest.sinceTs = state.lastPresent.ts; }
    if (Array.isArray(state.sources)) for (const s of state.sources) noteSource(s);
    renderLive();
  }

  // ---- Feed --------------------------------------------------------------
  const feedEl = $('feed');
  function addFeed(alert) {
    if (feedEl.querySelector('.feed-empty')) feedEl.innerHTML = '';
    const li = document.createElement('li');
    li.className = 'feed-item' + (alert.present ? '' : ' cleared');
    const bits = [];
    if (alert.distance_cm != null) bits.push(`${Math.round(alert.distance_cm)} cm`);
    if (alert.direction) bits.push(`<span class="dir-arrow dir-${alert.direction}">${dirArrow(alert.direction)}</span> ${alert.direction}`);
    if (alert.speed_cms != null) bits.push(`${Math.abs(Math.round(alert.speed_cms))} cm/s`);
    if (alert.lux != null) bits.push(`${Math.round(alert.lux)} lux`);
    li.innerHTML = `
      <span class="badge badge-${alert.source}">${alert.source}</span>
      <span class="fi-main">${alert.present ? 'Person detected' : 'Area cleared'}${bits.length ? ' · ' + bits.join(' · ') : ''}</span>
      <span class="fi-time">${fmtTime(alert.ts)}</span>`;
    feedEl.prepend(li);
    while (feedEl.children.length > 60) feedEl.lastChild.remove();
  }

  // ---- Stats + chart -----------------------------------------------------
  function renderStats(s) {
    $('s-detections').textContent = s.windowDetections ?? 0;
    $('s-dist').textContent = s.avgDistanceCm != null ? `${s.avgDistanceCm} cm` : '—';
    let peakH = null, peakC = -1;
    for (const [h, c] of Object.entries(s.byHour || {})) if (c > peakC) { peakC = c; peakH = h; }
    $('s-peak').textContent = peakH != null ? `${String(peakH).padStart(2, '0')}:00` : '—';
    drawChart(s.byHour || {});
  }
  function drawChart(byHour) {
    const cv = $('hour-chart'); const ctx = cv.getContext('2d');
    const w = cv.clientWidth || 600; const h = 150; cv.width = w; cv.height = h;
    ctx.clearRect(0, 0, w, h);
    const pad = 22; const bw = (w - pad * 2) / 24;
    let max = 1; for (let i = 0; i < 24; i++) max = Math.max(max, byHour[i] || 0);
    const curH = new Date().getHours();
    ctx.font = '9px Segoe UI, sans-serif';
    for (let i = 0; i < 24; i++) {
      const v = byHour[i] || 0;
      const bh = Math.round((v / max) * (h - 34));
      const x = pad + i * bw; const y = h - 18 - bh;
      ctx.fillStyle = i === curH ? '#12d6a6' : '#2f3d63';
      ctx.fillRect(x + 1, y, bw - 2, bh);
      if (i % 3 === 0) { ctx.fillStyle = '#8a97b8'; ctx.fillText(String(i).padStart(2, '0'), x, h - 5); }
    }
  }
  window.addEventListener('resize', () => { if (lastStats) drawChart(lastStats.byHour || {}); });
  let lastStats = null;

  // ---- Devices -----------------------------------------------------------
  function renderDevices(list, timeoutMs) {
    const el = $('devices');
    if (!list || !list.length) { el.innerHTML = '<li class="muted">No devices yet.</li>'; return; }
    el.innerHTML = '';
    for (const d of list) {
      const online = now() - d.last_seen <= (timeoutMs || 30000);
      const li = document.createElement('li'); li.className = 'dev';
      li.innerHTML = `<div><strong>${escapeHtml(d.name || d.id)}</strong><br><span class="muted small">${escapeHtml(d.firmware || d.id)}${d.ip ? ' · ' + escapeHtml(d.ip) : ''}</span></div>
        <span class="dev-status ${online ? 'dev-online' : 'dev-offline'}">${online ? 'online' : 'offline'}</span>`;
      el.appendChild(li);
    }
  }

  // ---- AI ----------------------------------------------------------------
  async function loadInsights() {
    try {
      const i = await api('/api/ai/insights');
      $('ai-headline').textContent = i.headline || 'Status';
      $('ai-summary').textContent = i.summary || '';
      const an = $('ai-anomaly');
      if (i.anomaly && i.anomaly.isAnomaly) { an.hidden = false; an.textContent = '⚠ ' + i.anomaly.message; }
      else an.hidden = true;
      const recs = $('ai-recs'); recs.innerHTML = '';
      for (const r of i.recommendations || []) { const li = document.createElement('li'); li.textContent = r; recs.appendChild(li); }
    } catch { $('ai-summary').textContent = 'Could not reach the AI engine.'; }
  }
  function chatBubble(text, who) {
    const b = document.createElement('div'); b.className = `bubble bubble-${who}`; b.textContent = text;
    $('chat-log').appendChild(b); $('chat-log').scrollTop = $('chat-log').scrollHeight;
  }
  async function ask(q) {
    if (!q.trim()) return; chatBubble(q, 'user'); $('chat-input').value = '';
    try { const r = await api('/api/ai/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q }) }); chatBubble(r.answer, 'ai'); }
    catch { chatBubble('Sorry — I could not reach the server.', 'ai'); }
  }
  const SUGGESTIONS = ['Is anyone here?', 'How far away?', 'Are they approaching or leaving?', 'Is it dark?', 'Busiest hour?', 'Any anomalies?'];

  // ---- Notifications + snooze -------------------------------------------
  function isSnoozed() { return snooze && snooze.until > now(); }
  function onPresenceStart() {
    if (isSnoozed()) return;
    if (now() - lastNotify < 8000) return;
    lastNotify = now();
    const body = `${latest.source || 'Sensor'} · ${latest.distance != null ? Math.round(latest.distance) + ' cm' : 'presence'}${latest.direction ? ' · ' + latest.direction : ''}`;
    if (LS.notify && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification('Nobify — presence detected', { body, tag: 'nobify-presence', renotify: true }); } catch {}
    }
    toast('👤 Presence detected — ' + body);
    if (LS.sound) beep();
  }
  function renderSnooze() {
    const wrap = $('snooze-btns'); wrap.innerHTML = '';
    for (const m of (CFG.snoozePresets || [5, 15, 60])) {
      const b = document.createElement('button'); b.className = 'btn btn-sm'; b.textContent = `${m}m`;
      b.onclick = () => setSnooze(m); wrap.appendChild(b);
    }
    updateSnoozeStatus();
  }
  function updateSnoozeStatus() {
    const el = $('snooze-status');
    if (isSnoozed()) {
      const mins = Math.ceil((snooze.until - now()) / 60000);
      el.innerHTML = `🔕 Snoozed ${mins}m · <a href="#" id="snz-clear" style="color:inherit">clear</a>`;
      const c = $('snz-clear'); if (c) c.onclick = (e) => { e.preventDefault(); setSnooze(0, true); };
    } else el.textContent = '';
  }
  async function setSnooze(minutes, clear) {
    try {
      const r = await api('/api/snooze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(clear ? { clear: true } : { minutes }) });
      snooze = r.snooze; renderSnooze();
      toast(clear ? 'Snooze cleared' : `Alerts snoozed for ${minutes} minutes`);
    } catch { toast('Could not update snooze'); }
  }

  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 3500);
  }
  let audioCtx;
  function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
      o.frequency.value = 880; o.type = 'sine'; g.gain.value = 0.06;
      o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.15);
    } catch {}
  }
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---- WebSocket + polling ----------------------------------------------
  let ws, wsTimer, pollTimer, connected = false;
  function setConn(s) { document.body.dataset.connection = s; $('conn-text').textContent = s === 'connected' ? 'Live' : s === 'connecting' ? 'Connecting…' : 'Offline'; }
  function connectWs() {
    setConn('connecting');
    try { ws = new WebSocket(wsUrl()); } catch { scheduleReconnect(); return; }
    ws.onopen = () => { connected = true; setConn('connected'); stopPolling(); };
    ws.onclose = () => { connected = false; setConn('disconnected'); scheduleReconnect(); startPolling(); };
    ws.onerror = () => { try { ws.close(); } catch {} };
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.type === 'hello') { holdMs = m.state ? holdMs : holdMs; snooze = m.snooze; applyState(m.state); renderSnooze(); }
      else if (m.type === 'alert') { noteSource(m.alert.source, m.alert.ts); ingestAlertLatest(m.alert); addFeed(m.alert); applyState(m.state); if (m.snoozed) { /* suppress popup */ } refreshSoon(); }
      else if (m.type === 'state') { snooze = m.snooze !== undefined ? m.snooze : snooze; applyState(m.state); updateSnoozeStatus(); }
      else if (m.type === 'snooze') { snooze = m.snooze; renderSnooze(); }
    };
  }
  function ingestAlertLatest(a) {
    if (!a.present) { latest.sinceTs = latest.sinceTs; return; }
    if (a.distance_cm != null) latest.distance = a.distance_cm;
    if (a.direction != null) latest.direction = a.direction;
    if (a.speed_cms != null) latest.speed = a.speed_cms;
    if (a.lux != null) { latest.lux = a.lux; latest.dark = a.lux <= 5; }
    if (a.rssi != null) latest.rssi = a.rssi;
    latest.source = a.source; latest.sinceTs = a.ts;
  }
  function scheduleReconnect() { clearTimeout(wsTimer); wsTimer = setTimeout(connectWs, 3000); }
  function startPolling() { if (pollTimer) return; pollTimer = setInterval(pollOnce, CFG.pollMs || 4000); }
  function stopPolling() { clearInterval(pollTimer); pollTimer = null; }
  async function pollOnce() {
    try { const r = await api('/api/state'); snooze = r.snooze; applyState(r.state); setConn('connected'); updateSnoozeStatus(); }
    catch { setConn('disconnected'); }
  }

  let refreshT;
  function refreshSoon() { clearTimeout(refreshT); refreshT = setTimeout(refreshData, 1200); }
  async function refreshData() {
    try {
      const [s, d] = await Promise.all([api('/api/stats'), api('/api/devices')]);
      lastStats = s; renderStats(s); renderDevices(d.devices, d.timeoutMs);
      loadInsights();
    } catch {}
  }

  // ---- Init --------------------------------------------------------------
  async function init() {
    $('foot-server').textContent = apiBase();
    const fy = $('foot-year'); if (fy) fy.textContent = new Date().getFullYear();
    renderSnooze();
    // suggestion chips
    const sg = $('chat-suggest');
    for (const q of SUGGESTIONS) { const c = document.createElement('span'); c.className = 'chip'; c.textContent = q; c.onclick = () => ask(q); sg.appendChild(c); }
    // notifications button
    $('notif-btn').onclick = async () => {
      if (!('Notification' in window)) return toast('Notifications not supported');
      const p = await Notification.requestPermission();
      LS.notify = p === 'granted';
      toast(p === 'granted' ? 'Desktop notifications enabled' : 'Notifications blocked');
    };
    // chat
    $('chat-form').onsubmit = (e) => { e.preventDefault(); ask($('chat-input').value); };
    $('ai-refresh').onclick = loadInsights;
    $('clear-feed').onclick = () => { feedEl.innerHTML = '<li class="feed-empty">Cleared.</li>'; };
    // settings
    const dlg = $('settings-dialog');
    $('settings-btn').onclick = () => { $('cfg-url').value = LS.url; $('cfg-sound').checked = LS.sound; $('cfg-notify').checked = LS.notify; dlg.showModal(); };
    dlg.addEventListener('close', () => {
      if (dlg.returnValue === 'save') {
        LS.url = $('cfg-url').value.trim(); LS.sound = $('cfg-sound').checked; LS.notify = $('cfg-notify').checked;
        $('foot-server').textContent = apiBase(); toast('Settings saved — reconnecting…');
        try { ws && ws.close(); } catch {}
        connectWs();
      }
    });

    // initial data load
    try {
      const [state, alerts] = await Promise.all([api('/api/state'), api('/api/alerts?limit=40')]);
      snooze = state.snooze; applyState(state.state); renderSnooze();
      (alerts.alerts || []).slice().reverse().forEach((a) => { noteSource(a.source, a.ts); addFeed(a); });
      if (alerts.alerts && alerts.alerts[0]) ingestAlertLatest(alerts.alerts.find(a => a.present) || alerts.alerts[0]);
    } catch { toast('Cannot reach server — check Settings ⚙'); }
    refreshData();
    connectWs();
    setInterval(renderLive, 1000);   // fade LEDs / update "last seen"
    setInterval(updateSnoozeStatus, 15000);
    setInterval(refreshData, 30000);
  }
  document.addEventListener('DOMContentLoaded', init);
})();
