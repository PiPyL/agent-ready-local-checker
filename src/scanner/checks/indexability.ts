import type { DomInsight, ScanCheck } from '../types';
import { fetchTextResource } from '../utils/http';

export async function checkIndexability(pageUrl: string, dom: DomInsight | null): Promise<ScanCheck[]> {
  const checks: ScanCheck[] = [];

  try {
    const resource = await fetchTextResource(pageUrl, {
      headers: { Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' }
    }, 120_000);

    const xRobotsTag = resource.headers['x-robots-tag'] || null;
    checks.push(checkHttpStatus(resource.status, resource.finalUrl, pageUrl, resource.redirected));
    checks.push(checkRobotsDirectives(dom?.metaRobots || null, xRobotsTag));
    checks.push(checkCanonical(pageUrl, resource.finalUrl, dom?.canonicalUrl || null));
  } catch {
    checks.push({
      id: 'http_indexability',
      title: 'HTTP indexability',
      category: 'indexability',
      status: 'unknown',
      score: 0,
      maxScore: 10,
      severity: 'high',
      effort: 'medium',
      message: 'Could not fetch the current page to verify HTTP status and indexability headers.',
      fix: 'Check host permissions, redirects, firewall rules, or bot protection that may block local extension fetches.'
    });
  }

  return checks;
}

function checkHttpStatus(status: number, finalUrl: string, pageUrl: string, redirected: boolean): ScanCheck {
  if (status >= 200 && status < 300) {
    return {
      id: 'http_indexability',
      title: 'HTTP indexability',
      category: 'indexability',
      status: redirected ? 'warning' : 'pass',
      score: redirected ? 8 : 10,
      maxScore: 10,
      severity: redirected ? 'medium' : 'low',
      effort: redirected ? 'medium' : 'low',
      message: redirected ? `The page resolves successfully but redirects to ${finalUrl}.` : 'The current page returns a successful HTTP response.',
      fix: redirected ? 'Use the final canonical URL for important internal links, sitemaps, and llms.txt references.' : undefined,
      evidence: `Requested: ${pageUrl}\nFinal: ${finalUrl}\nStatus: ${status}`
    };
  }

  return {
    id: 'http_indexability',
    title: 'HTTP indexability',
    category: 'indexability',
    status: 'fail',
    score: 0,
    maxScore: 10,
    severity: 'critical',
    effort: 'medium',
    message: `The current page returned HTTP ${status}.`,
    fix: 'Important indexable pages should return a stable 200 response. Fix 4xx/5xx errors or redirect chains.',
    evidence: `Requested: ${pageUrl}\nFinal: ${finalUrl}\nStatus: ${status}`
  };
}

function checkRobotsDirectives(metaRobots: string | null, xRobotsTag: string | null): ScanCheck {
  const combined = `${metaRobots || ''} ${xRobotsTag || ''}`.toLowerCase();
  const hasNoindex = /\bnoindex\b/.test(combined);
  const hasNofollow = /\bnofollow\b/.test(combined);

  if (hasNoindex) {
    return {
      id: 'indexing_directives',
      title: 'Indexing directives',
      category: 'indexability',
      status: 'fail',
      score: 0,
      maxScore: 12,
      severity: 'critical',
      effort: 'low',
      message: 'The page contains noindex through meta robots or X-Robots-Tag.',
      fix: 'Remove noindex from pages that should appear in search or AI answer sources.',
      evidence: `meta robots: ${metaRobots || 'none'}\nX-Robots-Tag: ${xRobotsTag || 'none'}`
    };
  }

  if (hasNofollow) {
    return {
      id: 'indexing_directives',
      title: 'Indexing directives',
      category: 'indexability',
      status: 'warning',
      score: 7,
      maxScore: 12,
      severity: 'medium',
      effort: 'low',
      message: 'The page contains nofollow. Internal discovery may be weakened.',
      fix: 'Avoid nofollow on important navigational/internal links unless it is intentional.',
      evidence: `meta robots: ${metaRobots || 'none'}\nX-Robots-Tag: ${xRobotsTag || 'none'}`
    };
  }

  return {
    id: 'indexing_directives',
    title: 'Indexing directives',
    category: 'indexability',
    status: 'pass',
    score: 12,
    maxScore: 12,
    severity: 'low',
    message: 'No noindex/nofollow directive was detected.'
  };
}

function checkCanonical(pageUrl: string, finalUrl: string, canonicalUrl: string | null): ScanCheck {
  if (!canonicalUrl) {
    return {
      id: 'canonical_consistency',
      title: 'Canonical consistency',
      category: 'indexability',
      status: 'warning',
      score: 5,
      maxScore: 10,
      severity: 'medium',
      effort: 'low',
      message: 'No canonical URL was detected.',
      fix: 'Add a canonical URL to reduce duplicate-content ambiguity for search engines and AI retrieval systems.'
    };
  }

  try {
    const canonical = normalizeUrl(canonicalUrl);
    const final = normalizeUrl(finalUrl || pageUrl);

    if (canonical !== final) {
      return {
        id: 'canonical_consistency',
        title: 'Canonical consistency',
        category: 'indexability',
        status: 'warning',
        score: 7,
        maxScore: 10,
        severity: 'medium',
        effort: 'low',
        message: 'Canonical URL does not match the final fetched URL.',
        fix: 'Ensure canonical URLs point to the preferred final URL used in internal links, sitemap, and llms.txt.',
        evidence: `Canonical: ${canonicalUrl}\nFinal: ${finalUrl}`
      };
    }
  } catch {
    return {
      id: 'canonical_consistency',
      title: 'Canonical consistency',
      category: 'indexability',
      status: 'fail',
      score: 0,
      maxScore: 10,
      severity: 'high',
      effort: 'low',
      message: 'Canonical URL is invalid.',
      fix: 'Use an absolute, valid canonical URL.'
    };
  }

  return {
    id: 'canonical_consistency',
    title: 'Canonical consistency',
    category: 'indexability',
    status: 'pass',
    score: 10,
    maxScore: 10,
    severity: 'low',
    message: 'Canonical URL matches the final fetched URL.'
  };
}

function normalizeUrl(value: string): string {
  const url = new URL(value);
  url.hash = '';
  if (url.pathname !== '/' && url.pathname.endsWith('/')) url.pathname = url.pathname.slice(0, -1);
  return url.href;
}
