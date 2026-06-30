// Core, environment-agnostic metadata engine.
// Parses raw HTML from any URL — Google Forms or general websites.
// Pure string/regex — runs in browser, Electron main, or Capacitor webview.

const FORM_TYPE_MAP = {
  0: 'Short answer', 1: 'Paragraph', 2: 'Multiple choice', 3: 'Dropdown',
  4: 'Checkboxes', 5: 'Linear scale', 6: 'Title / section', 7: 'Grid',
  8: 'Page break', 9: 'Date', 10: 'Time', 11: 'Image', 12: 'Video',
  13: 'Video', 18: 'Rating',
};

function metaProp(html, prop, attr = 'property') {
  const re1 = new RegExp(`<meta[^>]*\\b${attr}="${prop}"[^>]*\\bcontent="([^"]*)"`, 'i');
  const re2 = new RegExp(`<meta[^>]*\\bcontent="([^"]*)"[^>]*\\b${attr}="${prop}"`, 'i');
  const m = html.match(re1) || html.match(re2);
  return m ? decodeEntities(m[1].trim()) : null;
}

function jsonStr(html, key) {
  const m = html.match(new RegExp(`"${key}":"((?:\\\\.|[^"\\\\])*)"`));
  return m ? decodeEntities(m[1].replace(/\\u003d/g, '=').replace(/\\\//g, '/')) : null;
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#0?39;/g, "'");
}

function extractFormQuestions(html) {
  const m = html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(\[[\s\S]*?\]);\s*<\/script>/);
  if (!m) return [];
  let data;
  try { data = JSON.parse(m[1]); } catch { return []; }
  const items = data && data[1] && data[1][1];
  if (!Array.isArray(items)) return [];
  return items.map((it) => ({
    title: it[1] ? decodeEntities(String(it[1])) : '(no text)',
    type: FORM_TYPE_MAP[it[3]] ?? `type ${it[3]}`,
    typeCode: it[3],
  }));
}

function extractJsonLd(html) {
  const results = [];
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try { results.push(JSON.parse(m[1].trim())); } catch { /* malformed, skip */ }
  }
  return results;
}

function extractCanonical(html) {
  const m = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/) ||
            html.match(/<link[^>]*href="([^"]*)"[^>]*rel="canonical"/);
  return m ? decodeEntities(m[1]) : null;
}

function extractFavicon(html, baseUrl) {
  const m = html.match(/<link[^>]*rel="(?:shortcut )?icon"[^>]*href="([^"]*)"/) ||
            html.match(/<link[^>]*href="([^"]*)"[^>]*rel="(?:shortcut )?icon"/);
  if (!m) return null;
  const href = decodeEntities(m[1]);
  if (href.startsWith('http')) return href;
  try {
    const base = new URL(baseUrl);
    return new URL(href, base).href;
  } catch { return href; }
}

export function parseMetadata(html, sourceUrl = '') {
  const titleTag = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1];

  // Google Forms Workspace anti-phishing org banner
  const footerM = html.match(/created inside\s+([^<]+?)\.\s*</i);
  const doddn = jsonStr(html, 'docs-doddn');
  const workspaceOrg = (doddn && doddn.trim()) || (footerM && footerM[1].trim()) || null;

  const emails = Array.from(
    new Set((html.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [])
      .filter((e) => !/@(\d|sentinel)/.test(e)))
  );

  const questions = extractFormQuestions(html);
  const jsonLd = extractJsonLd(html);

  return {
    fetchedUrl: sourceUrl,
    bytes: html.length,

    // Core
    title: (titleTag ? decodeEntities(titleTag) : metaProp(html, 'og:title')) || null,
    description: metaProp(html, 'description', 'name') || metaProp(html, 'og:description'),
    canonical: extractCanonical(html),
    favicon: extractFavicon(html, sourceUrl),

    // Open Graph
    ogTitle: metaProp(html, 'og:title'),
    ogDescription: metaProp(html, 'og:description'),
    ogImage: metaProp(html, 'og:image'),
    ogUrl: metaProp(html, 'og:url'),
    ogType: metaProp(html, 'og:type'),
    siteName: metaProp(html, 'og:site_name'),

    // Twitter / X Card
    twitterCard: metaProp(html, 'twitter:card', 'name'),
    twitterTitle: metaProp(html, 'twitter:title', 'name'),
    twitterDescription: metaProp(html, 'twitter:description', 'name'),
    twitterImage: metaProp(html, 'twitter:image', 'name'),
    twitterSite: metaProp(html, 'twitter:site', 'name'),

    // General meta
    author: metaProp(html, 'author', 'name'),
    keywords: metaProp(html, 'keywords', 'name'),
    robots: metaProp(html, 'robots', 'name'),
    themeColor: metaProp(html, 'theme-color', 'name'),

    // Google Forms specific
    buildLabel: jsonStr(html, 'buildLabel'),
    region: { l1: jsonStr(html, 'docs-l1lm'), l2: jsonStr(html, 'docs-l2lm') },
    workspaceOrg,
    isWorkspace: Boolean(workspaceOrg),

    // Structured data
    jsonLd,

    emails,
    questions,

    identityVerdict: workspaceOrg
      ? `Workspace form — org banner reveals: "${workspaceOrg}"`
      : questions.length
        ? 'Google Form (consumer) — no owner/org disclosed.'
        : 'Standard website — metadata shown below.',
  };
}

