import type { ScanCheck } from '../types';

export async function checkSitemap(origin: string, sitemapUrls: string[]): Promise<ScanCheck> {
  const candidates = [...sitemapUrls, `${origin}/sitemap.xml`];
  const uniqueCandidates = [...new Set(candidates)];

  for (const candidate of uniqueCandidates) {
    try {
      const res = await fetch(candidate, { cache: 'no-store' });
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        const text = await res.text();
        const looksLikeSitemap = contentType.includes('xml') || /<urlset|<sitemapindex/i.test(text);

        if (looksLikeSitemap) {
          return {
            id: 'sitemap',
            title: 'Sitemap',
            category: 'discoverability',
            status: 'pass',
            score: 10,
            maxScore: 10,
            message: `Sitemap found at ${candidate}.`,
            evidence: text.slice(0, 300)
          };
        }
      }
    } catch {
      // Continue with the next candidate.
    }
  }

  return {
    id: 'sitemap',
    title: 'Sitemap',
    category: 'discoverability',
    status: 'fail',
    score: 0,
    maxScore: 10,
    message: 'No valid sitemap was found.',
    fix: 'Publish /sitemap.xml and declare it in robots.txt to improve agent and search discoverability.'
  };
}
