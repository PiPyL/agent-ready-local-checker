import type { DomInsight, JsonLdInsight } from '../scanner/types';

function collectDomInsight(): DomInsight {
  const visibleText = document.body?.innerText?.replace(/\s+/g, ' ').trim() || '';
  const origin = window.location.origin;

  return {
    title: document.title?.trim() || '',
    metaDescription: getMeta('description'),
    canonicalUrl: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href || null,
    metaRobots: getMeta('robots') || getMeta('googlebot'),
    htmlLang: document.documentElement.lang || null,
    viewport: document.querySelector<HTMLMetaElement>('meta[name="viewport"]')?.content?.trim() || null,
    ogTitle: getMetaProperty('og:title'),
    ogDescription: getMetaProperty('og:description'),
    ogImage: getMetaProperty('og:image'),
    twitterCard: getMeta('twitter:card'),
    headings: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
      .slice(0, 80)
      .map((heading) => ({
        level: Number(heading.tagName.replace('H', '')),
        text: heading.textContent?.replace(/\s+/g, ' ').trim() || ''
      }))
      .filter((heading) => heading.text),
    images: [...document.images].slice(0, 120).map((image) => ({
      src: image.currentSrc || image.src,
      alt: image.alt || '',
      width: image.naturalWidth || image.width || null,
      height: image.naturalHeight || image.height || null,
      loading: image.loading || null
    })),
    links: [...document.querySelectorAll<HTMLAnchorElement>('a[href]')]
      .slice(0, 250)
      .map((anchor) => ({
        href: anchor.href,
        text: anchor.textContent?.replace(/\s+/g, ' ').trim().slice(0, 160) || '',
        rel: anchor.rel || '',
        isInternal: anchor.href.startsWith(origin)
      })),
    jsonLd: collectJsonLd(),
    visibleTextLength: visibleText.length,
    wordCount: visibleText.split(/\s+/).filter(Boolean).length
  };
}

function getMeta(name: string): string | null {
  return document.querySelector<HTMLMetaElement>(`meta[name="${cssEscape(name)}"]`)?.content?.trim() || null;
}

function getMetaProperty(property: string): string | null {
  return document.querySelector<HTMLMetaElement>(`meta[property="${cssEscape(property)}"]`)?.content?.trim() || null;
}

function collectJsonLd(): JsonLdInsight[] {
  return [...document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')]
    .slice(0, 30)
    .map((script) => parseJsonLd(script.textContent || ''));
}

function parseJsonLd(raw: string): JsonLdInsight {
  try {
    const parsed = JSON.parse(raw);
    return {
      raw: raw.slice(0, 20_000),
      types: extractSchemaTypes(parsed)
    };
  } catch (error) {
    return {
      raw: raw.slice(0, 20_000),
      parseError: error instanceof Error ? error.message : 'Invalid JSON-LD',
      types: []
    };
  }
}

function extractSchemaTypes(value: unknown): string[] {
  const types = new Set<string>();

  function walk(node: unknown) {
    if (!node || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    const record = node as Record<string, unknown>;
    const typeValue = record['@type'];

    if (typeof typeValue === 'string') types.add(typeValue);
    if (Array.isArray(typeValue)) {
      typeValue.forEach((item) => {
        if (typeof item === 'string') types.add(item);
      });
    }

    if (Array.isArray(record['@graph'])) walk(record['@graph']);
  }

  walk(value);
  return [...types];
}

function cssEscape(value: string): string {
  return value.replace(/"/g, '\\"');
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'GET_DOM_INSIGHT') return false;

  sendResponse({ ok: true, data: collectDomInsight() });
  return true;
});
