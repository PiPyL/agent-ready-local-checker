import type { ScanCheck } from '../types';

interface WellKnownTarget {
  id: string;
  title: string;
  path: string;
  maxScore: number;
  required: boolean;
  fix: string;
}

const TARGETS: WellKnownTarget[] = [
  {
    id: 'mcp_server_card',
    title: 'MCP server card',
    path: '/.well-known/mcp.json',
    maxScore: 8,
    required: false,
    fix: 'If the site exposes tools or resources through MCP, publish an MCP server card under /.well-known/mcp.json.'
  },
  {
    id: 'agent_skills',
    title: 'Agent skills index',
    path: '/.well-known/agent-skills/index.json',
    maxScore: 8,
    required: false,
    fix: 'Publish an agent skills index when the website exposes reusable actions for AI agents.'
  },
  {
    id: 'oauth_authorization_server',
    title: 'OAuth authorization server metadata',
    path: '/.well-known/oauth-authorization-server',
    maxScore: 5,
    required: false,
    fix: 'If agents need authenticated access, publish OAuth authorization server metadata.'
  },
  {
    id: 'oauth_protected_resource',
    title: 'OAuth protected resource metadata',
    path: '/.well-known/oauth-protected-resource',
    maxScore: 5,
    required: false,
    fix: 'If the site exposes protected resources to agents, publish OAuth protected resource metadata.'
  },
  {
    id: 'api_catalog',
    title: 'API catalog',
    path: '/.well-known/api-catalog',
    maxScore: 6,
    required: false,
    fix: 'If the website has public APIs, publish an API catalog endpoint or link to OpenAPI specs.'
  }
];

export async function checkWellKnownEndpoints(origin: string): Promise<ScanCheck[]> {
  return Promise.all(TARGETS.map((target) => checkWellKnownEndpoint(origin, target)));
}

async function checkWellKnownEndpoint(origin: string, target: WellKnownTarget): Promise<ScanCheck> {
  const url = `${origin}${target.path}`;

  try {
    const res = await fetch(url, { cache: 'no-store' });

    if (!res.ok) {
      return {
        id: target.id,
        title: target.title,
        category: 'protocol',
        status: target.required ? 'fail' : 'warning',
        score: 0,
        maxScore: target.maxScore,
        message: `${target.path} was not found.`,
        fix: target.fix
      };
    }

    const text = await res.text();
    const looksJson = isJsonLike(text) || (res.headers.get('content-type') || '').includes('json');

    return {
      id: target.id,
      title: target.title,
      category: 'protocol',
      status: looksJson ? 'pass' : 'warning',
      score: looksJson ? target.maxScore : Math.round(target.maxScore * 0.5),
      maxScore: target.maxScore,
      message: looksJson ? `${target.path} found.` : `${target.path} found but does not look like JSON.`,
      evidence: text.slice(0, 300),
      fix: looksJson ? undefined : 'Return valid JSON and the appropriate content-type for this well-known endpoint.'
    };
  } catch {
    return {
      id: target.id,
      title: target.title,
      category: 'protocol',
      status: 'unknown',
      score: 0,
      maxScore: target.maxScore,
      message: `Could not verify ${target.path}.`,
      fix: 'Check whether the endpoint is blocked by network rules, redirects, or site configuration.'
    };
  }
}

function isJsonLike(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}
