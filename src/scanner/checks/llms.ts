import type { ScanCheck } from '../types';

export async function checkLlmsFiles(origin: string): Promise<ScanCheck[]> {
  const llmsTxt = await checkLlmsFile(origin, '/llms.txt', 12, true);
  const llmsFullTxt = await checkLlmsFile(origin, '/llms-full.txt', 6, false);

  return [llmsTxt, llmsFullTxt];
}

async function checkLlmsFile(origin: string, path: '/llms.txt' | '/llms-full.txt', maxScore: number, required: boolean): Promise<ScanCheck> {
  const url = `${origin}${path}`;

  try {
    const res = await fetch(url, { cache: 'no-store' });

    if (!res.ok) {
      return {
        id: path === '/llms.txt' ? 'llms_txt' : 'llms_full_txt',
        title: path,
        category: 'agent-content',
        status: required ? 'fail' : 'warning',
        score: 0,
        maxScore,
        message: `${path} was not found.`,
        fix: path === '/llms.txt'
          ? 'Create /llms.txt with a concise overview of your product, docs, pricing, support, and key URLs for AI agents.'
          : 'Optionally create /llms-full.txt for a more complete agent-readable content index.'
      };
    }

    const text = await res.text();
    const length = text.trim().length;
    const hasMarkdownHeading = /^#\s+.+/m.test(text);

    if (length < 120 || !hasMarkdownHeading) {
      return {
        id: path === '/llms.txt' ? 'llms_txt' : 'llms_full_txt',
        title: path,
        category: 'agent-content',
        status: 'warning',
        score: Math.round(maxScore * 0.5),
        maxScore,
        message: `${path} exists but looks too thin or not Markdown-like.`,
        evidence: text.slice(0, 300),
        fix: 'Use Markdown headings and include a clear summary plus links to important pages.'
      };
    }

    return {
      id: path === '/llms.txt' ? 'llms_txt' : 'llms_full_txt',
      title: path,
      category: 'agent-content',
      status: 'pass',
      score: maxScore,
      maxScore,
      message: `${path} found and appears useful.`,
      evidence: text.slice(0, 300)
    };
  } catch {
    return {
      id: path === '/llms.txt' ? 'llms_txt' : 'llms_full_txt',
      title: path,
      category: 'agent-content',
      status: 'unknown',
      score: 0,
      maxScore,
      message: `Could not verify ${path}.`,
      fix: 'Check whether the website blocks browser extension requests.'
    };
  }
}
