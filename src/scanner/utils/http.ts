export interface FetchTextResult {
  url: string;
  finalUrl: string;
  status: number;
  ok: boolean;
  redirected: boolean;
  contentType: string;
  headers: Record<string, string>;
  text: string;
}

export async function fetchTextResource(url: string, init: RequestInit = {}, maxChars = 1_000_000): Promise<FetchTextResult> {
  const res = await fetch(url, {
    redirect: 'follow',
    cache: 'no-store',
    ...init,
    headers: normalizeRequestHeaders(init.headers)
  });

  const headers = headersToRecord(res.headers);
  const text = (await res.text()).slice(0, maxChars);

  return {
    url,
    finalUrl: res.url,
    status: res.status,
    ok: res.ok,
    redirected: res.redirected,
    contentType: res.headers.get('content-type') || '',
    headers,
    text
  };
}

export function getHeader(headers: Record<string, string>, name: string): string | null {
  const wanted = name.toLowerCase();
  return headers[wanted] || null;
}

export function isLikelyHtml(contentType: string, text: string): boolean {
  return contentType.includes('text/html') || /<!doctype html|<html[\s>]|<body[\s>]/i.test(text);
}

export function isLikelyJson(contentType: string, text: string): boolean {
  if (contentType.includes('json') && !isLikelyHtml(contentType, text)) return true;
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

export function isSpaHtmlFallback(resource: FetchTextResult, requestedPath?: string): boolean {
  if (!resource.ok) return false;
  if (!isLikelyHtml(resource.contentType, resource.text)) return false;

  const path = requestedPath || safePathname(resource.url);
  const normalizedPath = path.toLowerCase();
  const isMachineReadablePath =
    normalizedPath.endsWith('.txt') ||
    normalizedPath.endsWith('.json') ||
    normalizedPath.endsWith('.md') ||
    normalizedPath.includes('/.well-known/') ||
    normalizedPath.endsWith('/openapi') ||
    normalizedPath.endsWith('/api-catalog');

  if (!isMachineReadablePath) return false;

  return /<div\s+id=["']root["']|<div\s+id=["']app["']|\/static\/js\/|window\.__|data-rh=|<script[^>]+src=/i.test(resource.text) || isLikelyHtml(resource.contentType, resource.text);
}

export function describeFallback(resource: FetchTextResult): string {
  return `Requested: ${resource.url}\nFinal: ${resource.finalUrl}\nStatus: ${resource.status}\nContent-Type: ${resource.contentType || 'unknown'}\nBody starts with: ${resource.text.slice(0, 180).replace(/\s+/g, ' ').trim()}`;
}

function safePathname(value: string): string {
  try {
    return new URL(value).pathname;
  } catch {
    return value;
  }
}

function normalizeRequestHeaders(headersInit?: HeadersInit): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!headersInit) return headers;

  new Headers(headersInit).forEach((value, key) => {
    headers[key] = value;
  });

  return headers;
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key.toLowerCase()] = value;
  });
  return record;
}
