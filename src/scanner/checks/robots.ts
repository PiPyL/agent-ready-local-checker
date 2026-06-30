import type { ScanCheck } from '../types';
import { fetchTextResource } from '../utils/http';
import { clampText, uniqueValues } from '../utils/text';

const AI_BOTS = ['GPTBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-Web', 'PerplexityBot', 'Google-Extended', 'CCBot'];
const SEARCH_BOTS = ['Googlebot', 'Bingbot'];

export interface RobotsRule {
  directive: 'allow' | 'disallow';
  path: string;
}

export interface RobotsGroup {
  userAgents: string[];
  rules: RobotsRule[];
}

export interface ContentSignal {
  key: string;
  value: string;
}

export interface RobotsParseResult {
  groups: RobotsGroup[];
  sitemapUrls: string[];
  contentSignals: ContentSignal[];
  invalidLineCount: number;
}

export interface RobotsScanData {
  text: string | null;
  sitemapUrls: string[];
  contentSignals: ContentSignal[];
  parseResult: RobotsParseResult | null;
}

export async function checkRobotsTxt(origin: string, pageUrl: string): Promise<{ checks: ScanCheck[]; data: RobotsScanData }> {
  const robotsUrl = `${origin}/robots.txt`;

  try {
    const resource = await fetchTextResource(robotsUrl, {}, 600_000);

    if (resource.status >= 500 || resource.status === 429) {
      return {
        checks: [
          {
            id: 'robots_fetchable',
            title: 'robots.txt fetchability',
            category: 'crawlability',
            status: 'fail',
            score: 0,
            maxScore: 12,
            severity: 'critical',
            effort: 'medium',
            message: `robots.txt returned HTTP ${resource.status}. Crawlers may temporarily stop or reduce crawling.`,
            fix: 'Ensure /robots.txt returns a stable 200, 404, or 410 response. Avoid 5xx and 429 for robots.txt.',
            evidence: `URL: ${robotsUrl}\nStatus: ${resource.status}`
          }
        ],
        data: { text: null, sitemapUrls: [], contentSignals: [], parseResult: null }
      };
    }

    if (!resource.ok) {
      return {
        checks: [
          {
            id: 'robots_fetchable',
            title: 'robots.txt fetchability',
            category: 'crawlability',
            status: 'warning',
            score: 8,
            maxScore: 12,
            severity: 'medium',
            effort: 'low',
            message: `robots.txt was not found or returned HTTP ${resource.status}. Search engines usually treat most 4xx responses as no crawl restrictions.`,
            fix: 'Publish a clear /robots.txt with Sitemap directives and explicit bot policy if you want predictable crawler behavior.',
            evidence: `URL: ${robotsUrl}\nStatus: ${resource.status}`
          }
        ],
        data: { text: null, sitemapUrls: [], contentSignals: [], parseResult: null }
      };
    }

    const parseResult = parseRobotsTxt(resource.text);
    const checks: ScanCheck[] = [
      {
        id: 'robots_fetchable',
        title: 'robots.txt fetchability',
        category: 'crawlability',
        status: 'pass',
        score: parseResult.invalidLineCount > 5 ? 9 : 12,
        maxScore: 12,
        severity: parseResult.invalidLineCount > 5 ? 'medium' : 'low',
        effort: 'low',
        message: parseResult.invalidLineCount > 5
          ? `robots.txt is fetchable, but ${parseResult.invalidLineCount} line(s) could not be parsed.`
          : 'robots.txt is fetchable and parseable.',
        evidence: clampText(resource.text, 700),
        fix: parseResult.invalidLineCount > 5 ? 'Remove invalid or malformed robots.txt lines and keep directives as field: value.' : undefined
      },
      checkSearchBotAccess(parseResult, pageUrl),
      checkAiBotAccess(parseResult, pageUrl),
      checkContentSignals(parseResult)
    ];

    return {
      checks,
      data: {
        text: resource.text,
        sitemapUrls: parseResult.sitemapUrls,
        contentSignals: parseResult.contentSignals,
        parseResult
      }
    };
  } catch {
    return {
      checks: [
        {
          id: 'robots_fetchable',
          title: 'robots.txt fetchability',
          category: 'crawlability',
          status: 'unknown',
          score: 0,
          maxScore: 12,
          severity: 'high',
          effort: 'medium',
          message: 'Could not verify robots.txt from the local extension.',
          fix: 'Check network access, host permissions, redirects, and whether the site blocks extension-origin requests.'
        }
      ],
      data: { text: null, sitemapUrls: [], contentSignals: [], parseResult: null }
    };
  }
}

