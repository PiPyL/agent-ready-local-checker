import { getPriorityScore, isScoredCheck } from '../scanner/scoring';
import type { CriticalWarning, ScanCheck, ScanResult } from '../scanner/types';

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
  lines.push(`- SEO score: ${result.seoScore.score}/100 (${result.seoScore.grade})`);
  lines.push(`- GEO score: ${result.geoScore.score}/100 (${result.geoScore.grade})`);
  lines.push('');

  if (result.criticalWarnings.length > 0) {
    lines.push('## Critical warnings');
    lines.push('');
    result.criticalWarnings.forEach((warning, index) => {
      lines.push(`${index + 1}. **${warning.title}**`);
      lines.push(`   - Severity: ${warning.severity}`);
      lines.push(`   - Message: ${warning.message}`);
      if (warning.fix) lines.push(`   - Fix: ${warning.fix}`);
    });
    lines.push('');
  }

  lines.push('## Focus scores');
  lines.push('');
  lines.push('| Focus | Score | Grade | Meaning |');
  lines.push('|---|---:|---|---|');
  lines.push(`| SEO | ${result.seoScore.score}/100 | ${result.seoScore.grade} | ${result.seoScore.summary} |`);
  lines.push(`| GEO | ${result.geoScore.score}/100 | ${result.geoScore.grade} | ${result.geoScore.summary} |`);
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
      const stackHint = getStackSpecificHint(check);
      if (stackHint) lines.push(`   - Stack hint: ${stackHint}`);
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
    lines.push(`- Score: ${check.maxScore > 0 ? `${check.score}/${check.maxScore}` : 'N/A'}`);
    lines.push(`- Severity: ${check.severity || 'medium'}`);
    if (check.effort) lines.push(`- Effort: ${check.effort}`);
    lines.push(`- Message: ${check.message}`);
    if (check.impact) lines.push(`- Impact: ${check.impact}`);
    if (check.fix) lines.push(`- Fix: ${check.fix}`);
    const stackHint = getStackSpecificHint(check);
    if (stackHint) lines.push(`- Stack-specific hint: ${stackHint}`);
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
  lines.push(`Overall score: ${result.score}/100 (${result.grade})`);
  lines.push(`SEO score: ${result.seoScore.score}/100 (${result.seoScore.grade})`);
  lines.push(`GEO score: ${result.geoScore.score}/100 (${result.geoScore.grade})`);
  lines.push('');
  lines.push('Important rule: machine-readable routes such as /llms.txt, /llms-full.txt, /.well-known/*.json, /openapi.json, and Markdown fallback URLs must return real static text/JSON/Markdown. Do not let the SPA catch-all route return index.html for these paths.');
  lines.push('');

  if (result.criticalWarnings.length > 0) {
    lines.push('Critical warnings to address first:');
    result.criticalWarnings.forEach((warning: CriticalWarning, index: number) => {
      lines.push(`${index + 1}. ${warning.title}: ${warning.message}`);
      if (warning.fix) lines.push(`   Fix: ${warning.fix}`);
    });
    lines.push('');
  }

  lines.push('Stack-specific implementation hints:');
  lines.push('- React/Vite: put llms.txt, llms-full.txt, and Markdown files in public/ so they are copied to dist/. Verify dist/llms.txt exists after npm run build.');
  lines.push('- Next.js App Router: use public/llms.txt for static files, or create app/llms.txt/route.ts for dynamic output. Make sure middleware/rewrites do not send these paths to the app shell.');
  lines.push('- Next.js Pages Router: use public/llms.txt, public/llms-full.txt, and public/index.md, or API routes only when dynamic generation is needed.');
  lines.push('- Express/Node hosting: serve static machine-readable files before the SPA catch-all: app.use(express.static("dist")); then app.get("*", sendIndex).');
  lines.push('- Nginx/Apache/CDN: add explicit location/routing rules for /llms.txt, *.md, /.well-known/*, /openapi.json before fallback-to-index rules.');
  lines.push('');
  lines.push('Prioritize fixes by SEO/GEO impact and implementation effort:');

  priorityIssues.slice(0, 12).forEach((check, index) => {
    lines.push(`${index + 1}. ${check.title}`);
    lines.push(`   Problem: ${check.message}`);
    if (check.fix) lines.push(`   Recommended fix: ${check.fix}`);
    const stackHint = getStackSpecificHint(check);
    if (stackHint) lines.push(`   Stack hint: ${stackHint}`);
    if (check.severity) lines.push(`   Severity: ${check.severity}`);
    if (check.effort) lines.push(`   Effort: ${check.effort}`);
  });

  lines.push('');
  lines.push('Return concrete code changes, file paths, test commands, curl verification commands, and expected before/after results. Include examples using curl -H "Accept: text/markdown" and curl -I for static machine-readable files. Do not use any external API unless explicitly required by the codebase.');

  return lines.join('\n');
}

function getPriorityIssues(result: ScanResult): ScanCheck[] {
  return result.checks
    .filter((check) => check.status === 'fail' || check.status === 'warning' || check.status === 'unknown')
    .filter((check) => isScoredCheck(check, result.siteProfiles) || check.status === 'fail')
    .sort((a, b) => getPriorityScore(b) - getPriorityScore(a));
}

function getStackSpecificHint(check: ScanCheck): string | null {
  const combined = `${check.title} ${check.message} ${check.evidence || ''}`.toLowerCase();
  const isMachineReadableFallback = /html fallback|spa html fallback|catch-all|<!doctype html|content-type: text\/html/.test(combined);

  if (!isMachineReadableFallback) return null;

  if (combined.includes('/llms.txt') || combined.includes('/llms-full.txt')) {
    return 'React/Vite: create public/llms.txt and public/llms-full.txt. Next.js: create public/llms.txt or app/llms.txt/route.ts. Ensure these routes are served before SPA fallback.';
  }

  if (combined.includes('.md') || combined.includes('markdown')) {
    return 'Create static Markdown files such as public/index.md or route-level .md files, and configure missing .md paths to return 404 instead of index.html.';
  }

  if (combined.includes('/.well-known/')) {
    return 'Serve real JSON from /.well-known/* only for implemented capabilities; otherwise return 404 before the SPA catch-all route.';
  }

  return 'Serve machine-readable static files before the SPA catch-all route; missing machine-readable paths should return 404, not index.html.';
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
