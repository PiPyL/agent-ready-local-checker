import type { ScanCheck } from '../types';
import { fetchTextResource, isLikelyHtml } from '../utils/http';
import { clampText, stripHtml } from '../utils/text';

export async function checkMarkdownReadiness(pageUrl: string): Promise<ScanCheck[]> {
  const checks: ScanCheck[] = [];
  checks.push(await checkMarkdownNegotiation(pageUrl));
  checks.push(await checkMarkdownFallback(pageUrl));
  return checks;
}

export async function checkMarkdownNegotiation(pageUrl: string): Promise<ScanCheck> {
  try {
    const markdownRes = await fetchTextResource(pageUrl, {
      method: 'GET',
      headers: {
        Accept: 'text/markdown, text/plain;q=0.9, text/html;q=0.8'
      }
    });

    if (!markdownRes.ok) {
      return {
        id: 'markdown_negotiation',
        title: 'Markdown negotiation',
        category: 'agent-content',
        status: 'unknown',
        score: 0,
        maxScore: 10,
        severity: 'medium',
        effort: 'medium',
        message: `Could not request the current page. HTTP ${markdownRes.status}.`,
        fix: 'Verify the page allows browser requests and does not block extension-origin fetches.'
      };
    }

    const looksMarkdown = looksLikeMarkdown(markdownRes.text, markdownRes.contentType);
    const looksHtml = isLikelyHtml(markdownRes.contentType, markdownRes.text);
    const vary = markdownRes.headers['vary'] || '';
    const hasVaryAccept = /\baccept\b/i.test(vary);

    if (looksMarkdown && !looksHtml) {
      return {
        id: 'markdown_negotiation',
        title: 'Markdown negotiation',
        category: 'agent-content',
        status: hasVaryAccept ? 'pass' : 'warning',
        score: hasVaryAccept ? 10 : 8,
        maxScore: 10,
        severity: hasVaryAccept ? 'low' : 'medium',
        effort: 'medium',
        message: hasVaryAccept
          ? 'The page appears to return Markdown and declares Vary: Accept.'
          : 'The page appears to return Markdown, but Vary: Accept was not detected.',
        evidence: clampText(markdownRes.text, 500),
        fix: hasVaryAccept ? undefined : 'Add Vary: Accept so caches do not mix HTML and Markdown variants.'
      };
    }

    const plainText = stripHtml(markdownRes.text);
    return {
      id: 'markdown_negotiation',
      title: 'Markdown negotiation',
      category: 'agent-content',
      status: 'fail',
      score: 0,
      maxScore: 10,
      severity: 'medium',
      effort: 'medium',
      message: 'The page does not appear to support Markdown negotiation through the Accept header.',
      evidence: clampText(plainText, 300),
      fix: 'For important pages and docs, support Accept: text/markdown or provide agent-readable Markdown alternates.'
    };
  } catch {
    return {
      id: 'markdown_negotiation',
      title: 'Markdown negotiation',
      category: 'agent-content',
      status: 'unknown',
      score: 0,
      maxScore: 10,
      severity: 'medium',
      effort: 'medium',
      message: 'Could not verify Markdown negotiation.',
      fix: 'Check site CORS, redirects, and extension host permissions.'
    };
  }
}

async function checkMarkdownFallback(pageUrl: string): Promise<ScanCheck> {
  const target = new URL(pageUrl);
  const candidates = [
    `${target.origin}${normalizeDirectoryPath(target.pathname)}index.md`,
    `${target.origin}${target.pathname.replace(/\/$/, '')}.md`
  ];

  for (const candidate of [...new Set(candidates)]) {
    try {
      const res = await fetchTextResource(candidate, { headers: { Accept: 'text/markdown, text/plain;q=0.9' } }, 300_000);
      if (res.ok && looksLikeMarkdown(res.text, res.contentType) && !isLikelyHtml(res.contentType, res.text)) {
        return {
          id: 'markdown_fallback',
          title: 'Markdown fallback URL',
          category: 'agent-content',
          status: 'pass',
          score: 6,
          maxScore: 6,
          optional: true,
          severity: 'info',
          effort: 'low',
          message: `Markdown fallback found at ${candidate}.`,
          evidence: clampText(res.text, 300)
        };
      }
    } catch {
      // Continue with next fallback candidate.
    }
  }

  return {
    id: 'markdown_fallback',
    title: 'Markdown fallback URL',
    category: 'agent-content',
    status: 'warning',
    score: 0,
    maxScore: 6,
    optional: true,
    severity: 'low',
    effort: 'low',
    message: 'No /index.md or .md fallback was found for the current page.',
    fix: 'Optionally provide Markdown fallback URLs for agents that cannot negotiate Accept: text/markdown.'
  };
}

function looksLikeMarkdown(text: string, contentType: string): boolean {
  if (contentType.includes('text/markdown')) return true;
  const markdownSignals = [
    /^#\s+.+/m,
    /^##\s+.+/m,
    /^[-*]\s+\[[^\]]+\]\([^)]+\)/m,
    /```[\s\S]*?```/m,
    /\[[^\]]+\]\([^)]+\)/
  ];

  return markdownSignals.filter((regex) => regex.test(text)).length >= 2;
}

function normalizeDirectoryPath(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  if (pathname.endsWith('/')) return pathname;
  const segments = pathname.split('/');
  segments.pop();
  return `${segments.join('/')}/`;
}
