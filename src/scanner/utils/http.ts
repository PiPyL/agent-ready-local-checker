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
    headers: {
      ...(init.headers || {})
    }
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
  if (contentType.includes('json')) return true;
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key.toLowerCase()] = value;
  });
  return record;
}
