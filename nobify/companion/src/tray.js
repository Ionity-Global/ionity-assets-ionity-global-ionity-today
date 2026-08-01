// Optional system-tray icon + menu via `systray2`. Returns null if the package
// isn't installed or the tray can't start, so the companion still runs headless.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(__dirname, '..', 'assets');

function iconBase64() {
  const file = process.platform === 'win32' ? 'tray.ico' : 'tray.png';
  const p = join(assetsDir, file);
  if (!existsSync(p)) return null;
  return readFileSync(p).toString('base64');
}

export async function createTray({ presets = [5, 15, 60], onOpen, onSnooze, onClear, onQuit }) {
  let SysTray;
  try { const m = await import('systray2'); SysTray = m.default || m; }
  catch { return null; }
  const icon = iconBase64();
  if (!icon) return null;

  const sep = { title: '<SEP>', enabled: false };
  const items = [
    { title: 'Open dashboard', tooltip: 'Open the Nobify dashboard', enabled: true },
    sep,
    ...presets.map((m) => ({ title: `Snooze ${m} min`, tooltip: 'Mute presence alerts', enabled: true })),
    { title: 'Clear snooze', tooltip: 'Resume alerts', enabled: true },
    sep,
    { title: 'Quit', tooltip: 'Exit the companion', enabled: true },
  ];

  let systray;
  try {
    systray = new SysTray({
      menu: { icon, isTemplateIcon: false, title: 'Nobify', tooltip: 'Nobify presence', items },
      debug: false, copyDir: true,
    });
  } catch { return null; }

  systray.onClick((action) => {
    const t = action?.item?.title || '';
    if (t === 'Open dashboard') onOpen?.();
    else if (t.startsWith('Snooze')) onSnooze?.(parseInt(t.replace(/\D+/g, ''), 10) || 15);
    else if (t === 'Clear snooze') onClear?.();
    else if (t === 'Quit') { onQuit?.(); try { systray.kill(false); } catch {} }
  });

  try { await systray.ready(); } catch { return null; }

  return {
    setTooltip(text) {
      try { systray.sendAction({ type: 'update-menu', menu: { icon, title: 'Nobify', tooltip: text, items } }); }
      catch { /* ignore */ }
    },
    kill() { try { systray.kill(false); } catch {} },
  };
}
