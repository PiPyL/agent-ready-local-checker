import type { ScanCheck } from '../types';
import { describeFallback, fetchTextResource, isLikelyHtml, isSpaHtmlFallback } from '../utils/http';
import { clampText, uniqueValues } from '../utils/text';

interface LlmsValidation {
  hasH1: boolean;
  hasSummaryBlockquote: boolean;
  sectionCount: number;
  optionalSection: boolean;
  links: string[];
  internalLinks: string[];
  markdownLinkCount: number;
  wordCount: number;
}

export async function checkLlmsFiles(origin: string): Promise<ScanCheck[]> {
  const llmsTxt = await checkLlmsFile(origin, '/llms.txt', 14, true);
  const llmsFullTxt = await checkLlmsFile(origin, '/llms-full.txt', 6, false);

  return [llmsTxt, llmsFullTxt];
}

async function checkLlmsFile(origin: string, path: '/llms.txt' | '/llms-full.txt', maxScore: number, required: boolean): Promise<ScanCheck> {
  const url = `${origin}${path}`;

  try {
    const resource = await fetchTextResource(url, {}, 500_000);

    if (!resource.ok) {
      return createMissingLlmsCheck(path, maxScore, required, `${path} was not found.`);
    }

    if (isSpaHtmlFallback(resource, path) || isLikelyHtml(resource.contentType, resource.text)) {
      return {
        id: path === '/llms.txt' ? 'llms_txt' : 'llms_full_txt',
        title: path,
        category: 'agent-content',
        status: required ? 'fail' : 'warning',
        score: 0,
        maxScore,
        optional: !required,
        severity: required ? 'high' : 'medium',
        effort: 'low',
        message: `${path} appears to return HTML fallback instead of a valid agent-readable text file.`,
        evidence: describeFallback(resource),
        fix: `Create a real static ${path} file and make sure the web server serves it before the SPA catch-all route.`
      };
    }

    const contentType = resource.contentType.toLowerCase();
    const looksTextLike = contentType.includes('text/plain') || contentType.includes('text/markdown') || contentType === '';

    if (!looksTextLike) {
      return {
        id: path === '/llms.txt' ? 'llms_txt' : 'llms_full_txt',
        title: path,
        category: 'agent-content',
        status: 'warning',
        score: Math.round(maxScore * 0.3),
        maxScore,
        optional: !required,
        severity: 'medium',
        effort: 'low',
        message: `${path} returned unexpected content-type: ${resource.contentType || 'unknown'}.`,
        evidence: describeFallback(resource),
        fix: `Serve ${path} as text/plain or text/markdown.`
      };
    }

    const validation = validateLlmsTxt(resource.text, origin);
    const issues = getLlmsIssues(validation, path);

    if (issues.length > 0) {
      return {
        id: path === '/llms.txt' ? 'llms_txt' : 'llms_full_txt',
        title: path,
        category: 'agent-content',
        status: issues.length >= 3 ? 'warning' : 'pass',
        score: Math.max(Math.round(maxScore * (issues.length >= 3 ? 0.55 : 0.8)), 1),
        maxScore,
        optional: !required,
        severity: issues.length >= 3 ? 'medium' : 'low',
        effort: 'low',
        message: `${path} exists but can be improved: ${issues.join('; ')}.`,
        evidence: clampText(resource.text, 700),
        fix: 'Follow the llms.txt structure: H1 title, blockquote summary, short context, curated ## sections, and Markdown links with concise descriptions.'
      };
    }

    return {
      id: path === '/llms.txt' ? 'llms_txt' : 'llms_full_txt',
      title: path,
      category: 'agent-content',
      status: 'pass',
      score: maxScore,
      maxScore,
      optional: !required,
      severity: 'low',
      effort: 'low',
      message: `${path} found and follows a useful agent-readable Markdown structure with ${validation.markdownLinkCount} curated link(s).`,
      evidence: clampText(resource.text, 700)
    };
  } catch {
    return {
      id: path === '/llms.txt' ? 'llms_txt' : 'llms_full_txt',
      title: path,
      category: 'agent-content',
      status: 'unknown',
      score: 0,
      maxScore,
      optional: !required,
      severity: required ? 'high' : 'low',
      effort: 'medium',
      message: `Could not verify ${path}.`,
      fix: 'Check whether the website blocks browser extension requests or redirects this file unexpectedly.'
    };
  }
}

function createMissingLlmsCheck(path: '/llms.txt' | '/llms-full.txt', maxScore: number, required: boolean, message: string): ScanCheck {
  return {
    id: path === '/llms.txt' ? 'llms_txt' : 'llms_full_txt',
    title: path,
    category: 'agent-content',
    status: required ? 'fail' : 'warning',
    score: 0,
    maxScore,
    optional: !required,
    severity: required ? 'high' : 'low',
    effort: 'low',
    message,
    fix: path === '/llms.txt'
      ? 'Create /llms.txt with a concise Markdown overview, blockquote summary, curated sections, and high-value links for AI agents.'
      : 'Optionally create /llms-full.txt for a more complete agent-readable content index.'
  };
}

function validateLlmsTxt(text: string, origin: string): LlmsValidation {
  const trimmed = text.trim();
  const markdownLinks = [...trimmed.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map((match) => match[2].trim());
  const absoluteLinks = markdownLinks
    .map((link) => toAbsoluteUrl(link, origin))
    .filter((link): link is string => Boolean(link));

  return {
    hasH1: /^#\s+\S+/m.test(trimmed),
    hasSummaryBlockquote: /^>\s+\S+/m.test(trimmed),
    sectionCount: (trimmed.match(/^##\s+\S+/gm) || []).length,
    optionalSection: /^##\s+Optional\b/im.test(trimmed),
    links: uniqueValues(absoluteLinks),
    internalLinks: uniqueValues(absoluteLinks.filter((link) => link.startsWith(origin))),
    markdownLinkCount: markdownLinks.length,
    wordCount: trimmed.split(/\s+/).filter(Boolean).length
  };
}

function getLlmsIssues(validation: LlmsValidation, path: string): string[] {
  const issues: string[] = [];

  if (!validation.hasH1) issues.push('missing H1 title');
  if (!validation.hasSummaryBlockquote) issues.push('missing blockquote summary');
  if (validation.sectionCount < 2) issues.push('needs at least two curated sections');
  if (validation.markdownLinkCount < 3) issues.push('too few Markdown links');
  if (path === '/llms.txt' && validation.wordCount > 1200) issues.push('too long for a concise llms.txt entry point');
  if (path === '/llms-full.txt' && validation.wordCount < 300) issues.push('too short for a full content index');
  if (validation.internalLinks.length === 0) issues.push('no internal curated links detected');

  return issues;
}

function toAbsoluteUrl(value: string, origin: string): string | null {
  try {
    return new URL(value, origin).href;
  } catch {
    return null;
  }
}
