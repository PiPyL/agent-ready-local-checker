import { useMemo, useState } from 'react';
import { generateFixPrompt, generateMarkdownReport } from '../report/markdown';
import type { ScanResult } from '../scanner/types';
import { getPriorityScore, summarizeStatus } from '../scanner/scoring';

interface RuntimeResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export function App() {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => (scanResult ? summarizeStatus(scanResult.checks) : null), [scanResult]);
  const priorityIssues = useMemo(
    () => scanResult
      ? scanResult.checks
        .filter((check) => check.status === 'fail' || check.status === 'warning' || check.status === 'unknown')
        .sort((a, b) => getPriorityScore(b) - getPriorityScore(a))
        .slice(0, 5)
      : [],
    [scanResult]
  );

  async function runScan() {
    setLoading(true);
    setError(null);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab?.url || !tab.id) {
        throw new Error('Could not read current tab URL.');
      }

      if (!/^https?:\/\//i.test(tab.url)) {
        throw new Error('Only http and https pages can be scanned.');
      }

      const response = await chrome.runtime.sendMessage({
        type: 'RUN_SCAN',
        url: tab.url,
        tabId: tab.id
      }) as RuntimeResponse<ScanResult>;

      if (!response.ok || !response.data) {
        throw new Error(response.error || 'Scan failed.');
      }

      setScanResult(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function copyFixPrompt() {
    if (!scanResult) return;
    await navigator.clipboard.writeText(generateFixPrompt(scanResult));
  }

  async function copyMarkdownReport() {
    if (!scanResult) return;
    await navigator.clipboard.writeText(generateMarkdownReport(scanResult));
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Local-first SEO/GEO audit</p>
          <h1>AgentReady Checker</h1>
          <p className="subtitle">Audit crawlability, indexability, structured data, llms.txt, Markdown, and agent protocols. No backend. No tracking.</p>
        </div>
        <button className="primary-button" onClick={runScan} disabled={loading}>
          {loading ? 'Scanning…' : 'Scan current tab'}
        </button>
      </header>

      {error && <div className="alert">{error}</div>}

      {scanResult && summary && (
        <section className="result-card">
          <div className="score-row">
            <div>
              <p className="eyebrow">{scanResult.domain}</p>
              <h2>{scanResult.score}/100</h2>
              <p className="grade">{scanResult.grade} · {scanResult.siteProfiles.join(', ')}</p>
            </div>
            <div className="summary-grid" aria-label="Status summary">
              <StatusPill label="Pass" value={summary.pass} />
              <StatusPill label="Warn" value={summary.warning} />
              <StatusPill label="Fail" value={summary.fail} />
              <StatusPill label="N/A" value={summary.not_applicable} />
            </div>
          </div>

          <div className="actions">
            <button onClick={copyFixPrompt}>Copy fix prompt</button>
            <button onClick={copyMarkdownReport}>Copy report</button>
          </div>

          <section className="breakdown-card">
            <h3>Score breakdown</h3>
            <div className="breakdown-list">
              {scanResult.scoreBreakdown.map((item) => (
                <div className="breakdown-item" key={item.category}>
                  <span>{item.category}</span>
                  <strong>{item.percentage}%</strong>
                </div>
              ))}
            </div>
          </section>

          {priorityIssues.length > 0 && (
            <section className="priority-card">
              <h3>Top priority fixes</h3>
              {priorityIssues.map((check) => (
                <article className={`priority-item status-${check.status}`} key={check.id}>
                  <strong>{check.title}</strong>
                  <p>{check.message}</p>
                  {check.fix && <p className="fix">{check.fix}</p>}
                </article>
              ))}
            </section>
          )}

          <div className="checks-list">
            {scanResult.checks.map((check) => (
              <article className={`check-item status-${check.status}`} key={check.id}>
                <div className="check-header">
                  <div>
                    <h3>{check.title}</h3>
                    <p>{check.message}</p>
                  </div>
                  <strong>{check.maxScore > 0 ? `${check.score}/${check.maxScore}` : 'N/A'}</strong>
                </div>
                <div className="meta-row">
                  <span>{check.category}</span>
                  <span>{check.severity || 'medium'}</span>
                  {check.effort && <span>{check.effort}</span>}
                </div>
                {check.fix && <p className="fix">Fix: {check.fix}</p>}
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function StatusPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="status-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
