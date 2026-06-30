import { useMemo, useState } from 'react';
import { generateFixPrompt, generateMarkdownReport } from '../report/markdown';
import type { ScanResult } from '../scanner/types';
import { summarizeStatus } from '../scanner/scoring';

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
          <p className="eyebrow">Local-first</p>
          <h1>AgentReady Checker</h1>
          <p className="subtitle">Audit the current website for AI agent readiness. No backend. No tracking.</p>
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
              <p className="grade">{scanResult.grade}</p>
            </div>
            <div className="summary-grid" aria-label="Status summary">
              <StatusPill label="Pass" value={summary.pass} />
              <StatusPill label="Warn" value={summary.warning} />
              <StatusPill label="Fail" value={summary.fail} />
              <StatusPill label="Unknown" value={summary.unknown} />
            </div>
          </div>

          <div className="actions">
            <button onClick={copyFixPrompt}>Copy fix prompt</button>
            <button onClick={copyMarkdownReport}>Copy report</button>
          </div>

          <div className="checks-list">
            {scanResult.checks.map((check) => (
              <article className={`check-item status-${check.status}`} key={check.id}>
                <div className="check-header">
                  <div>
                    <h3>{check.title}</h3>
                    <p>{check.message}</p>
                  </div>
                  <strong>{check.score}/{check.maxScore}</strong>
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
