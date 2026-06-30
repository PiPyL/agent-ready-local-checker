import type { DomInsight, ScanCheck, SiteProfile } from '../types';

export function checkDomReadiness(url: string, dom: DomInsight | null, siteProfiles: SiteProfile[]): ScanCheck[] {
  if (!dom) {
    return [
      {
        id: 'dom_inspection',
        title: 'DOM inspection',
        category: 'metadata',
        status: 'unknown',
        score: 0,
        maxScore: 8,
        severity: 'medium',
        effort: 'low',
        message: 'Could not inspect the current page DOM.',
        fix: 'Reload the page and run the scan again. Some pages block or delay content script execution.'
      }
    ];
  }

  return [
    checkBasicMetadata(url, dom),
    checkSocialMetadata(dom),
    checkReadableStructure(dom),
    checkImages(dom),
    checkLinks(dom),
    checkEntitySignals(dom, siteProfiles)
  ];
}

function checkBasicMetadata(url: string, dom: DomInsight): ScanCheck {
  const issues: string[] = [];
  const target = new URL(url);

  if (!dom.title) issues.push('missing title');
  if (dom.title && (dom.title.length < 20 || dom.title.length > 65)) issues.push('title length is outside the recommended 20–65 character range');
  if (!dom.metaDescription) issues.push('missing meta description');
  if (dom.metaDescription && (dom.metaDescription.length < 70 || dom.metaDescription.length > 170)) issues.push('meta description length is outside the recommended 70–170 character range');
  if (!dom.canonicalUrl) issues.push('missing canonical URL');
  if (!dom.htmlLang) issues.push('missing html lang');
  if (!dom.viewport) issues.push('missing viewport meta');

  if (dom.canonicalUrl) {
    try {
      const canonical = new URL(dom.canonicalUrl);
      if (canonical.origin !== target.origin) issues.push('canonical points to a different origin');
    } catch {
      issues.push('canonical URL is invalid');
    }
  }

  const score = Math.max(0, 14 - issues.length * 2);

  return {
    id: 'basic_metadata',
    title: 'Basic SEO metadata',
    category: 'metadata',
    status: issues.length === 0 ? 'pass' : issues.length >= 3 ? 'fail' : 'warning',
    score,
    maxScore: 14,
    severity: issues.length >= 3 ? 'high' : issues.length > 0 ? 'medium' : 'low',
    effort: 'low',
    message: issues.length === 0 ? 'Title, description, canonical, lang, and viewport are present.' : issues.join('; '),
    fix: issues.length === 0 ? undefined : 'Add complete page metadata with a clear title, meta description, canonical URL, html lang, and viewport tag.'
  };
}

function checkSocialMetadata(dom: DomInsight): ScanCheck {
  const missing: string[] = [];
  if (!dom.ogTitle) missing.push('og:title');
  if (!dom.ogDescription) missing.push('og:description');
  if (!dom.ogImage) missing.push('og:image');
  if (!dom.twitterCard) missing.push('twitter:card');

  return {
    id: 'social_metadata',
    title: 'Social preview metadata',
    category: 'social',
    status: missing.length === 0 ? 'pass' : 'warning',
    score: missing.length === 0 ? 6 : Math.max(1, 6 - missing.length),
    maxScore: 6,
    severity: 'low',
    effort: 'low',
    message: missing.length === 0 ? 'Open Graph and Twitter preview metadata are present.' : `Missing: ${missing.join(', ')}.`,
    fix: missing.length === 0 ? undefined : 'Add Open Graph and Twitter card metadata to improve sharing and AI citation previews.'
  };
}

function checkReadableStructure(dom: DomInsight): ScanCheck {
  const h1s = dom.headings.filter((heading) => heading.level === 1);
  const h2s = dom.headings.filter((heading) => heading.level === 2);
  const issues: string[] = [];

  if (h1s.length !== 1) issues.push(`expected exactly one H1, found ${h1s.length}`);
  if (h2s.length === 0) issues.push('no H2 sections found');
  if (dom.wordCount < 250) issues.push(`thin visible content (${dom.wordCount} words)`);
  if (hasSkippedHeadingLevels(dom)) issues.push('heading levels appear to skip hierarchy');

  return {
    id: 'readable_structure',
    title: 'Readable content structure',
    category: 'content-quality',
    status: issues.length === 0 ? 'pass' : 'warning',
    score: issues.length === 0 ? 12 : Math.max(3, 12 - issues.length * 2),
    maxScore: 12,
    severity: issues.length >= 3 ? 'medium' : 'low',
    effort: 'medium',
    message: issues.length === 0 ? 'The page has clear headings and enough crawlable text.' : issues.join('; '),
    fix: issues.length === 0 ? undefined : 'Use one descriptive H1, logical H2/H3 sections, and enough crawlable text for search engines and AI agents.'
  };
}

