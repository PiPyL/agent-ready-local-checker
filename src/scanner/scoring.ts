import type { ScanCheck, ScanGrade } from './types';

export function calculateScore(checks: ScanCheck[]): number {
  const total = checks.reduce((sum, check) => sum + check.maxScore, 0);
  const actual = checks.reduce((sum, check) => sum + check.score, 0);

  if (total === 0) return 0;

  return Math.max(0, Math.min(100, Math.round((actual / total) * 100)));
}

export function getGrade(score: number): ScanGrade {
  if (score >= 85) return 'Excellent';
  if (score >= 65) return 'Good';
  if (score >= 40) return 'Needs Work';
  return 'Poor';
}

export function summarizeStatus(checks: ScanCheck[]) {
  return checks.reduce(
    (summary, check) => {
      summary[check.status] += 1;
      return summary;
    },
    { pass: 0, warning: 0, fail: 0, unknown: 0 }
  );
}
