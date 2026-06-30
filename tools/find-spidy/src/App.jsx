import React, { useState } from 'react';
import { parseMetadata, toMarkdownReport } from './parser.js';
import { fetchHtml, saveReport, platform } from './fetcher.js';

const SAMPLE = 'https://docs.google.com/forms/d/e/1FAIpQLSe1Dwz918fyIksqT-MG1frUXMhss0WB_pirEErTszcApSviuQ/viewform';

export default function App() {
  const [url, setUrl] = useState('');
  const [proxy, setProxy] = useState('https://api.allorigins.win/raw?url=');
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [via, setVia] = useState('');
  const plat = platform();

  async function analyze() {
    setErr(''); setData(null); setBusy(true);
    try {
      const { html, finalUrl, via } = await fetchHtml(url, { proxy });
      const md = parseMetadata(html, finalUrl);
      md.generatedAt = new Date().toISOString();
      setData(md); setVia(via);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    if (!data) return;
    const report = toMarkdownReport(data);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const res = await saveReport(`spidy-report-${stamp}.md`, report);
    if (res?.path && res.path !== '(downloaded)') alert('Saved to:\n' + res.path);
  }

  return (
    <div className="wrap">
      <header>
        <div className="logo">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9.5" stroke="rgba(255,255,255,0.35)" strokeWidth="1"/>
            <circle cx="12" cy="12" r="5.5" stroke="rgba(255,255,255,0.25)" strokeWidth="1"/>
            <circle cx="12" cy="12" r="2" stroke="rgba(255,255,255,0.5)" strokeWidth="1"/>
            <line x1="12" y1="2.5" x2="12" y2="21.5" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8"/>
            <line x1="2.5" y1="12" x2="21.5" y2="12" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8"/>
            <line x1="5.4" y1="5.4" x2="18.6" y2="18.6" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8"/>
            <line x1="18.6" y1="5.4" x2="5.4" y2="18.6" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8"/>
          </svg>
        </div>
        <div>
          <h1>Find Spidy</h1>
          <p className="sub">Web metadata spider &middot; {plat} build &middot; by Ionity</p>
        </div>
      </header>

      <div className="card">
        <label>URL to inspect</label>
        <div className="row">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://any-website.com  or  https://docs.google.com/forms/…"
            onKeyDown={(e) => e.key === 'Enter' && url && analyze()}
          />
          <button className="primary" disabled={!url || busy} onClick={analyze}>
            {busy ? 'Crawling…' : 'Inspect'}
          </button>
        </div>
        <button className="link" onClick={() => setUrl(SAMPLE)}>use sample Google Form</button>

        {plat === 'web' && (
          <details className="proxy">
            <summary>Web CORS proxy (needed for Google domains)</summary>
            <input value={proxy} onChange={(e) => setProxy(e.target.value)} />
            <small>Desktop / mobile builds fetch natively and ignore this.</small>
          </details>
        )}
      </div>

      {err && <div className="error">⚠ {err}</div>}

      {data && (
        <div className="results">
          <div className={'verdict ' + (data.isWorkspace ? 'warn' : 'ok')}>
            {data.identityVerdict}
          </div>

          <Section title="Core metadata">
            <table><tbody>
              <Row k="Title" v={data.title} />
              <Row k="Description" v={data.description} />
              <Row k="Canonical" v={data.canonical} link />
              <Row k="Favicon" v={data.favicon} link />
              <Row k="Author" v={data.author} />
              <Row k="Keywords" v={data.keywords} />
              <Row k="Robots" v={data.robots} />
              <Row k="Theme colour" v={data.themeColor} swatch />
              <Row k="Fetched via" v={via} />
              <Row k="Page size" v={`${data.bytes.toLocaleString()} bytes`} />
            </tbody></table>
          </Section>

          <Section title="Open Graph">
            <table><tbody>
              <Row k="og:title" v={data.ogTitle} />
              <Row k="og:description" v={data.ogDescription} />
              <Row k="og:type" v={data.ogType} />
              <Row k="og:site_name" v={data.siteName} />
              <Row k="og:image" v={data.ogImage} link />
              <Row k="og:url" v={data.ogUrl} link />
            </tbody></table>
          </Section>

          <Section title="Twitter / X Card">
            <table><tbody>
              <Row k="twitter:card" v={data.twitterCard} />
              <Row k="twitter:title" v={data.twitterTitle} />
              <Row k="twitter:description" v={data.twitterDescription} />
              <Row k="twitter:image" v={data.twitterImage} link />
              <Row k="twitter:site" v={data.twitterSite} />
            </tbody></table>
          </Section>

          {(data.buildLabel || data.workspaceOrg || data.region?.l1) && (
            <Section title="Google Forms">
              <table><tbody>
                <Row k="Workspace org" v={data.workspaceOrg} />
                <Row k="Build label" v={data.buildLabel} />
                <Row k="Region (l1/l2)" v={`${data.region.l1 ?? '—'} / ${data.region.l2 ?? '—'}`} />
              </tbody></table>
            </Section>
          )}

          {data.jsonLd?.length > 0 && (
            <Section title={`JSON-LD Structured Data (${data.jsonLd.length})`}>
              {data.jsonLd.map((obj, i) => (
                <div key={i} className="jsonld">
                  <div className="jsonld-type">{obj['@type'] || 'unknown'}</div>
                  <pre>{JSON.stringify(obj, null, 2)}</pre>
                </div>
              ))}
            </Section>
          )}

          <Section title={`Emails (${data.emails.length})`}>
            {data.emails.length
              ? <ul>{data.emails.map((e) => <li key={e}>{e}</li>)}</ul>
              : <p className="muted">none</p>}
          </Section>

          {data.questions.length > 0 && (
            <Section title={`Form Questions (${data.questions.length})`}>
              <ol>{data.questions.map((q, i) => (
                <li key={i}><span className="tag">{q.type}</span> {q.title}</li>
              ))}</ol>
            </Section>
          )}

          <button className="primary wide" onClick={download}>⬇ Save report to file (.md)</button>
        </div>
      )}

      <footer className="foot">
        Find Spidy by Ionity &middot; Reads only publicly served HTML &middot; ionity.today
      </footer>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Row({ k, v, link, swatch }) {
  const empty = v == null || v === '';
  return (
    <tr>
      <th>{k}</th>
      <td>
        {empty ? <span className="muted">absent</span>
          : swatch ? <span><i className="dot" style={{ background: v }} />{v}</span>
          : link ? <a href={v} target="_blank" rel="noreferrer">{v}</a>
          : String(v)}
      </td>
    </tr>
  );
}