// Keep old name as alias for any external callers.
export const parseFormMetadata = parseMetadata;

export function toMarkdownReport(md) {
  const L = [];
  L.push(`# Find Spidy — Metadata Report`);
  L.push('');
  L.push(`- **URL:** ${md.fetchedUrl || '—'}`);
  L.push(`- **Generated:** ${md.generatedAt || ''}`);
  L.push(`- **Page size:** ${md.bytes?.toLocaleString?.() ?? md.bytes} bytes`);
  L.push('');
  L.push(`## Verdict`);
  L.push(`> ${md.identityVerdict}`);
  L.push('');

  const row = (k, v) => `| ${k} | ${v == null || v === '' ? '_absent_' : String(v).replace(/\|/g, '\\|')} |`;

  L.push(`## Core`);
  L.push('| Field | Value |');
  L.push('|---|---|');
  L.push(row('Title', md.title));
  L.push(row('Description', md.description));
  L.push(row('Canonical', md.canonical));
  L.push(row('Favicon', md.favicon));
  L.push(row('Author', md.author));
  L.push(row('Keywords', md.keywords));
  L.push(row('Robots', md.robots));
  L.push(row('Theme colour', md.themeColor));
  L.push('');

  L.push(`## Open Graph`);
  L.push('| Field | Value |');
  L.push('|---|---|');
  L.push(row('og:title', md.ogTitle));
  L.push(row('og:description', md.ogDescription));
  L.push(row('og:type', md.ogType));
  L.push(row('og:site_name', md.siteName));
  L.push(row('og:image', md.ogImage));
  L.push(row('og:url', md.ogUrl));
  L.push('');

  L.push(`## Twitter / X Card`);
  L.push('| Field | Value |');
  L.push('|---|---|');
  L.push(row('twitter:card', md.twitterCard));
  L.push(row('twitter:title', md.twitterTitle));
  L.push(row('twitter:description', md.twitterDescription));
  L.push(row('twitter:image', md.twitterImage));
  L.push(row('twitter:site', md.twitterSite));
  L.push('');

  if (md.buildLabel || md.workspaceOrg || md.region?.l1) {
    L.push(`## Google Forms`);
    L.push('| Field | Value |');
    L.push('|---|---|');
    L.push(row('Build label', md.buildLabel));
    L.push(row('Region (l1/l2)', `${md.region?.l1 ?? '—'} / ${md.region?.l2 ?? '—'}`));
    L.push(row('Workspace org', md.workspaceOrg));
    L.push('');
  }

  if (md.jsonLd?.length) {
    L.push(`## JSON-LD Structured Data (${md.jsonLd.length})`);
    md.jsonLd.forEach((obj, i) => {
      L.push(`### Block ${i + 1}: ${obj['@type'] || 'unknown'}`);
      L.push('```json');
      L.push(JSON.stringify(obj, null, 2));
      L.push('```');
    });
    L.push('');
  }

  L.push(`## Emails (${md.emails?.length || 0})`);
  L.push(md.emails?.length ? md.emails.map((e) => `- ${e}`).join('\n') : '_none_');
  L.push('');

  L.push(`## Form Questions (${md.questions?.length || 0})`);
  if (md.questions?.length) {
    md.questions.forEach((q, i) => L.push(`${i + 1}. **[${q.type}]** ${q.title}`));
  } else {
    L.push('_none (not a Google Form, or form definition not in public HTML)_');
  }

  L.push('');
  L.push('---');
  L.push('_Find Spidy by Ionity · Reads only publicly served HTML._');
  return L.join('\n');
}
