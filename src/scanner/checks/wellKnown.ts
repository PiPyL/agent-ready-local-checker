import type { DomInsight, ScanCheck, SiteProfile } from '../types';
import { describeFallback, fetchTextResource, isLikelyJson, isSpaHtmlFallback } from '../utils/http';
import { clampText } from '../utils/text';

interface WellKnownTarget {
  id: string;
  title: string;
  paths: string[];
  maxScore: number;
  capability: 'agent-tools' | 'auth' | 'api' | 'bot-auth' | 'commerce';
  fix: string;
  expectJson?: boolean;
}

const TARGETS: WellKnownTarget[] = [
  {
    id: 'mcp_server_card',
    title: 'MCP server card',
    paths: ['/.well-known/mcp/server-card.json', '/.well-known/mcp.json'],
    maxScore: 8,
    capability: 'agent-tools',
    expectJson: true,
    fix: 'If the site exposes tools or resources through MCP, publish a server card under /.well-known/mcp/server-card.json or /.well-known/mcp.json. If it does not expose agent tools, return 404 instead of SPA HTML fallback.'
  },
  {
    id: 'agent_skills',
    title: 'Agent skills index',
    paths: ['/.well-known/agent-skills/index.json'],
    maxScore: 8,
    capability: 'agent-tools',
    expectJson: true,
    fix: 'Publish an agent skills index only when the website exposes reusable actions for AI agents. Otherwise configure the server to return 404 instead of SPA HTML fallback.'
  },
  {
    id: 'oauth_authorization_server',
    title: 'OAuth authorization server metadata',
    paths: ['/.well-known/oauth-authorization-server'],
    maxScore: 5,
    capability: 'auth',
    expectJson: true,
    fix: 'If agents need authenticated access, publish OAuth authorization server metadata. Otherwise return 404 instead of SPA HTML fallback.'
  },
  {
    id: 'oauth_protected_resource',
    title: 'OAuth protected resource metadata',
    paths: ['/.well-known/oauth-protected-resource'],
    maxScore: 5,
    capability: 'auth',
    expectJson: true,
    fix: 'If the site exposes protected resources to agents, publish OAuth protected resource metadata. Otherwise return 404 instead of SPA HTML fallback.'
  },
  {
    id: 'api_catalog',
    title: 'API catalog',
    paths: ['/.well-known/api-catalog', '/.well-known/api-catalog.json'],
    maxScore: 6,
    capability: 'api',
    expectJson: true,
    fix: 'If the website has public APIs, publish an API catalog endpoint or link to OpenAPI specs. Otherwise return 404 instead of SPA HTML fallback.'
  },
  {
    id: 'web_bot_auth',
    title: 'Web Bot Auth directory',
    paths: ['/.well-known/http-message-signatures-directory'],
    maxScore: 5,
    capability: 'bot-auth',
    expectJson: true,
    fix: 'For authenticated bot verification, publish a Web Bot Auth HTTP message signatures directory when relevant. Otherwise return 404 instead of SPA HTML fallback.'
  },
  {
    id: 'x402_payment',
    title: 'Agentic commerce payment signal',
    paths: ['/.well-known/x402', '/.well-known/x402.json'],
    maxScore: 4,
    capability: 'commerce',
    expectJson: true,
    fix: 'For agentic commerce, expose machine-readable payment or purchasing metadata only if this site supports agent transactions.'
  }
];

export async function checkWellKnownEndpoints(origin: string, siteProfiles: SiteProfile[], dom: DomInsight | null): Promise<ScanCheck[]> {
  return Promise.all(TARGETS.map((target) => checkWellKnownEndpoint(origin, target, siteProfiles, dom)));
}

