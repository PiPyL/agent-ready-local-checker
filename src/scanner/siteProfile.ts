import type { DomInsight, SiteProfile } from './types';

export function inferSiteProfiles(url: string, dom: DomInsight | null): SiteProfile[] {
  const target = new URL(url);
  const text = collectProfileText(target, dom);
  const profiles = new Set<SiteProfile>();

  if (matches(text, ['docs', 'documentation', 'api reference', 'developer', 'guide', 'changelog'])) profiles.add('docs');
  if (matches(text, ['pricing', 'features', 'dashboard', 'login', 'sign in', 'saas', 'software'])) profiles.add('saas');
  if (matches(text, ['cart', 'checkout', 'product', 'price', 'sku', 'availability', 'add to cart'])) profiles.add('ecommerce');
  if (matches(text, ['openapi', 'swagger', 'api key', 'endpoint', 'webhook', 'rest api', 'graphql'])) profiles.add('api');
  if (matches(text, ['address', 'phone', 'opening hours', 'map', 'near me', 'location'])) profiles.add('local-business');
  if (matches(text, ['blog', 'article', 'news', 'author', 'published', 'category'])) profiles.add('content');
  if (matches(text, ['app', 'download', 'install', 'extension', 'mobile app'])) profiles.add('app');

  if (profiles.size === 0) profiles.add('unknown');
  return [...profiles];
}

function collectProfileText(target: URL, dom: DomInsight | null): string {
  const parts = [target.hostname, target.pathname];

  if (dom) {
    parts.push(
      dom.title,
      dom.metaDescription || '',
      ...dom.headings.map((heading) => heading.text),
      ...dom.links.slice(0, 80).map((link) => `${link.text} ${link.href}`),
      ...dom.jsonLd.flatMap((jsonLd) => jsonLd.types)
    );
  }

  return parts.join(' ').toLowerCase();
}

function matches(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}
