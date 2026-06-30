import type { DomInsight, ScanCheck } from '../types';

export function checkDomReadiness(dom: DomInsight | null): ScanCheck[] {
  if (!dom) {
    return [
      {
        id: 'dom_inspection',
        title: 'DOM inspection',
        category: 'metadata',
        status: 'unknown',
        score: 0,
        maxScore: 8,
        message: 'Could not inspect the current page DOM.',
        fix: 'Reload the page and run the scan again. Some pages block or delay content script execution.'
      }
    ];
  }

  return [checkBasicMetadata(dom), checkStructuredData(dom), checkReadableStructure(dom)];
}

function checkBasicMetadata(dom: DomInsight): ScanCheck {
  const missing: string[] = [];
  if (!dom.title) missing.push('title');
  if (!dom.metaDescription) missing.push('meta description');
  if (!dom.canonicalUrl) missing.push('canonical URL');

  if (missing.length === 0) {
    return {
      id: 'basic_metadata',
      title: 'Basic page metadata',
      category: 'metadata',
      status: 'pass',
      score: 8,
      maxScore: 8,
      message: 'Title, meta description, and canonical URL were found.'
    };
  }

  return {
    id: 'basic_metadata',
    title: 'Basic page metadata',
    category: 'metadata',
    status: missing.length >= 2 ? 'fail' : 'warning',
    score: missing.length >= 2 ? 2 : 5,
    maxScore: 8,
    message: `Missing: ${missing.join(', ')}.`,
    fix: 'Add complete title, meta description, and canonical tags so agents can identify the page accurately.'
  };
}

function checkStructuredData(dom: DomInsight): ScanCheck {
  if (dom.jsonLdCount > 0) {
    return {
      id: 'structured_data',
      title: 'Structured data',
      category: 'metadata',
      status: 'pass',
      score: 8,
      maxScore: 8,
      message: `${dom.jsonLdCount} JSON-LD block(s) found.`
    };
  }

  return {
    id: 'structured_data',
    title: 'Structured data',
    category: 'metadata',
    status: 'warning',
    score: 3,
    maxScore: 8,
    message: 'No JSON-LD structured data was found.',
    fix: 'Add relevant schema.org JSON-LD such as Organization, Product, Article, FAQPage, or SoftwareApplication.'
  };
}

function checkReadableStructure(dom: DomInsight): ScanCheck {
  const hasHeadingStructure = dom.h1Count === 1 && dom.h2Count > 0;
  const hasEnoughText = dom.visibleTextLength >= 500;

  if (hasHeadingStructure && hasEnoughText) {
    return {
      id: 'readable_structure',
      title: 'Readable page structure',
      category: 'metadata',
      status: 'pass',
      score: 8,
      maxScore: 8,
      message: 'The page has a clear heading structure and enough readable text.'
    };
  }

  return {
    id: 'readable_structure',
    title: 'Readable page structure',
    category: 'metadata',
    status: 'warning',
    score: 4,
    maxScore: 8,
    message: `H1 count: ${dom.h1Count}, H2 count: ${dom.h2Count}, visible text length: ${dom.visibleTextLength}.`,
    fix: 'Use one primary H1, descriptive H2 sections, and enough crawlable visible text for agents to understand the page.'
  };
}