async function checkWellKnownEndpoint(origin: string, target: WellKnownTarget, siteProfiles: SiteProfile[], dom: DomInsight | null): Promise<ScanCheck> {
  const relevant = isRelevant(target, siteProfiles, dom);

  if (!relevant) {
    return {
      id: target.id,
      title: target.title,
      category: 'protocol',
      status: 'not_applicable',
      score: 0,
      maxScore: 0,
      optional: true,
      appliesTo: appliesToForCapability(target.capability),
      severity: 'info',
      message: `${target.title} is not applicable because no matching capability intent was detected.`
    };
  }

  const fallbackEvidence: string[] = [];

  for (const path of target.paths) {
    const url = `${origin}${path}`;

    try {
      const resource = await fetchTextResource(url, { headers: { Accept: 'application/json, text/plain;q=0.8' } }, 500_000);

      if (!resource.ok) continue;

      if (isSpaHtmlFallback(resource, path)) {
        fallbackEvidence.push(describeFallback(resource));
        continue;
      }

      const looksJson = target.expectJson ? isLikelyJson(resource.contentType, resource.text) : true;

      if (!looksJson) {
        return {
          id: target.id,
          title: target.title,
          category: 'protocol',
          status: 'fail',
          score: 0,
          maxScore: target.maxScore,
          optional: true,
          appliesTo: appliesToForCapability(target.capability),
          severity: 'medium',
          effort: 'medium',
          message: `${path} exists but does not return valid JSON or expected machine-readable content.`,
          evidence: clampText(resource.text, 400),
          fix: 'Return valid JSON with the appropriate content-type for this endpoint, or return 404 if the capability is not implemented.'
        };
      }

      return {
        id: target.id,
        title: target.title,
        category: 'protocol',
        status: 'pass',
        score: target.maxScore,
        maxScore: target.maxScore,
        optional: true,
        appliesTo: appliesToForCapability(target.capability),
        severity: 'low',
        effort: 'low',
        message: `${path} found and appears machine-readable.`,
        evidence: clampText(resource.text, 400)
      };
    } catch {
      // Continue with the next candidate path.
    }
  }

  if (fallbackEvidence.length > 0) {
    return {
      id: target.id,
      title: target.title,
      category: 'protocol',
      status: 'warning',
      score: 0,
      maxScore: target.maxScore,
      optional: true,
      appliesTo: appliesToForCapability(target.capability),
      severity: 'medium',
      effort: 'low',
      message: `${target.title} route appears to be handled by SPA HTML fallback, not a real machine-readable endpoint.`,
      evidence: fallbackEvidence[0],
      fix: target.fix
    };
  }

  return {
    id: target.id,
    title: target.title,
    category: 'protocol',
    status: 'warning',
    score: 0,
    maxScore: target.maxScore,
    optional: true,
    appliesTo: appliesToForCapability(target.capability),
    severity: 'low',
    effort: 'medium',
    message: `${target.title} was not found at known well-known paths.`,
    fix: target.fix
  };
}

function isRelevant(target: WellKnownTarget, siteProfiles: SiteProfile[], dom: DomInsight | null): boolean {
  const intent = collectIntentText(dom);

  switch (target.capability) {
    case 'api':
      return siteProfiles.includes('api') || siteProfiles.includes('docs') || /\b(api|developer|developers|openapi|swagger|webhook|sdk|endpoint|graphql|rest api|api key)\b/i.test(intent);
    case 'agent-tools':
      return siteProfiles.includes('api') || /\b(mcp|agent skill|tool server|tool calling|automation api|workflow api|integration api|webhook)\b/i.test(intent);
    case 'auth':
      return siteProfiles.includes('api') || /\b(oauth|openid|oidc|authorization server|protected resource|api key|bearer token|developer app)\b/i.test(intent);
    case 'bot-auth':
      return /\b(web bot auth|http message signature|signed agent|verified bot|bot verification)\b/i.test(intent);
    case 'commerce':
      return siteProfiles.includes('ecommerce') || /\b(x402|agentic commerce|checkout api|cart api|purchase api|payment api)\b/i.test(intent);
    default:
      return false;
  }
}

function collectIntentText(dom: DomInsight | null): string {
  if (!dom) return '';
  return [
    dom.title,
    dom.metaDescription || '',
    ...dom.headings.map((heading) => heading.text),
    ...dom.links.map((link) => `${link.text} ${link.href}`),
    ...dom.jsonLd.flatMap((jsonLd) => jsonLd.types)
  ].join(' ').toLowerCase();
}

function appliesToForCapability(capability: WellKnownTarget['capability']): SiteProfile[] {
  switch (capability) {
    case 'api':
      return ['api', 'docs', 'saas', 'app'];
    case 'agent-tools':
      return ['api', 'docs', 'saas', 'app'];
    case 'auth':
      return ['api', 'saas', 'app'];
    case 'bot-auth':
      return ['api', 'saas', 'content', 'docs'];
    case 'commerce':
      return ['ecommerce', 'api'];
    default:
      return ['unknown'];
  }
}