export function parseRobotsTxt(text: string): RobotsParseResult {
  const groups: RobotsGroup[] = [];
  const sitemapUrls: string[] = [];
  const contentSignals: ContentSignal[] = [];
  let invalidLineCount = 0;
  let currentGroup: RobotsGroup | null = null;
  let hasSeenRulesForCurrentGroup = false;

  for (const rawLine of text.replace(/^\uFEFF/, '').split(/\r?\n|\r/)) {
    const line = stripComment(rawLine).trim();
    if (!line) continue;

    const match = /^([^:]+):\s*(.*)$/.exec(line);
    if (!match) {
      invalidLineCount += 1;
      continue;
    }

    const field = match[1].trim().toLowerCase();
    const value = match[2].trim();

    if (field === 'sitemap') {
      if (value) sitemapUrls.push(value);
      continue;
    }

    if (field === 'content-signal') {
      contentSignals.push(...parseContentSignal(value));
      continue;
    }

    if (field === 'user-agent') {
      if (!currentGroup || hasSeenRulesForCurrentGroup) {
        currentGroup = { userAgents: [], rules: [] };
        groups.push(currentGroup);
        hasSeenRulesForCurrentGroup = false;
      }
      if (value) currentGroup.userAgents.push(value.toLowerCase());
      continue;
    }

    if (field === 'allow' || field === 'disallow') {
      if (!currentGroup) {
        invalidLineCount += 1;
        continue;
      }
      currentGroup.rules.push({ directive: field, path: value });
      hasSeenRulesForCurrentGroup = true;
      continue;
    }
  }

  return {
    groups,
    sitemapUrls: uniqueValues(sitemapUrls),
    contentSignals,
    invalidLineCount
  };
}

function checkSearchBotAccess(parseResult: RobotsParseResult, pageUrl: string): ScanCheck {
  const blockedBots = SEARCH_BOTS.filter((bot) => !isAllowedByRobots(parseResult, pageUrl, bot));

  if (blockedBots.length > 0) {
    return {
      id: 'search_bot_access',
      title: 'Search bot access for current URL',
      category: 'crawlability',
      status: 'fail',
      score: 0,
      maxScore: 14,
      severity: 'critical',
      effort: 'medium',
      message: `The current URL appears blocked for: ${blockedBots.join(', ')}.`,
      fix: 'Review robots.txt Allow/Disallow rules and ensure important public pages are crawlable by major search bots.',
      evidence: `URL tested: ${pageUrl}`
    };
  }

  return {
    id: 'search_bot_access',
    title: 'Search bot access for current URL',
    category: 'crawlability',
    status: 'pass',
    score: 14,
    maxScore: 14,
    severity: 'low',
    message: 'The current URL appears crawlable by Googlebot and Bingbot based on robots.txt rules.'
  };
}

function checkAiBotAccess(parseResult: RobotsParseResult, pageUrl: string): ScanCheck {
  const explicitlyMentioned = AI_BOTS.filter((bot) => hasUserAgent(parseResult, bot));
  const blockedBots = AI_BOTS.filter((bot) => !isAllowedByRobots(parseResult, pageUrl, bot));

  if (blockedBots.length === AI_BOTS.length) {
    return {
      id: 'ai_bot_access',
      title: 'AI crawler access policy',
      category: 'bot-policy',
      status: 'warning',
      score: 2,
      maxScore: 10,
      severity: 'medium',
      effort: 'medium',
      message: 'All tracked AI crawlers appear blocked for the current URL.',
      fix: 'If GEO visibility is a goal, selectively allow useful AI crawlers or provide clear agent-readable alternatives such as llms.txt and Markdown pages.',
      evidence: `Blocked: ${blockedBots.join(', ')}`
    };
  }

  if (explicitlyMentioned.length === 0) {
    return {
      id: 'ai_bot_access',
      title: 'AI crawler access policy',
      category: 'bot-policy',
      status: 'warning',
      score: 6,
      maxScore: 10,
      severity: 'medium',
      effort: 'low',
      message: 'No explicit AI crawler policy was detected in robots.txt.',
      fix: 'Declare policies for relevant AI crawlers so site owners, agents, and governance teams can understand intended access.'
    };
  }

  return {
    id: 'ai_bot_access',
    title: 'AI crawler access policy',
    category: 'bot-policy',
    status: blockedBots.length > 0 ? 'warning' : 'pass',
    score: blockedBots.length > 0 ? 7 : 10,
    maxScore: 10,
    severity: blockedBots.length > 0 ? 'medium' : 'low',
    effort: 'low',
    message: blockedBots.length > 0
      ? `Explicit AI policy detected, but some AI crawlers appear blocked: ${blockedBots.join(', ')}.`
      : `Explicit AI policy detected for: ${explicitlyMentioned.join(', ')}.`,
    evidence: `Mentioned: ${explicitlyMentioned.join(', ') || 'none'}`
  };
}

