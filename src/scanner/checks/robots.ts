import type { ScanCheck } from '../types';

const AI_USER_AGENT_PATTERNS = [
  'GPTBot',
  'ChatGPT-User',
  'Google-Extended',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'PerplexityBot',
  'CCBot',
  'Bytespider',
  'Applebot-Extended'
];

export interface RobotsScanData {
  text: string | null;
  sitemapUrls: string[];
}

export async function checkRobotsTxt(origin: string): Promise<{ check: ScanCheck; data: RobotsScanData }> {
  const url = `${origin}/robots.txt`;

  try {
    const res = await fetch(url, { cache: 'no-store' });

    if (!res.ok) {
      return {
        check: {
          id: 'robots_txt',
          title: 'robots.txt',
          category: 'discoverability',
          status: 'fail',
          score: 0,
          maxScore: 10,
          message: 'robots.txt was not found.',
          fix: 'Create /robots.txt and declare crawler rules plus Sitemap directives.'
        },
        data: { text: null, sitemapUrls: [] }
      };
    }

    const text = await res.text();
    const sitemapUrls = extractSitemapUrls(text);

    return {
      check: {
        id: 'robots_txt',
        title: 'robots.txt',
        category: 'discoverability',
        status: 'pass',
        score: sitemapUrls.length > 0 ? 10 : 8,
        maxScore: 10,
        message: sitemapUrls.length > 0 ? 'robots.txt found with Sitemap directive.' : 'robots.txt found, but no Sitemap directive was detected.',
        evidence: text.slice(0, 500),
        fix: sitemapUrls.length > 0 ? undefined : 'Add a Sitemap directive, for example: Sitemap: https://example.com/sitemap.xml'
      },
      data: { text, sitemapUrls }
    };
  } catch {
    return {
      check: {
        id: 'robots_txt',
        title: 'robots.txt',
        category: 'discoverability',
        status: 'unknown',
        score: 0,
        maxScore: 10,
        message: 'Could not verify robots.txt.',
        fix: 'Check whether the site blocks extension requests or has strict network rules.'
      },
      data: { text: null, sitemapUrls: [] }
    };
  }
}

export function checkAiBotPolicy(robotsText: string | null): ScanCheck {
  if (!robotsText) {
    return {
      id: 'ai_bot_policy',
      title: 'AI bot policy',
      category: 'bot-policy',
      status: 'unknown',
      score: 0,
      maxScore: 8,
      message: 'Could not inspect AI bot policy because robots.txt is unavailable.',
      fix: 'Publish robots.txt and explicitly define crawler access for AI-related user agents.'
    };
  }

  const mentionedAgents = AI_USER_AGENT_PATTERNS.filter((agent) => new RegExp(`user-agent:\\s*${escapeRegExp(agent)}`, 'i').test(robotsText));

  if (mentionedAgents.length === 0) {
    return {
      id: 'ai_bot_policy',
      title: 'AI bot policy',
      category: 'bot-policy',
      status: 'warning',
      score: 4,
      maxScore: 8,
      message: 'No explicit AI crawler policy was detected.',
      fix: 'Add explicit policy blocks for relevant AI crawlers so agents can understand allowed access.'
    };
  }

  return {
    id: 'ai_bot_policy',
    title: 'AI bot policy',
    category: 'bot-policy',
    status: 'pass',
    score: 8,
    maxScore: 8,
    message: `AI crawler policy detected for: ${mentionedAgents.join(', ')}.`,
    evidence: mentionedAgents.join(', ')
  };
}

function extractSitemapUrls(robotsText: string): string[] {
  return robotsText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^sitemap:/i.test(line))
    .map((line) => line.replace(/^sitemap:\s*/i, '').trim())
    .filter(Boolean);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
