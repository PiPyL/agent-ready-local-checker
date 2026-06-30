# AgentReady Local Checker

Privacy-first Chrome extension to audit whether the current website is ready for AI agents.

The scanner runs locally in the browser. No backend, no tracking, and no website content is sent to any remote server.

## MVP scope

- Manifest V3 Chrome extension
- Scan the current tab locally
- Check `robots.txt`, sitemap, `llms.txt`, `llms-full.txt`, Markdown negotiation, key well-known endpoints, and basic DOM metadata
- Score the website from 0 to 100
- Generate rule-based fix recommendations
- Export a Markdown report
- Store scan history in `chrome.storage.local`
- Optional future integration with local LLMs such as Ollama or LM Studio

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
  scanner/           Local scan checks and scoring
  report/            Markdown report generator
  storage/           Local history wrapper
```

## Positioning

> Make websites readable, discoverable, and safer for AI agents — locally.

This project is intentionally local-first. The default implementation avoids external APIs. AI-generated recommendations should only be added through optional local runtimes like Ollama.
