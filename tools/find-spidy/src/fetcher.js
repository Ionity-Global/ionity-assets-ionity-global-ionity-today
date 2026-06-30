// Picks the best way to fetch raw HTML for the current platform.
// - Electron desktop: IPC to main process (no CORS, real client).
// - Capacitor mobile: native HTTP plugin (no CORS).
// - Plain web browser: direct fetch first, then a CORS proxy fallback
//   (docs.google.com blocks cross-origin reads, so a proxy is required).

const DEFAULT_PROXY = 'https://api.allorigins.win/raw?url=';

export function platform() {
  if (typeof window !== 'undefined' && window.formInspector) return 'electron';
  if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) return 'capacitor';
  return 'web';
}

export async function fetchHtml(url, { proxy = DEFAULT_PROXY } = {}) {
  const target = url.trim();
  const plat = platform();

  if (plat === 'electron') {
    const res = await window.formInspector.analyze(target);
    if (!res.ok) throw new Error(res.error || 'desktop fetch failed');
    return { html: res.html, finalUrl: res.finalUrl || target, via: 'electron' };
  }

  if (plat === 'capacitor') {
    const { CapacitorHttp } = window.Capacitor.Plugins;
    const res = await CapacitorHttp.get({ url: target, headers: { 'User-Agent': 'Mozilla/5.0' } });
    return { html: String(res.data), finalUrl: target, via: 'capacitor' };
  }

  // web: try direct (works for CORS-friendly hosts), else proxy.
  try {
    const r = await fetch(target, { redirect: 'follow' });
    if (r.ok) return { html: await r.text(), finalUrl: r.url || target, via: 'direct' };
  } catch { /* fall through to proxy */ }

  const proxied = proxy + encodeURIComponent(target);
  const r2 = await fetch(proxied, { redirect: 'follow' });
  if (!r2.ok) throw new Error(`proxy fetch failed (${r2.status})`);
  return { html: await r2.text(), finalUrl: target, via: 'proxy' };
}

export async function saveReport(filename, content) {
  const plat = platform();
  if (plat === 'electron') {
    return window.formInspector.saveReport(filename, content);
  }
  // web / mobile: trigger a Blob download.
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
  return { ok: true, path: '(downloaded)' };
}
