import type { DomInsight, ScanCheck, SiteProfile } from '../types';

const BASE_TYPES = ['Organization', 'WebSite', 'WebPage', 'BreadcrumbList'];
const PROFILE_RECOMMENDED_TYPES: Record<SiteProfile, string[]> = {
  content: ['Article', 'BlogPosting', 'NewsArticle', 'BreadcrumbList', 'Person'],
  saas: ['SoftwareApplication', 'Product', 'Organization', 'FAQPage'],
  docs: ['TechArticle', 'HowTo', 'FAQPage', 'BreadcrumbList'],
  ecommerce: ['Product', 'Offer', 'AggregateRating', 'BreadcrumbList'],
  'local-business': ['LocalBusiness', 'Organization', 'PostalAddress'],
  api: ['SoftwareApplication', 'WebAPI', 'TechArticle'],
  app: ['SoftwareApplication', 'Product', 'FAQPage'],
  unknown: BASE_TYPES
};

export function checkStructuredData(dom: DomInsight | null, siteProfiles: SiteProfile[]): ScanCheck[] {
  if (!dom) {
    return [
      {
        id: 'structured_data_presence',
        title: 'Structured data presence',
        category: 'structured-data',
        status: 'unknown',
        score: 0,
        maxScore: 10,
        severity: 'medium',
        message: 'Could not inspect JSON-LD because DOM inspection failed.'
      }
    ];
  }

  return [checkJsonLdParsing(dom), checkSchemaCoverage(dom, siteProfiles)];
}

function checkJsonLdParsing(dom: DomInsight): ScanCheck {
  const invalid = dom.jsonLd.filter((jsonLd) => jsonLd.parseError);

  if (dom.jsonLd.length === 0) {
    return {
      id: 'structured_data_presence',
      title: 'Structured data presence',
      category: 'structured-data',
      status: 'warning',
      score: 3,
      maxScore: 10,
      severity: 'medium',
      effort: 'medium',
      message: 'No JSON-LD structured data was found.',
      fix: 'Add JSON-LD for the page entity, organization, breadcrumbs, and page-specific entities such as Article, Product, LocalBusiness, or SoftwareApplication.'
    };
  }

  if (invalid.length > 0) {
    return {
      id: 'structured_data_presence',
      title: 'Structured data presence',
      category: 'structured-data',
      status: 'fail',
      score: 2,
      maxScore: 10,
      severity: 'high',
      effort: 'low',
      message: `${invalid.length}/${dom.jsonLd.length} JSON-LD block(s) failed to parse.`,
      fix: 'Fix invalid JSON-LD syntax before relying on structured data for search or AI entity extraction.',
      evidence: invalid.map((item) => item.parseError).join('\n')
    };
  }

  return {
    id: 'structured_data_presence',
    title: 'Structured data presence',
    category: 'structured-data',
    status: 'pass',
    score: 10,
    maxScore: 10,
    severity: 'low',
    message: `${dom.jsonLd.length} valid JSON-LD block(s) found.`
  };
}

function checkSchemaCoverage(dom: DomInsight, siteProfiles: SiteProfile[]): ScanCheck {
  const detectedTypes = [...new Set(dom.jsonLd.flatMap((jsonLd) => jsonLd.types))];
  const recommendedTypes = [...new Set(siteProfiles.flatMap((profile) => PROFILE_RECOMMENDED_TYPES[profile] || []))];
  const matchedTypes = recommendedTypes.filter((type) => detectedTypes.includes(type));
  const hasBaseType = BASE_TYPES.some((type) => detectedTypes.includes(type));

  if (detectedTypes.length === 0) {
    return {
      id: 'schema_coverage',
      title: 'Schema type coverage',
      category: 'structured-data',
      status: 'warning',
      score: 2,
      maxScore: 12,
      severity: 'medium',
      effort: 'medium',
      message: 'No schema.org types were detected.',
      fix: 'Add page-specific schema types to help search engines and AI systems understand the entity and content purpose.'
    };
  }

  const score = Math.min(12, 4 + matchedTypes.length * 3 + (hasBaseType ? 2 : 0));

  return {
    id: 'schema_coverage',
    title: 'Schema type coverage',
    category: 'structured-data',
    status: score >= 9 ? 'pass' : 'warning',
    score,
    maxScore: 12,
    severity: score >= 9 ? 'low' : 'medium',
    effort: 'medium',
    message: `Detected schema types: ${detectedTypes.join(', ') || 'none'}. Recommended for this profile: ${recommendedTypes.join(', ') || 'base schema'}.`,
    fix: score >= 9 ? undefined : 'Add missing recommended schema types and connect entities using stable @id values where possible.',
    evidence: detectedTypes.join(', ')
  };
}