function checkContentSignals(parseResult: RobotsParseResult): ScanCheck {
  if (parseResult.contentSignals.length === 0) {
    return {
      id: 'content_signals',
      title: 'Content Signals policy',
      category: 'bot-policy',
      status: 'warning',
      score: 0,
      maxScore: 6,
      optional: true,
      severity: 'low',
      effort: 'low',
      message: 'No Content-Signal directive was detected.',
      fix: 'Optionally add Content-Signal directives to communicate preferences for AI training, AI input, and search use.'
    };
  }

  return {
    id: 'content_signals',
    title: 'Content Signals policy',
    category: 'bot-policy',
    status: 'pass',
    score: 6,
    maxScore: 6,
    optional: true,
    severity: 'info',
    effort: 'low',
    message: 'Content-Signal directive detected.',
    evidence: parseResult.contentSignals.map((signal) => `${signal.key}=${signal.value}`).join(', ')
  };
}

export function isAllowedByRobots(parseResult: RobotsParseResult, targetUrl: string, userAgent: string): boolean {
  const selectedRules = getApplicableRules(parseResult, userAgent);
  if (selectedRules.length === 0) return true;

  const pathWithQuery = new URL(targetUrl).pathname + new URL(targetUrl).search;
  let winningRule: RobotsRule | null = null;
  let winningLength = -1;

  for (const rule of selectedRules) {
    if (!rule.path) continue;
    if (!matchesRobotsPath(rule.path, pathWithQuery)) continue;

    const length = rule.path.replace(/[*$]/g, '').length;
    if (length > winningLength || (length === winningLength && rule.directive === 'allow')) {
      winningRule = rule;
      winningLength = length;
    }
  }

  return winningRule ? winningRule.directive === 'allow' : true;
}

function getApplicableRules(parseResult: RobotsParseResult, userAgent: string): RobotsRule[] {
  const normalized = userAgent.toLowerCase();
  const matching = parseResult.groups
    .map((group) => {
      const matchedAgents = group.userAgents.filter((agent) => agent === '*' || normalized.includes(agent));
      const specificity = matchedAgents.reduce((max, agent) => Math.max(max, agent === '*' ? 0 : agent.length), -1);
      return { group, specificity };
    })
    .filter((item) => item.specificity >= 0);

  if (matching.length === 0) return [];
  const bestSpecificity = Math.max(...matching.map((item) => item.specificity));
  return matching.filter((item) => item.specificity === bestSpecificity).flatMap((item) => item.group.rules);
}

function matchesRobotsPath(rulePath: string, pathWithQuery: string): boolean {
  if (!rulePath) return false;

  const escaped = rulePath
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');

  const pattern = escaped.endsWith('$') ? `^${escaped.slice(0, -1)}$` : `^${escaped}`;
  return new RegExp(pattern).test(pathWithQuery);
}

function hasUserAgent(parseResult: RobotsParseResult, userAgent: string): boolean {
  const normalized = userAgent.toLowerCase();
  return parseResult.groups.some((group) => group.userAgents.some((agent) => agent === normalized));
}

function parseContentSignal(value: string): ContentSignal[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .map((part) => {
      const [key, signalValue] = part.split('=').map((item) => item.trim());
      return key && signalValue ? { key, value: signalValue } : null;
    })
    .filter((signal): signal is ContentSignal => Boolean(signal));
}

function stripComment(line: string): string {
  const hashIndex = line.indexOf('#');
  return hashIndex >= 0 ? line.slice(0, hashIndex) : line;
}
