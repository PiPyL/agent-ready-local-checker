import type { CheckCategory, CheckStatus, ScanCheck, ScanGrade, ScoreBreakdownItem, SiteProfile } from './types';

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
