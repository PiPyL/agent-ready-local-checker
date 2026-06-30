import type { ScanCheck } from '../types';
import { fetchTextResource } from '../utils/http';
import { clampText, uniqueValues } from '../utils/text';

interface ParsedSitemap {
  url: string;
  isIndex: boolean;
  urls: string[];
  childSitemaps: string[];
  lastmods: string[];
  valid: boolean;
}

export interface SitemapScanData {
  discoveredSitemaps: string[];
  sampledUrls: string[];
}

export async function checkSitemap(origin: string, sitemapUrls: string[]): Promise<{ checks: ScanCheck[]; data: SitemapScanData }> {
  const candidates = uniqueValues([...sitemapUrls, `${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`]);
  const parsedSitemaps: ParsedSitemap[] = [];

  for (const candidate of candidates.slice(0, 6)) {
    const parsed = await fetchAndParseSitemap(candidate);
    if (parsed) parsedSitemaps.push(parsed);
  }

  const validRoots = parsedSitemaps.filter((sitemap) => sitemap.valid);
  const childCandidates = uniqueValues(validRoots.flatMap((sitemap) => sitemap.childSitemaps)).slice(0, 5);

  for (const child of childCandidates) {
    const parsed = await fetchAndParseSitemap(child);
    if (parsed) parsedSitemaps.push(parsed);
  }

  const validSitemaps = parsedSitemaps.filter((sitemap) => sitemap.valid);
  const sampledUrls = uniqueValues(validSitemaps.flatMap((sitemap) => sitemap.urls)).slice(0, 30);

  if (validSitemaps.length === 0) {
    return {
      checks: [
        {
          id: 'sitemap_discovery',
          title: 'Sitemap discovery',
          category: 'discoverability',
          status: 'fail',
          score: 0,
          maxScore: 12,
          severity: 'high',
          effort: 'low',
          message: 'No valid XML sitemap or sitemap index was found.',
          fix: 'Publish /sitemap.xml or declare a fully qualified Sitemap URL in robots.txt.',
          evidence: `Tried: ${candidates.join(', ')}`
        }
      ],
      data: { discoveredSitemaps: [], sampledUrls: [] }
    };
  }

  const allUrls = validSitemaps.flatMap((sitemap) => sitemap.urls);
  const allLastmods = validSitemaps.flatMap((sitemap) => sitemap.lastmods);
  const crossHostUrls = allUrls.filter((url) => {
    try {
      return new URL(url).origin !== origin;
    } catch {
      return true;
    }
  });
  const lastmodCoverage = allUrls.length === 0 ? 0 : Math.round((allLastmods.length / allUrls.length) * 100);

  const checks: ScanCheck[] = [
    {
      id: 'sitemap_discovery',
      title: 'Sitemap discovery',
      category: 'discoverability',
      status: 'pass',
      score: 12,
      maxScore: 12,
      severity: 'low',
      message: `${validSitemaps.length} valid sitemap file(s) found.`,
      evidence: validSitemaps.map((sitemap) => sitemap.url).join('\n')
    },
    {
      id: 'sitemap_quality',
      title: 'Sitemap URL quality',
      category: 'discoverability',
      status: crossHostUrls.length > 0 || allUrls.length === 0 ? 'warning' : 'pass',
      score: crossHostUrls.length > 0 || allUrls.length === 0 ? 5 : 10,
      maxScore: 10,
      severity: crossHostUrls.length > 0 ? 'medium' : 'low',
      effort: 'medium',
      message: allUrls.length === 0
        ? 'Sitemap index found, but no page URLs were sampled from child sitemaps.'
        : `${allUrls.length} page URL(s) sampled. ${crossHostUrls.length} URL(s) appear outside the audited origin.`,
      fix: crossHostUrls.length > 0 ? 'Keep sitemap URLs within the intended host/protocol scope unless cross-host sitemaps are intentional.' : undefined,
      evidence: clampText(sampledUrls.join('\n'), 600)
    },
    {
      id: 'sitemap_lastmod',
      title: 'Sitemap freshness signals',
      category: 'discoverability',
      status: lastmodCoverage >= 60 ? 'pass' : 'warning',
      score: lastmodCoverage >= 60 ? 8 : 4,
      maxScore: 8,
      severity: 'medium',
      effort: 'medium',
      message: `${lastmodCoverage}% of sampled sitemap URLs include <lastmod>.`,
      fix: lastmodCoverage >= 60 ? undefined : 'Add accurate <lastmod> values to important URLs so crawlers can prioritize refreshed content.'
    }
  ];

  return {
    checks,
    data: {
      discoveredSitemaps: validSitemaps.map((sitemap) => sitemap.url),
      sampledUrls
    }
  };
}

async function fetchAndParseSitemap(url: string): Promise<ParsedSitemap | null> {
  try {
    const resource = await fetchTextResource(url, {}, 1_000_000);
    if (!resource.ok) return null;

    const text = resource.text;
    const isIndex = /<sitemapindex[\s>]/i.test(text);
    const isUrlSet = /<urlset[\s>]/i.test(text);

    if (!isIndex && !isUrlSet) return null;

    const locs = extractTagValues(text, 'loc');
    const lastmods = extractTagValues(text, 'lastmod');

    return {
      url,
      isIndex,
      urls: isIndex ? [] : locs,
      childSitemaps: isIndex ? locs : [],
      lastmods,
      valid: true
    };
  } catch {
    return null;
  }
}

function extractTagValues(xml: string, tagName: string): string[] {
  const values: string[] = [];
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(xml)) !== null) {
    values.push(decodeXmlEntity(match[1].trim()));
  }

  return uniqueValues(values);
}

function decodeXmlEntity(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
