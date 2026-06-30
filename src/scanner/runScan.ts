import { checkAiBotPolicy, checkRobotsTxt } from './checks/robots';
import { checkSitemap } from './checks/sitemap';
import { checkLlmsFiles } from './checks/llms';
import { checkMarkdownNegotiation } from './checks/markdown';
import { checkWellKnownEndpoints } from './checks/wellKnown';
import { checkDomReadiness } from './checks/dom';
import { calculateScore, getGrade } from './scoring';
import type { DomInsight, ScanCheck, ScanResult } from './types';

export async function runLocalScan(url: string, domInsight: DomInsight | null = null): Promise<ScanResult> {
  const target = new URL(url);
  const origin = target.origin;
  const checks: ScanCheck[] = [];

  const robotsResult = await checkRobotsTxt(origin);
  checks.push(robotsResult.check);
  checks.push(checkAiBotPolicy(robotsResult.data.text));

  checks.push(await checkSitemap(origin, robotsResult.data.sitemapUrls));
  checks.push(...(await checkLlmsFiles(origin)));
  checks.push(await checkMarkdownNegotiation(url));
  checks.push(...(await checkWellKnownEndpoints(origin)));
  checks.push(...checkDomReadiness(domInsight));

  const score = calculateScore(checks);

  return {
    url,
    origin,
    domain: target.hostname,
    scannedAt: new Date().toISOString(),
    score,
    grade: getGrade(score),
    checks
  };
}
