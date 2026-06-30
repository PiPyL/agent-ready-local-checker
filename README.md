# AgentReady Local Checker

Privacy-first Chrome extension to audit whether the current website is ready for SEO, GEO, AI search, and AI agents.

The scanner runs locally in the browser. No backend, no tracking, and no website content is sent to any remote server.

## Current audit scope

### Crawlability and indexability

- `robots.txt` fetchability and parseability
- Googlebot/Bingbot access for the current URL
- AI crawler access policy for common AI-related bots
- Content-Signal directive detection
- HTTP status, redirect, meta robots, X-Robots-Tag, and canonical consistency

### Discoverability

- Sitemap discovery from `robots.txt` and common sitemap paths
- Sitemap index parsing
- Sitemap URL sampling
- `<lastmod>` freshness coverage
- Internal linking and anchor quality

### GEO / AI-readable content

- `/llms.txt` structure validation
- `/llms-full.txt` optional validation
- Detection of SPA HTML fallback on machine-readable routes
- Markdown negotiation through `Accept: text/markdown`
- `/index.md` and `.md` fallback detection
- Rule-based implementation prompt for Cursor, Claude Code, Copilot, or other coding agents

### On-page SEO and entity signals

- Title, meta description, canonical, html lang, viewport
- Open Graph and Twitter preview metadata
- Heading structure and visible word count
- Image alt text and dimensions
- Trust/entity navigation signals such as About, Contact, Pricing, Docs, FAQ, Support, Terms, and Privacy

### Structured data

- JSON-LD parse validation
- Schema type coverage by detected site profile
- Recommended schema hints for content, SaaS, docs, e-commerce, local business, API, and app profiles

### Agent protocol and API readiness

- MCP server card candidates
- Agent Skills index
- OAuth authorization server metadata
- OAuth protected resource metadata
- API Catalog
- Web Bot Auth directory
- x402/agentic commerce signal
- OpenAPI/Swagger discovery

Protocol checks are now intent-based. The scanner looks for API, developer, tool, OAuth, bot-auth, or commerce intent before applying advanced protocol checks. Missing MCP/OAuth/API-commerce endpoints should not unfairly penalize ordinary marketing or content pages.

## SPA fallback handling

Modern React/Vite/Next SPA deployments often return `index.html` for every unknown path. This is useful for app routes but harmful for machine-readable URLs.

The scanner treats the following as invalid if they return HTML fallback instead of real static content:

```text
/llms.txt
/llms-full.txt
/index.md
*.md
/.well-known/*.json
/.well-known/* protocol endpoints
/openapi.json
/swagger.json
```

Expected behavior:

- Real machine-readable files should return the correct text, Markdown, or JSON body.
- Missing machine-readable files should return 404.
- The SPA catch-all route should not serve `index.html` for these paths.

## Scoring model

The extension uses weighted, conditional scoring instead of a raw presence score.

- Checks are grouped by category: crawlability, indexability, discoverability, agent content, bot policy, protocol, metadata, structured data, content quality, social, and performance.
- Optional capability checks can add value when present but are excluded from scoring when not applicable.
- Contextual optional checks are scored when capability intent is detected or when an endpoint exists but is invalid.
- The scanner infers site profiles locally from the current URL and DOM signals.
- The report includes overall score, grade, score breakdown, highest-priority fixes, and a ready-to-copy implementation prompt.

## Local development

```bash
npm install
npm run dev
```

For Chrome extension testing, build the extension:

```bash
npm run build
```

Then load the `dist` folder in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the generated `dist` folder

## Build

```bash
npm run build
```

## Project structure

```text
src/
  background/        Manifest V3 service worker
  content/           DOM inspector injected into the current tab
  popup/             React popup UI
  scanner/           Local scan checks, parsers, site profile, and scoring
  report/            Markdown report and fix-prompt generator
  storage/           Local history wrapper
```

## Positioning

> Make websites crawlable, citable, readable, discoverable, and safer for AI agents — locally.

This project is intentionally local-first. The default implementation avoids external APIs. AI-generated recommendations should only be added through optional local runtimes like Ollama or LM Studio.
