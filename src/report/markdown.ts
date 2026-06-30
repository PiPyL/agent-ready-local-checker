import { getPriorityScore, isScoredCheck } from '../scanner/scoring';
import type { ScanCheck, ScanResult } from '../scanner/types';

export function generateMarkdownReport(result: ScanResult): string {
  const lines: string[] = [];
  const priorityIssues = getPriorityIssues(result);

  lines.push(`# SEO/GEO + Agent Readiness Report`);
  lines.push('');
  lines.push(`- URL: ${result.url}`);
  lines.push(`- Domain: ${result.domain}`);
  lines.push(`- Detected profile: ${result.siteProfiles.join(', ')}`);
  lines.push(`- Scanned at: ${result.scannedAt}`);
  lines.push(`- Overall score: ${result.score}/100`);
  lines.push(`- Grade: ${result.grade}`);
  lines.push('');

  lines.push('## Score breakdown');
  lines.push('');
  lines.push('| Category | Score | Percentage |');
  lines.push('|---|---:|---:|');
  for (const item of result.scoreBreakdown) {
    lines.push(`| ${item.category} | ${item.score}/${item.maxScore} | ${item.percentage}% |`);
  }
  lines.push('');

  lines.push('## Highest-priority fixes');
  lines.push('');
  if (priorityIssues.length === 0) {
    lines.push('No high-priority issues found in the current local audit.');
  } else {
    priorityIssues.slice(0, 10).forEach((check, index) => {
      lines.push(`${index + 1}. **${check.title}** — ${check.message}`);
      if (check.impact) lines.push(`   - Impact: ${check.impact}`);
      if (check.fix) lines.push(`   - Fix: ${check.fix}`);
      if (check.effort) lines.push(`   - Effort: ${check.effort}`);
    });
  }
  lines.push('');

  lines.push('## All checks');
  lines.push('');

  for (const check of result.checks) {
    lines.push(`### ${statusIcon(check.status)} ${check.title}`);
    lines.push('');
    lines.push(`- Category: ${check.category}`);
    lines.push(`- Status: ${check.status}`);
    lines.push(`- Score: ${check.score}/${check.maxScore}`);
    lines.push(`- Severity: ${check.severity || 'medium'}`);
    if (check.effort) lines.push(`- Effort: ${check.effort}`);
    lines.push(`- Message: ${check.message}`);
    if (check.impact) lines.push(`- Impact: ${check.impact}`);
    if (check.fix) lines.push(`- Fix: ${check.fix}`);
    if (check.docsUrl) lines.push(`- Docs: ${check.docsUrl}`);
    if (check.evidence) {
      lines.push('');
      lines.push('```text');
      lines.push(check.evidence.trim());
      lines.push('```');
    }
    lines.push('');
  }

  lines.push('## Suggested implementation prompt');
  lines.push('');
  lines.push(generateFixPrompt(result));

  return lines.join('\n');
}

export function generateFixPrompt(result: ScanResult): string {
  const priorityIssues = getPriorityIssues(result);

  if (priorityIssues.length === 0) {
    return 'The website passed all scored checks in the current local audit. Keep monitoring SEO/GEO and agent-readiness standards as they evolve.';
  }

  const lines: string[] = [];
  lines.push('You are a senior SEO/GEO engineer and web platform engineer. Improve this website so it is easier to crawl, index, cite, and use by AI agents.');
  lines.push('');
  lines.push(`Website: ${result.url}`);
  lines.push(`Detected site profile: ${result.siteProfiles.join(', ')}`);
  lines.push(`Current score: ${result.score}/100 (${result.grade})`);
  lines.push('');
  lines.push('Prioritize fixes by SEO/GEO impact and implementation effort:');

  priorityIssues.slice(0, 12).forEach((check, index) => {
    lines.push(`${index + 1}. ${check.title}`);
    lines.push(`   Problem: ${check.message}`);
    if (check.fix) lines.push(`   Recommended fix: ${check.fix}`);
    if (check.severity) lines.push(`   Severity: ${check.severity}`);
    if (check.effort) lines.push(`   Effort: ${check.effort}`);
  });

  lines.push('');
  lines.push('Return concrete code changes, file paths, test commands, curl verification commands, and expected before/after results. Do not use any external API unless explicitly required by the codebase.');

  return lines.join('\n');
}

function getPriorityIssues(result: ScanResult): ScanCheck[] {
  return result.checks
    .filter((check) => check.status === 'fail' || check.status === 'warning' || check.status === 'unknown')
    .filter((check) => isScoredCheck(check, result.siteProfiles) || check.status === 'fail')
    .sort((a, b) => getPriorityScore(b) - getPriorityScore(a));
}

function statusIcon(status: string): string {
  switch (status) {
    case 'pass':
      return '✅';
    case 'warning':
      return '⚠️';
    case 'fail':
      return '❌';
    case 'not_applicable':
      return '➖';
    default:
      return '❔';
  }
}
