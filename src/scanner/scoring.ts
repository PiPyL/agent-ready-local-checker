import type { CheckCategory, CheckStatus, CriticalWarning, FocusScore, ScanCheck, ScanGrade, ScoreBreakdownItem, SiteProfile } from './types';

const CATEGORY_WEIGHTS: Record<CheckCategory, number> = {
  crawlability: 18,
  indexability: 14,
  discoverability: 14,
  'agent-content': 18,
  'bot-policy': 10,
  protocol: 8,
  metadata: 10,
  'structured-data': 12,
  'content-quality': 10,
  social: 4,
  performance: 2
};

const SEO_FOCUS_WEIGHTS: Partial<Record<CheckCategory, number>> = {
  crawlability: 20,
  indexability: 20,
  discoverability: 16,
  metadata: 14,
  'structured-data': 12,
  'content-quality': 12,
  social: 6
};

const GEO_FOCUS_WEIGHTS: Partial<Record<CheckCategory, number>> = {
  'agent-content': 50,
  'bot-policy': 15,
  discoverability: 10,
  'structured-data': 15,
  protocol: 10
};

export function calculateScore(checks: ScanCheck[], siteProfiles: SiteProfile[] = ['unknown']): number {
  const breakdown = calculateScoreBreakdown(checks, siteProfiles);
  const totalWeight = breakdown.reduce((sum, item) => sum + CATEGORY_WEIGHTS[item.category], 0);
  const weighted = breakdown.reduce((sum, item) => sum + item.percentage * CATEGORY_WEIGHTS[item.category], 0);

  if (totalWeight === 0) return 0;
  return Math.max(0, Math.min(100, Math.round(weighted / totalWeight)));
}

export function calculateScoreBreakdown(checks: ScanCheck[], siteProfiles: SiteProfile[] = ['unknown']): ScoreBreakdownItem[] {
  const applicableChecks = checks.filter((check) => isScoredCheck(check, siteProfiles));
  const categories = [...new Set(applicableChecks.map((check) => check.category))];

  return categories.map((category) => {
    const categoryChecks = applicableChecks.filter((check) => check.category === category);
    const maxScore = categoryChecks.reduce((sum, check) => sum + check.maxScore, 0);
    const score = categoryChecks.reduce((sum, check) => sum + check.score, 0);
    const percentage = maxScore === 0 ? 0 : Math.round((score / maxScore) * 100);

    return { category, score, maxScore, percentage };
  });
}

export function calculateSeoScore(breakdown: ScoreBreakdownItem[]): FocusScore {
  return calculateFocusScore('SEO', breakdown, SEO_FOCUS_WEIGHTS, 'Traditional crawlability, indexability, metadata, content quality, and structured-data health.');
}

export function calculateGeoScore(breakdown: ScoreBreakdownItem[]): FocusScore {
  return calculateFocusScore('GEO', breakdown, GEO_FOCUS_WEIGHTS, 'AI-readable content, bot policy, schema/entity clarity, discoverability, and optional agent protocol readiness.');
}

function calculateFocusScore(label: 'SEO' | 'GEO', breakdown: ScoreBreakdownItem[], weights: Partial<Record<CheckCategory, number>>, summary: string): FocusScore {
  const weightedItems = breakdown
    .map((item) => ({ item, weight: weights[item.category] || 0 }))
    .filter(({ weight }) => weight > 0);

  const totalWeight = weightedItems.reduce((sum, { weight }) => sum + weight, 0);
  const weightedScore = weightedItems.reduce((sum, { item, weight }) => sum + item.percentage * weight, 0);
  const score = totalWeight === 0 ? 0 : Math.round(weightedScore / totalWeight);

  return {
    label,
    score,
    grade: getGrade(score),
    categories: weightedItems.map(({ item }) => item.category),
    summary
  };
}

