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
  set('repo-link', base);

  document.querySelectorAll('.repo-slug').forEach((el) => { el.textContent = repo; });
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
