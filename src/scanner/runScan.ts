import { checkRobotsTxt } from './checks/robots';
import { checkSitemap } from './checks/sitemap';
import { checkLlmsFiles } from './checks/llms';
import { checkMarkdownReadiness } from './checks/markdown';
import { checkWellKnownEndpoints } from './checks/wellKnown';
import { checkDomReadiness } from './checks/dom';
import { checkIndexability } from './checks/indexability';
import { checkStructuredData } from './checks/structuredData';
import { checkApiDiscovery } from './checks/apiDiscovery';
import { calculateScore, calculateScoreBreakdown, getGrade } from './scoring';
import { inferSiteProfiles } from './siteProfile';
import type { DomInsight, ScanCheck, ScanResult } from './types';

export async function runLocalScan(url: string, domInsight: DomInsight | null = null): Promise<ScanResult> {
  const target = new URL(url);
  const origin = target.origin;
  const checks: ScanCheck[] = [];
  const siteProfiles = inferSiteProfiles(url, domInsight);

  const robotsResult = await checkRobotsTxt(origin, url);
  checks.push(...robotsResult.checks);

  const sitemapResult = await checkSitemap(origin, robotsResult.data.sitemapUrls);
  checks.push(...sitemapResult.checks);

  checks.push(...(await checkIndexability(url, domInsight)));
  checks.push(...(await checkLlmsFiles(origin)));
  checks.push(...(await checkMarkdownReadiness(url)));
  checks.push(...checkDomReadiness(url, domInsight, siteProfiles));
  checks.push(...checkStructuredData(domInsight, siteProfiles));
  checks.push(...(await checkApiDiscovery(origin, siteProfiles)));
  checks.push(...(await checkWellKnownEndpoints(origin, siteProfiles)));

  const scoreBreakdown = calculateScoreBreakdown(checks, siteProfiles);
  const score = calculateScore(checks, siteProfiles);

  return {
    url,
    origin,
    domain: target.hostname,
    scannedAt: new Date().toISOString(),
    score,
    grade: getGrade(score),
    siteProfiles,
    scoreBreakdown,
    checks
  };
}