function checkImages(dom: DomInsight): ScanCheck {
  if (dom.images.length === 0) {
    return {
      id: 'image_accessibility',
      title: 'Image accessibility',
      category: 'content-quality',
      status: 'not_applicable',
      score: 0,
      maxScore: 0,
      severity: 'info',
      message: 'No images were detected on the page.'
    };
  }

  const missingAlt = dom.images.filter((image) => !image.alt.trim()).length;
  const missingDimensions = dom.images.filter((image) => !image.width || !image.height).length;
  const issueCount = missingAlt + Math.min(missingDimensions, 5);

  return {
    id: 'image_accessibility',
    title: 'Image accessibility and stability',
    category: 'content-quality',
    status: missingAlt === 0 && missingDimensions === 0 ? 'pass' : 'warning',
    score: Math.max(2, 8 - Math.min(issueCount, 6)),
    maxScore: 8,
    severity: missingAlt > 3 ? 'medium' : 'low',
    effort: 'medium',
    message: `${missingAlt}/${dom.images.length} image(s) missing alt text; ${missingDimensions}/${dom.images.length} missing dimensions.`,
    fix: missingAlt === 0 && missingDimensions === 0 ? undefined : 'Add descriptive alt text to meaningful images and width/height attributes to reduce layout shift.'
  };
}

function checkLinks(dom: DomInsight): ScanCheck {
  const internalLinks = dom.links.filter((link) => link.isInternal);
  const emptyAnchors = dom.links.filter((link) => !link.text && !link.rel.includes('icon')).length;
  const descriptiveInternalLinks = internalLinks.filter((link) => link.text.length >= 4).length;

  if (internalLinks.length === 0) {
    return {
      id: 'internal_linking',
      title: 'Internal linking',
      category: 'discoverability',
      status: 'warning',
      score: 2,
      maxScore: 8,
      severity: 'medium',
      effort: 'medium',
      message: 'No internal links were detected from the current page.',
      fix: 'Add descriptive internal links to important pages so crawlers and agents can discover related content.'
    };
  }

  return {
    id: 'internal_linking',
    title: 'Internal linking',
    category: 'discoverability',
    status: emptyAnchors > 5 || descriptiveInternalLinks < 3 ? 'warning' : 'pass',
    score: emptyAnchors > 5 || descriptiveInternalLinks < 3 ? 5 : 8,
    maxScore: 8,
    severity: 'low',
    effort: 'medium',
    message: `${internalLinks.length} internal link(s), ${descriptiveInternalLinks} with descriptive anchor text, ${emptyAnchors} empty anchor(s).`,
    fix: emptyAnchors > 5 || descriptiveInternalLinks < 3 ? 'Use descriptive anchor text and link to key related pages, docs, pricing, support, and conversion pages.' : undefined
  };
}

function checkEntitySignals(dom: DomInsight, siteProfiles: SiteProfile[]): ScanCheck {
  const text = `${dom.title} ${dom.metaDescription || ''} ${dom.headings.map((heading) => heading.text).join(' ')}`.toLowerCase();
  const usefulSignals = ['about', 'pricing', 'contact', 'support', 'docs', 'faq', 'blog', 'terms', 'privacy'];
  const matchedSignals = usefulSignals.filter((signal) => text.includes(signal) || dom.links.some((link) => link.text.toLowerCase().includes(signal) || link.href.toLowerCase().includes(signal)));
  const isLocal = siteProfiles.includes('local-business');
  const hasLocalSignals = /\b(phone|address|opening hours|location|map)\b/i.test(text) || dom.jsonLd.some((jsonLd) => jsonLd.types.includes('LocalBusiness'));

  if (isLocal && !hasLocalSignals) {
    return {
      id: 'entity_trust_signals',
      title: 'Entity and trust signals',
      category: 'content-quality',
      status: 'warning',
      score: 4,
      maxScore: 8,
      severity: 'medium',
      effort: 'medium',
      message: 'Local-business profile detected, but local entity signals are weak.',
      fix: 'Add LocalBusiness schema, address, phone, opening hours, map, contact page, and consistent NAP information.'
    };
  }

  return {
    id: 'entity_trust_signals',
    title: 'Entity and trust signals',
    category: 'content-quality',
    status: matchedSignals.length >= 3 ? 'pass' : 'warning',
    score: matchedSignals.length >= 3 ? 8 : 5,
    maxScore: 8,
    severity: 'low',
    effort: 'medium',
    message: matchedSignals.length >= 3 ? `Useful trust/navigation signals found: ${matchedSignals.join(', ')}.` : 'Few trust/navigation signals were detected.',
    fix: matchedSignals.length >= 3 ? undefined : 'Make important entity pages easy to discover: About, Contact, Pricing, Docs, FAQ, Support, Terms, and Privacy.'
  };
}

function hasSkippedHeadingLevels(dom: DomInsight): boolean {
  let previous = 0;

  for (const heading of dom.headings) {
    if (previous > 0 && heading.level - previous > 1) return true;
    previous = heading.level;
  }

  return false;
}
