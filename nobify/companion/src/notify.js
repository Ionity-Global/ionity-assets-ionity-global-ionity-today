// Cross-platform desktop notifications with graceful degradation:
//   1) node-notifier (rich, clickable) if installed
//   2) Windows balloon via PowerShell (built-in, no deps)
//   3) console fallback (always works)
import { spawn } from 'node:child_process';

let notifier = null;
let notifierTried = false;
let onClickCb = null;

async function getNotifier() {
  if (notifierTried) return notifier;
  notifierTried = true;
  try {
    const mod = await import('node-notifier');
    notifier = mod.default || mod;
    if (notifier?.on) notifier.on('click', () => onClickCb && onClickCb());
  } catch { notifier = null; }
  return notifier;
}

export function onNotificationClick(cb) { onClickCb = cb; }

// Open a URL in the default browser (cross-platform).
export function openUrl(url) {
  try {
    if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    else if (process.platform === 'darwin') spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    else spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
  } catch { /* ignore */ }
}

function winBalloon(title, message) {
  // Uses NotifyIcon balloon tip — available on any Windows box, no install.
  const esc = (s) => String(s).replace(/'/g, "''");
  const ps = `
Add-Type -AssemblyName System.Windows.Forms
$n = New-Object System.Windows.Forms.NotifyIcon
$n.Icon = [System.Drawing.SystemIcons]::Information
$n.BalloonTipTitle = '${esc(title)}'
$n.BalloonTipText = '${esc(message)}'
$n.Visible = $true
$n.ShowBalloonTip(6000)
Start-Sleep -Seconds 7
$n.Dispose()`;
  try {
    spawn('powershell', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps], { detached: true, stdio: 'ignore' }).unref();
    return true;
  } catch { return false; }
}

export async function notify({ title, message, sound = true, open = null }) {
  const forced = (process.env.NOBIFY_NOTIFY || '').toLowerCase(); // 'console' | 'balloon' | ''
  if (forced !== 'console') {
    const nn = await getNotifier();
    if (nn) {
      nn.notify({ title, message, sound, wait: false, timeout: 6, appID: 'Nobify' });
      return 'node-notifier';
    }
    if (forced !== 'balloon' && process.platform === 'win32' && winBalloon(title, message)) return 'win-balloon';
    if (forced === 'balloon' && winBalloon(title, message)) return 'win-balloon';
  }
  console.log(`\n  🔔 ${title}\n     ${message}\n`);
  return 'console';
}
