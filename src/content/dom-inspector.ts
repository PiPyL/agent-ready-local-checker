import type { DomInsight } from '../scanner/types';

function collectDomInsight(): DomInsight {
  const metaDescription = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content?.trim() || null;
  const canonicalUrl = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href || null;
  const jsonLdCount = document.querySelectorAll('script[type="application/ld+json"]').length;
  const h1Count = document.querySelectorAll('h1').length;
  const h2Count = document.querySelectorAll('h2').length;
  const visibleTextLength = document.body?.innerText?.replace(/\s+/g, ' ').trim().length || 0;

  return {
    title: document.title?.trim() || '',
    metaDescription,
    canonicalUrl,
    jsonLdCount,
    h1Count,
    h2Count,
    visibleTextLength
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'GET_DOM_INSIGHT') return false;

  sendResponse({ ok: true, data: collectDomInsight() });
  return true;
});
