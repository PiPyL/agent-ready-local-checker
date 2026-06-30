import type { ScanCheck, SiteProfile } from '../types';
import { fetchTextResource, isLikelyJson } from '../utils/http';
import { clampText } from '../utils/text';

interface WellKnownTarget {
  id: string;
  title: string;
  paths: string[];
  maxScore: number;
  appliesTo: SiteProfile[];
  fix: string;
  expectJson?: boolean;
}

const TARGETS: WellKnownTarget[] = [
  {
    id: 'mcp_server_card',
    title: 'MCP server card',
    paths: ['/.well-known/mcp/server-card.json', '/.well-known/mcp.json'],
    maxScore: 8,
    appliesTo: ['api', 'app', 'docs', 'saas'],
    expectJson: true,
    fix: 'If the site exposes tools or resources through MCP, publish a server card under /.well-known/mcp/server-card.json or /.well-known/mcp.json.'
  },
  {
    id: 'agent_skills',
    title: 'Agent skills index',
    paths: ['/.well-known/agent-skills/index.json'],
    maxScore: 8,
    appliesTo: ['api', 'app', 'saas'],
    expectJson: true,
    fix: 'Publish an agent skills index when the website exposes reusable actions for AI agents.'
  },
  {
    id: 'oauth_authorization_server',
    title: 'OAuth authorization server metadata',
    paths: ['/.well-known/oauth-authorization-server'],
    maxScore: 5,
    appliesTo: ['api', 'app', 'saas'],
    expectJson: true,
    fix: 'If agents need authenticated access, publish OAuth authorization server metadata.'
  },
  {
    id: 'oauth_protected_resource',
    title: 'OAuth protected resource metadata',
    paths: ['/.well-known/oauth-protected-resource'],
    maxScore: 5,
    appliesTo: ['api', 'app', 'saas'],
    expectJson: true,
    fix: 'If the site exposes protected resources to agents, publish OAuth protected resource metadata.'
  },
  {
    id: 'api_catalog',
    title: 'API catalog',
    paths: ['/.well-known/api-catalog', '/.well-known/api-catalog.json'],
    maxScore: 6,
    appliesTo: ['api', 'docs', 'saas'],
    expectJson: true,
    fix: 'If the website has public APIs, publish an API catalog endpoint or link to OpenAPI specs.'
  },
  {
    id: 'web_bot_auth',
    title: 'Web Bot Auth directory',
    paths: ['/.well-known/http-message-signatures-directory'],
    maxScore: 5,
    appliesTo: ['api', 'saas', 'ecommerce', 'content', 'docs'],
    expectJson: true,
    fix: 'For authenticated bot verification, publish a Web Bot Auth HTTP message signatures directory when relevant.'
  },
  {
    id: 'x402_payment',
    title: 'Agentic commerce payment signal',
    paths: ['/.well-known/x402', '/.well-known/x402.json'],
    maxScore: 4,
    appliesTo: ['ecommerce', 'api'],
    expectJson: true,
    fix: 'For agentic commerce, expose machine-readable payment or purchasing metadata only if this site supports agent transactions.'
  }
];

export async function checkWellKnownEndpoints(origin: string, siteProfiles: SiteProfile[]): Promise<ScanCheck[]> {
  return Promise.all(TARGETS.map((target) => checkWellKnownEndpoint(origin, target, siteProfiles)));
}

async function checkWellKnownEndpoint(origin: string, target: WellKnownTarget, siteProfiles: SiteProfile[]): Promise<ScanCheck> {
  const relevant = isRelevant(target, siteProfiles);

  if (!relevant) {
    return {
      id: target.id,
      title: target.title,
      category: 'protocol',
      status: 'not_applicable',
      score: 0,
      maxScore: 0,
      optional: true,
      appliesTo: target.appliesTo,
      severity: 'info',
      message: `${target.title} is not applicable for the detected page profile.`
    };
  }

  for (const path of target.paths) {
    const url = `${origin}${path}`;

    try {
      const resource = await fetchTextResource(url, { headers: { Accept: 'application/json, text/plain;q=0.8' } }, 500_000);

      if (!resource.ok) continue;

      const looksJson = target.expectJson ? isLikelyJson(resource.contentType, resource.text) : true;

      return {
        id: target.id,
        title: target.title,
        category: 'protocol',
        status: looksJson ? 'pass' : 'warning',
        score: looksJson ? target.maxScore : Math.round(target.maxScore * 0.5),
        maxScore: target.maxScore,
        optional: true,
        appliesTo: target.appliesTo,
        severity: looksJson ? 'low' : 'medium',
        effort: looksJson ? 'low' : 'medium',
        message: looksJson ? `${path} found.` : `${path} found but does not look like valid JSON.`,
        evidence: clampText(resource.text, 400),
        fix: looksJson ? undefined : 'Return valid JSON and the appropriate content-type for this well-known endpoint.'
      };
    } catch {
      // Continue with the next candidate path.
    }
  }

  return {
    id: target.id,
    title: target.title,
    category: 'protocol',
    status: 'warning',
    score: 0,
    maxScore: target.maxScore,
    optional: true,
    appliesTo: target.appliesTo,
    severity: 'low',
    effort: 'medium',
    message: `${target.title} was not found at known well-known paths.`,
    fix: target.fix
  };
}

function isRelevant(target: WellKnownTarget, siteProfiles: SiteProfile[]): boolean {
  if (siteProfiles.includes('unknown')) return false;
  return target.appliesTo.some((profile) => siteProfiles.includes(profile));
}
