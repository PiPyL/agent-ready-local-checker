import type { ScanCheck, SiteProfile } from '../types';
import { fetchTextResource, isLikelyJson } from '../utils/http';
import { clampText } from '../utils/text';

const OPENAPI_CANDIDATES = ['/openapi.json', '/swagger.json', '/api/openapi.json', '/api/swagger.json'];

export async function checkApiDiscovery(origin: string, siteProfiles: SiteProfile[]): Promise<ScanCheck[]> {
  const apiRelevant = siteProfiles.some((profile) => ['api', 'saas', 'docs', 'app'].includes(profile));
  const openApiCheck = await checkOpenApiSpec(origin, apiRelevant);
  return [openApiCheck];
}

async function checkOpenApiSpec(origin: string, apiRelevant: boolean): Promise<ScanCheck> {
  for (const path of OPENAPI_CANDIDATES) {
    const url = `${origin}${path}`;

    try {
      const resource = await fetchTextResource(url, { headers: { Accept: 'application/json, text/plain;q=0.8' } }, 600_000);
      if (!resource.ok || !isLikelyJson(resource.contentType, resource.text)) continue;

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

  return {
    id: 'openapi_discovery',
    title: 'OpenAPI discovery',
    category: 'protocol',
    status: apiRelevant ? 'warning' : 'not_applicable',
    score: 0,
    maxScore: apiRelevant ? 8 : 0,
    optional: !apiRelevant,
    appliesTo: ['api', 'saas', 'docs', 'app'],
    severity: apiRelevant ? 'medium' : 'info',
    effort: 'medium',
    message: apiRelevant ? 'No OpenAPI/Swagger spec was discovered at common paths.' : 'OpenAPI discovery is not applicable for this page profile.',
    fix: apiRelevant ? 'Expose OpenAPI at /openapi.json or link it from docs/API catalog so agents can understand available endpoints.' : undefined
  };
}
