import type { ScanCheck } from '../types';

export async function checkMarkdownNegotiation(pageUrl: string): Promise<ScanCheck> {
  try {
    const res = await fetch(pageUrl, {
      method: 'GET',
      headers: {
        Accept: 'text/markdown, text/plain;q=0.9, text/html;q=0.8'
      },
      cache: 'no-store'
    });

    if (!res.ok) {
      return {
        id: 'markdown_negotiation',
        title: 'Markdown negotiation',
        category: 'agent-content',
        status: 'unknown',
        score: 0,
        maxScore: 10,
        message: `Could not request the current page. HTTP ${res.status}.`,
        fix: 'Verify the page allows browser requests and does not block extension-origin fetches.'
      };
    }

    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();
    const looksMarkdown = contentType.includes('text/markdown') || /^#\s+.+/m.test(text) || /\[[^\]]+\]\([^)]+\)/.test(text);
    const looksHtml = /<html|<!doctype html|<body/i.test(text);

    if (looksMarkdown && !looksHtml) {
      return {
        id: 'markdown_negotiation',
        title: 'Markdown negotiation',
        category: 'agent-content',
        status: 'pass',
        score: 10,
        maxScore: 10,
        message: 'The page appears to return Markdown when requested by Accept header.',
        evidence: text.slice(0, 300)
      };
    }

    return {
      id: 'markdown_negotiation',
      title: 'Markdown negotiation',
      category: 'agent-content',
      status: 'fail',
      score: 0,
      maxScore: 10,
      message: 'The page does not appear to support Markdown negotiation.',
      fix: 'For important pages and docs, support Accept: text/markdown or provide an agent-readable Markdown endpoint.'
    };
  } catch {
    return {
      id: 'markdown_negotiation',
      title: 'Markdown negotiation',
      category: 'agent-content',
      status: 'unknown',
      score: 0,
      maxScore: 10,
      message: 'Could not verify Markdown negotiation.',
      fix: 'Check site CORS, redirects, and extension host permissions.'
    };
  }
}
