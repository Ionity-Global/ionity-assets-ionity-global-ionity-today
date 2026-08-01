// Install page: wires GitHub download links from config.repo and adds
// copy-to-clipboard buttons + OS detection. All static (GitHub Pages friendly).
(function () {
  const cfg = window.NOBIFY_CONFIG || {};
  const repo = (cfg.repo || 'OWNER/REPO').replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
  const base = `https://github.com/${repo}`;
  const latest = `${base}/releases/latest`;
  const asset = (name) => `${latest}/download/${name}`;

  // Release asset names produced by the release workflow.
  const assets = {
    win: 'nobify-companion-win.exe',
    mac: 'nobify-companion-macos',
    linux: 'nobify-companion-linux',
  };

  const set = (id, href) => { const el = document.getElementById(id); if (el) el.href = href; };
  set('dl-win', asset(assets.win));
  set('dl-mac', asset(assets.mac));
  set('dl-linux', asset(assets.linux));
  set('dl-server', asset('nobify-server.mjs'));
  set('repo-link', base);

  document.querySelectorAll('.repo-slug').forEach((el) => { el.textContent = repo; });

  // GitHub Pages host for this repo (owner.github.io/repo), used in the
  // one-line install commands so they fetch install.ps1 / install.sh from here.
  const [owner, repoName] = repo.split('/');
  const pagesHost = cfg.pagesHost || `${(owner || 'owner').toLowerCase()}.github.io/${repoName || 'repo'}`;
  document.querySelectorAll('.pages-host').forEach((el) => { el.textContent = pagesHost; });

  const tree = `${base}/tree/HEAD/nobify`;
  const link = (sel, href) => document.querySelectorAll(sel).forEach((a) => { a.href = href; });
  link('.repo-tree', `${tree}/server`);
  link('.repo-tree-c', `${tree}/companion`);
  link('.repo-tree-f', `${tree}/firmware`);
  link('.repo-wiki', `${base}/wiki`);

  // Highlight the visitor's OS.
  const ua = navigator.userAgent;
  const os = /Win/i.test(ua) ? 'win' : /Mac/i.test(ua) ? 'mac' : /Linux|X11/i.test(ua) ? 'linux' : null;
  if (os) { const el = document.getElementById(`os-${os}`); if (el) el.classList.add('current'); }

  // Browser can't flash without WebSerial — flag the body so the flasher
  // section swaps to a "use Chrome/Edge" hint instead of a dead button.
  if (!('serial' in navigator)) document.body.classList.add('no-webserial');

  // One-line installer tabs (Windows vs macOS/Linux). Default to the visitor's OS.
  const preferUnix = os === 'mac' || os === 'linux';
  document.querySelectorAll('.oneliner-tabs').forEach((tabs) => {
    const scope = tabs.closest('section') || document;
    const showPane = (which) => {
      tabs.querySelectorAll('[data-oneliner]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.oneliner === which)));
      scope.querySelectorAll('[data-oneliner-pane]').forEach((p) => { p.hidden = p.dataset.onelinerPane !== which; });
    };
    tabs.querySelectorAll('[data-oneliner]').forEach((b) => b.addEventListener('click', () => showPane(b.dataset.oneliner)));
    showPane(preferUnix ? 'unix' : 'win');
  });

  // Copy buttons.
  function toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.hidden = false; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => { t.classList.remove('show'); t.hidden = true; }, 1600);
  }
  document.querySelectorAll('pre .copy').forEach((btn) => {
    btn.addEventListener('click', () => {
      const code = btn.parentElement.querySelector('code');
      const text = code ? code.innerText : '';
      navigator.clipboard?.writeText(text).then(() => toast('Copied to clipboard')).catch(() => toast('Copy failed'));
    });
  });
})();
