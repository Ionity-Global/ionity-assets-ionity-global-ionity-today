// Electron main process (Windows desktop).
// Fetches the target URL with no CORS restriction and writes reports to disk.
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const https = require('node:https');
const http = require('node:http');

const isDev = !!process.env.VITE_DEV_SERVER_URL || !app.isPackaged;

function get(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('too many redirects'));
    const lib = url.startsWith('http://') ? http : https;
    const req = lib.get(
      url,
      { headers: { 'User-Agent': 'Mozilla/5.0 (FormMetadataInspector)' } },
      (res) => {
        const { statusCode, headers } = res;
        if (statusCode >= 300 && statusCode < 400 && headers.location) {
          res.resume();
          const next = new URL(headers.location, url).toString();
          return resolve(get(next, redirects + 1));
        }
        if (statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${statusCode}`));
        }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ html: body, finalUrl: url }));
      }
    );
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
  });
}

ipcMain.handle('analyze', async (_e, url) => {
  try {
    const { html, finalUrl } = await get(url);
    return { ok: true, html, finalUrl };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('saveReport', async (_e, filename, content) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: filename,
    filters: [{ name: 'Markdown', extensions: ['md'] }, { name: 'All', extensions: ['*'] }],
  });
  if (canceled || !filePath) return { ok: false, error: 'cancelled' };
  fs.writeFileSync(filePath, content, 'utf8');
  return { ok: true, path: filePath };
});

function createWindow() {
  const win = new BrowserWindow({
    width: 920,
    height: 800,
    backgroundColor: '#0b0d12',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs') },
  });
  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  if (isDev) win.loadURL(devUrl);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
