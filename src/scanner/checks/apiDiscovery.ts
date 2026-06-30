import type { DomInsight, ScanCheck, SiteProfile } from '../types';
import { describeFallback, fetchTextResource, isLikelyJson, isSpaHtmlFallback } from '../utils/http';
import { clampText } from '../utils/text';

const OPENAPI_CANDIDATES = ['/openapi.json', '/swagger.json', '/api/openapi.json', '/api/swagger.json'];

export async function checkApiDiscovery(origin: string, siteProfiles: SiteProfile[], dom: DomInsight | null): Promise<ScanCheck[]> {
  const apiRelevant = isApiRelevant(siteProfiles, dom);
  const openApiCheck = await checkOpenApiSpec(origin, apiRelevant);
  return [openApiCheck];
}

async function checkOpenApiSpec(origin: string, apiRelevant: boolean): Promise<ScanCheck> {
  const fallbackEvidence: string[] = [];

  for (const path of OPENAPI_CANDIDATES) {
    const url = `${origin}${path}`;

    try {
      const resource = await fetchTextResource(url, { headers: { Accept: 'application/json, text/plain;q=0.8' } }, 600_000);
      if (!resource.ok) continue;

      if (isSpaHtmlFallback(resource, path)) {
        fallbackEvidence.push(describeFallback(resource));
        continue;
      }

      if (!isLikelyJson(resource.contentType, resource.text)) continue;

      const parsed = JSON.parse(resource.text) as Record<string, unknown>;
      const hasOpenApi = typeof parsed.openapi === 'string' || typeof parsed.swagger === 'string';
      const hasPaths = parsed.paths && typeof parsed.paths === 'object';

      if (hasOpenApi && hasPaths) {
        return {
          id: 'openapi_discovery',
          title: 'OpenAPI discovery',
          category: 'protocol',
          status: 'pass',
          score: 8,
          maxScore: 8,
          optional: !apiRelevant,
          appliesTo: ['api', 'saas', 'docs', 'app'],
          severity: 'low',
          effort: 'medium',
          message: `OpenAPI/Swagger spec found at ${url}.`,
          evidence: clampText(resource.text, 400)
        };
      }
    } catch {
      // Continue with the next candidate.
    }
  }

  if (!apiRelevant) {
    return {
      id: 'openapi_discovery',
      title: 'OpenAPI discovery',
      category: 'protocol',
      status: 'not_applicable',
      score: 0,
      maxScore: 0,
      optional: true,
      appliesTo: ['api', 'saas', 'docs', 'app'],
      severity: 'info',
      effort: 'medium',
      message: 'OpenAPI discovery is not applicable because no public API/developer-docs intent was detected.'
    };
  }

  return {
    id: 'openapi_discovery',
    title: 'OpenAPI discovery',
    category: 'protocol',
    status: 'warning',
    score: 0,
    maxScore: 8,
    optional: false,
    appliesTo: ['api', 'saas', 'docs', 'app'],
    severity: 'medium',
    effort: 'medium',
    message: fallbackEvidence.length > 0
      ? 'OpenAPI candidate paths appear to be handled by SPA HTML fallback, not real API specs.'
      : 'No OpenAPI/Swagger spec was discovered at common paths.',
    evidence: fallbackEvidence[0],
    fix: fallbackEvidence.length > 0
      ? 'If the site has a public API, serve a real /openapi.json before SPA fallback. If not, configure these paths to return 404 and mark OpenAPI as not applicable.'
      : 'Expose OpenAPI at /openapi.json or link it from docs/API catalog when the product has a public API.'
  };
}

function isApiRelevant(siteProfiles: SiteProfile[], dom: DomInsight | null): boolean {
  if (siteProfiles.includes('api') || siteProfiles.includes('docs')) return true;

  const text = [
    dom?.title || '',
    dom?.metaDescription || '',
    ...(dom?.headings.map((heading) => heading.text) || []),
    ...(dom?.links.map((link) => `${link.text} ${link.href}`) || [])
  ].join(' ').toLowerCase();

  return /\b(api|developer|developers|openapi|swagger|webhook|sdk|endpoint|graphql|rest api|api key)\b/.test(text);
}
