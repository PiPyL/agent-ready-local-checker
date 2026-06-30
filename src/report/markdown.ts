import type { ScanResult } from '../scanner/types';

export function generateMarkdownReport(result: ScanResult): string {
  const lines: string[] = [];

  lines.push(`# Agent Readiness Report`);
  lines.push('');
  lines.push(`- URL: ${result.url}`);
  lines.push(`- Domain: ${result.domain}`);
  lines.push(`- Scanned at: ${result.scannedAt}`);
  lines.push(`- Score: ${result.score}/100`);
  lines.push(`- Grade: ${result.grade}`);
  lines.push('');
  lines.push('## Checks');
  lines.push('');

  for (const check of result.checks) {
    lines.push(`### ${statusIcon(check.status)} ${check.title}`);
    lines.push('');
    lines.push(`- Category: ${check.category}`);
    lines.push(`- Status: ${check.status}`);
    lines.push(`- Score: ${check.score}/${check.maxScore}`);
    lines.push(`- Message: ${check.message}`);
    if (check.fix) lines.push(`- Fix: ${check.fix}`);
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
  const failedOrWarningChecks = result.checks.filter((check) => check.status === 'fail' || check.status === 'warning');

  if (failedOrWarningChecks.length === 0) {
    return 'The website passed all current checks. Keep monitoring agent-readiness standards as they evolve.';
  }

  const lines: string[] = [];
  lines.push('You are a senior web engineer. Improve this website so it is more readable and discoverable by AI agents.');
  lines.push('');
  lines.push(`Website: ${result.url}`);
  lines.push(`Current score: ${result.score}/100 (${result.grade})`);
  lines.push('');
  lines.push('Fix these issues in priority order:');

  failedOrWarningChecks.forEach((check, index) => {
    lines.push(`${index + 1}. ${check.title}: ${check.message}`);
    if (check.fix) lines.push(`   Recommended fix: ${check.fix}`);
  });

  lines.push('');
  lines.push('Return concrete code changes, file paths, and verification steps.');

  return lines.join('\n');
}

function statusIcon(status: string): string {
  switch (status) {
    case 'pass':
      return '✅';
    case 'warning':
      return '⚠️';
    case 'fail':
      return '❌';
    default:
      return '❔';
  }
}
