// Nobify dashboard runtime config.
// When the dashboard is served BY the Nobify server, it auto-uses that origin.
// When hosted on GitHub Pages (static), set your hosted backend URL here or via
// the in-app Settings panel (stored in localStorage, which overrides this file).
window.NOBIFY_CONFIG = {
  // Leave empty to use the page's own origin (works when served by the server).
  // For GitHub Pages, put your tunnel/host, e.g. "https://nobify.example.com".
  serverUrl: '',
  // Poll interval (ms) used as a fallback when WebSocket is unavailable.
  pollMs: 4000,
  // Default snooze presets (minutes) shown as buttons.
  snoozePresets: [5, 15, 60],
};