export function getCriticalWarnings(checks: ScanCheck[], breakdown: ScoreBreakdownItem[], geoScore: FocusScore): CriticalWarning[] {
  const warnings: CriticalWarning[] = [];
  const agentContent = breakdown.find((item) => item.category === 'agent-content');

  if (agentContent && agentContent.percentage < 40) {
    warnings.push({
      id: 'critical_geo_gap',
      title: 'Critical GEO gap: AI-readable content is missing or weak',
      severity: agentContent.percentage === 0 ? 'critical' : 'high',
      message: `Agent content score is ${agentContent.percentage}%. Search SEO may look healthy, but AI search and agent retrieval will struggle without valid llms.txt, Markdown alternatives, or Markdown negotiation.`,
      fix: 'Create valid /llms.txt, /llms-full.txt, and Markdown fallback files for important pages. Ensure these routes return real text/Markdown before SPA fallback.'
    });
  }

  if (geoScore.score < 50) {
    warnings.push({
      id: 'geo_score_critical',
      title: 'GEO score is critical even if overall score is acceptable',
      severity: 'high',
      message: `GEO score is ${geoScore.score}/100 (${geoScore.grade}). Treat this separately from the overall score.`,
      fix: 'Prioritize AI-readable content and sitemap freshness before advanced protocols.'
    });
  }

  const spaFallbackChecks = checks.filter((check) => /html fallback|spa html fallback|catch-all/i.test(`${check.message} ${check.evidence || ''}`));
  if (spaFallbackChecks.length > 0) {
    warnings.push({
      id: 'spa_fallback_machine_routes',
      title: 'SPA fallback is masking machine-readable routes',
      severity: 'high',
      message: `${spaFallbackChecks.length} machine-readable route(s) appear to return app HTML instead of text, Markdown, JSON, or 404.`,
      fix: 'Configure the hosting/server rewrite rules so /llms.txt, *.md, /.well-known/*, and /openapi.json are served as static files before the SPA catch-all route.'
    });
  }

  return dedupeWarnings(warnings);
}

function dedupeWarnings(warnings: CriticalWarning[]): CriticalWarning[] {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    if (seen.has(warning.id)) return false;
    seen.add(warning.id);
    return true;
  });
}

export function isScoredCheck(check: ScanCheck, siteProfiles: SiteProfile[]): boolean {
  if (check.status === 'not_applicable') return false;
  if (check.maxScore <= 0) return false;

  const hasProfileConstraint = Boolean(check.appliesTo && check.appliesTo.length > 0);
  const profileMatches = !hasProfileConstraint || siteProfiles.includes('unknown') || check.appliesTo!.some((profile) => siteProfiles.includes(profile));

  if (!profileMatches) return false;

  // Optional checks should not penalize generic sites when absent, but should be scored when
  // they are relevant to the inferred profile or when the endpoint exists but is invalid.
  if (check.optional && !hasProfileConstraint && check.status !== 'pass' && check.status !== 'fail') return false;

  return true;
}

export function getGrade(score: number): ScanGrade {
  if (score >= 85) return 'Excellent';
  if (score >= 65) return 'Good';
  if (score >= 40) return 'Needs Work';
  return 'Poor';
}

export function summarizeStatus(checks: ScanCheck[]): Record<CheckStatus, number> {
  return checks.reduce(
    (summary, check) => {
      summary[check.status] += 1;
      return summary;
    },
    { pass: 0, warning: 0, fail: 0, unknown: 0, not_applicable: 0 }
  );
}

export function getPriorityScore(check: ScanCheck): number {
  const severityWeight = {
    critical: 5,
    high: 4,
    medium: 3,
    low: 2,
    info: 1
  }[check.severity || 'medium'];

  const statusWeight = {
    fail: 3,
    warning: 2,
    unknown: 1,
    pass: 0,
    not_applicable: 0
  }[check.status];

  const effortBonus = {
    low: 1.2,
    medium: 1,
    high: 0.8
  }[check.effort || 'medium'];

  return severityWeight * statusWeight * effortBonus;
}
