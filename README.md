# visual-ai-editor

AI-powered visual HTML editor. Select any element on the page, describe what you want to change, and the AI modifies it following your design system.

Works everywhere: static HTML, React, Angular, Vue, or any framework — with **surgical, formatting-preserving saves** on static/server-rendered pages, and an **AI-agent handoff** for framework pages where the rendered DOM can't be written straight back to source.

Bring your own LLM: any OpenAI-compatible chat-completions API works (Groq, OpenAI, OpenRouter, Ollama, LM Studio, ...) — see [Choosing an AI provider](#choosing-an-ai-provider).

> **This is a development/staging tool by default.** It serves your project directory over HTTP and its API is unauthenticated unless you configure `apiToken`. Read [Security & production](#security--production) before deploying it anywhere reachable by the public internet.

## Install

```bash
npm install visual-ai-editor
```

Peer dependency (optional, for DESIGN.md rendering):
```bash
npm install marked
```

Ships with TypeScript types for both the client (`visual-ai-editor`) and server (`visual-ai-editor/server`) entry points — no `@types/*` package needed.

## Plug & play (recommended)

No more copying `server.js`, wiring `<link>`/`<script>` tags by hand, or juggling `express`/`dotenv` as separate installs — both now ship as real dependencies of this package.

**1. Create `start-ai-editor.js`** in your project root:

```js
const { startServer } = require('visual-ai-editor/server');

startServer({
  port: 3000,
  envPath: require('path').join(__dirname, '.env') // AI_API_KEY=...
});
```

**2. Add one line to your HTML** (before `</body>`):

```html
<script type="module">
  import { init } from './node_modules/visual-ai-editor/dist/ai-editor.esm.js';
  init({ apiBase: '/api' });
</script>
```

**3. Create `.env`** with your key:

```
# Any OpenAI-compatible provider works — see "Choosing an AI provider" below.
# Groq's free tier is the fastest way to try it: console.groq.com
AI_API_KEY=your_key_here
```

**4. Run:**

```bash
node start-ai-editor.js
```

That's it — the CSS is embedded in the bundle and injected automatically (no relative paths to break), and the backend runs in-process, serving your project's static files plus the `/api/*` endpoints.

## Choosing an AI provider

By default the server talks to Groq's OpenAI-compatible endpoint, but **any OpenAI-compatible chat-completions API works** — pass `ai` options to `startServer()` or set environment variables:

```js
startServer({
  ai: {
    endpoint: 'https://api.openai.com/v1/chat/completions', // default: Groq
    model: 'gpt-4o-mini',                                   // default: llama-3.3-70b-versatile
    apiKey: process.env.OPENAI_API_KEY                       // default: AI_API_KEY / GROQ_API_KEY env
  }
});
```

Or via `.env` (no code changes needed):

```
AI_ENDPOINT=https://api.openai.com/v1/chat/completions
AI_MODEL=gpt-4o-mini
AI_API_KEY=sk-...
```

Local models (Ollama, LM Studio) work the same way — point `AI_ENDPOINT` at their OpenAI-compatible endpoint (e.g. `http://localhost:11434/v1/chat/completions` for Ollama). The legacy `GROQ_API_KEY`/`GROQ_MODEL` env vars still work as a fallback for existing setups.

## AI agent onboarding

On `npm install`, this package also delivers an `AGENTS.md` file to your
project root — a guide explaining to any AI coding agent (Claude Code, Cursor,
etc.) how the editor works: the API contract, how `DESIGN.md` enforcement
works, how force mode works, and common troubleshooting. This means an agent
working on your project can read `AGENTS.md` and understand this tool without
you having to explain it.

- If your project has no `AGENTS.md` yet, one is created.
- If you already have one, our section is appended to it (or updated in place
  on future upgrades) — your existing content is never touched.
- If your npm setup blocks install scripts, run `npx visual-ai-editor
  agents:init` manually to get the same result.

## DESIGN.md — keep the AI on-brand

`DESIGN.md` is what stops the AI from inventing colors, spacing, or components
outside your design system. If your project doesn't have one yet, this package
helps you create it, following the methodology from
[camaraux.com.br/como-criar-aplicar-design-md-ia](https://camaraux.com.br/como-criar-aplicar-design-md-ia/).

**On `npm install`**, a postinstall check looks for `DESIGN.md` in your project
and prints a one-line nudge if it's missing — it never fails the install.

```bash
# Locate DESIGN.md and report which of the 11 recommended sections were found
npx visual-ai-editor design:check

# No DESIGN.md yet? Generate a guided prompt (DESIGN.prompt.md)
npx visual-ai-editor design:init

# Scan your project's CSS/HTML/JS for colors that aren't in DESIGN.md's palette
npx visual-ai-editor design:lint
```

`design:lint` is a deterministic, non-AI check — it extracts every color mentioned in `DESIGN.md` (frontmatter tokens, prose, code fences) and flags any hex/rgb/rgba color elsewhere in your project that isn't in that set. It's a heuristic (regex-based, so hash-prefixed IDs or dynamically-generated colors can produce false positives), but it's a fast way to catch drift between your documented palette and what's actually in your CSS. The same palette check runs automatically, server-side, on every `/api/edit` response — see below.

`design:init` writes `DESIGN.prompt.md` to your project root. Paste it into
Claude Code, Cursor, or any AI agent (`cat DESIGN.prompt.md | claude` works
too) — it walks the agent through an interview (visual personality, references,
product type, priorities) and then the 11-section structure (Overview,
Principles, Colors, Typography, Spacing, Elevation, Layout, Components,
Accessibility, AI Rules, Example Prompts) plus a validation checklist. Once
`DESIGN.md` exists at your project root, the editor picks it up automatically
— no configuration needed.

If your npm setup requires approving install scripts (e.g. `npm audit
signatures` / allow-scripts policies), the postinstall check is opt-in-safe:
it never blocks or fails the install either way — worst case, you just don't
get the one-line nudge and can run `design:check` manually.

### Deterministic palette enforcement

DESIGN.md enforcement isn't just "hope the LLM notices" — every `/api/edit`
response is checked server-side against every color mentioned in `DESIGN.md`
(via regex extraction, not another AI call). If the model's edit introduces a
color that's neither in your palette nor already present in the selected
element, the request comes back as a warning (same `{ warn }` shape as when
the model itself declines), with the computed HTML attached so "apply anyway"
doesn't cost a second AI call. This catches the case where the model *thinks*
it's compliant but isn't — it doesn't replace the model's own judgment about
spacing, typography or component conflicts, which still relies on the model
reading `DESIGN.md` in its prompt.

## Saving edits

**Static / server-rendered HTML** (no `DESIGN.md` frontend framework detected):
`AIEditor.saveToFile()` sends **surgical patches** — `{ before, after }` pairs
of the exact HTML that changed — to `/api/save`, which locates and replaces
just that text in your source file. This means:

- Your file's formatting, comments and indentation elsewhere are untouched.
- Git diffs are small and readable — one line changed, not the whole file.
- A timestamped backup is written to `.ai-editor/history/` before every save
  (kept up to 100 most recent; add `.ai-editor/` to `.gitignore`).
- If a patch's `before` text can't be located (you hand-edited the file
  since the last save, for example), that edit alone falls back to writing
  the full page snapshot — you're told which mode was used in the status bar.
- Multi-page projects: pass `page` (the browser's `location.pathname`, sent
  automatically) and the server resolves it to a file inside `staticDir`,
  rejecting any path that escapes it.

**Framework pages** (React/Vue/... — detected via React's `_debugSource` fiber
data or Vue 3's `__file` component metadata, or an explicit
`data-ai-source="path/to/File.jsx:42"` attribute you add yourself): writing
the rendered DOM back over JSX/templates would be wrong, so `saveToFile()`
instead posts a **handoff manifest** to `/api/handoff`, appended to
`.ai-editor/pending-changes.md` — one entry per edit, with the detected
source location, the instruction, and the before/after HTML. Open that file
with an AI coding agent (Claude Code, Cursor, ...) and ask it to apply the
listed changes to your real source files; delete each entry once applied.

## Quick Start (manual wiring)

### HTML (script tag)

```html
<link rel="stylesheet" href="node_modules/visual-ai-editor/dist/ai-editor.css">
<script src="node_modules/visual-ai-editor/dist/ai-editor.js"></script>
<script>
  AIEditor.init({ apiBase: '/api' });
</script>
```

### React

```jsx
import { useEffect } from 'react';
import AIEditor from 'visual-ai-editor';
import 'visual-ai-editor/dist/ai-editor.css';

function App() {
  useEffect(() => {
    AIEditor.init({ apiBase: '/api' });
    return () => AIEditor.destroy();
  }, []);

  return <div>Your content here</div>;
}
```

### Angular

```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';
import AIEditor from 'visual-ai-editor';
import 'visual-ai-editor/dist/ai-editor.css';

@Component({ selector: 'app-root', template: '<div>...</div>' })
export class AppComponent implements OnInit, OnDestroy {
  ngOnInit() { AIEditor.init({ apiBase: '/api' }); }
  ngOnDestroy() { AIEditor.destroy(); }
}
```

### Vue

```vue
<script setup>
import { onMounted, onUnmounted } from 'vue';
import AIEditor from 'visual-ai-editor';
import 'visual-ai-editor/dist/ai-editor.css';

onMounted(() => AIEditor.init({ apiBase: '/api' }));
onUnmounted(() => AIEditor.destroy());
</script>
```

## API

### `AIEditor.init(options?)`

Creates the editor UI and binds all event listeners.

| Option | Type | Default | Description |
|---|---|---|---|
| `apiBase` | `string` | `'/api'` | Base URL for backend endpoints |
| `apiToken` | `string` | none | Sent as `Authorization: Bearer <token>` on write endpoints. Must match the server's `apiToken` (see [Security & production](#security--production)) |
| `cssInject` | `boolean` | `true` | Auto-inject CSS into `<head>` |
| `cssUrl` | `string` | `'dist/ai-editor.css'` | Custom CSS URL when injecting |
| `locale` | `'en' \| 'pt-BR'` | `<html lang>` or `'en'` | UI language |
| `maxHtmlSize` | `number` | `60000` | Reject a selection (client-side, no request sent) whose serialized HTML exceeds this many characters |
| `onAfterApply` | `(elements) => void` | none | Called after an AI edit (or redo) swaps in new elements. Use this to rebind event listeners your own code attached to the old elements — a DOM replacement doesn't carry them over (see [Event listeners on edited elements](#event-listeners-on-edited-elements)) |
| `onAfterUndo` | `(elements) => void` | none | Called after an undo restores the previous elements |

### `AIEditor.destroy()`

Removes all editor UI, event listeners, and cleans up state. Call this on component unmount.

### `AIEditor.setTool(tool)`

Switches the active selection tool.

- `'cursor'` — click to select single elements
- `'area'` — drag to select elements by rectangle
- `'pencil'` — draw freehand lasso to select elements

### `AIEditor.selectElements(elements)`

Programmatically select an array of DOM elements.

### Event listeners on edited elements

Replacing an element (`el.replaceWith(newEl)`, which is how AI edits and redo
are applied) drops any event listeners attached directly to it with
`addEventListener`. If your page attaches listeners outside of a framework's
own reactivity (e.g. plain `<script>` blocks, as in a static HTML page), pass
`onAfterApply` to `init()` and re-run whatever wiring code attaches those
listeners, scoped to the returned elements:

```js
init({
  apiBase: '/api',
  onAfterApply: function (elements) {
    elements.forEach(function (el) {
      if (el.matches('.chip')) el.addEventListener('click', onChipClick);
    });
  }
});
```

React/Vue/Angular apps don't need this — their own reactivity re-binds
listeners on re-render (and framework pages typically go through the
[handoff flow](#saving-edits) rather than live DOM replacement anyway).

## Server Required

The editor needs a backend API with these endpoints:

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/edit` | Send HTML + instruction to AI, returns `{ html }`, `{ warn }`, or `{ warn, violations, html }` for a palette conflict |
| `GET` | `/api/design` | Returns `{ md, exists, palette }` — `palette` is the array of colors extracted from `DESIGN.md` |
| `POST` | `/api/save` | Applies `patches` surgically to a source file (falls back to writing `html` in full), with an automatic backup |
| `POST` | `/api/handoff` | Appends a change manifest to `.ai-editor/pending-changes.md` for framework pages an AI coding agent should apply |

### Setup (programmatic — recommended)

`express` and `dotenv` are already dependencies of this package — nothing extra to install.

```js
// start-ai-editor.js
const { startServer } = require('visual-ai-editor/server');
startServer({ port: 3000, envPath: require('path').join(__dirname, '.env') });
```

```bash
node start-ai-editor.js
```

`startServer(options)`:

| Option | Type | Default | Description |
|---|---|---|---|
| `port` | `number` | `process.env.PORT \|\| 3000` | Port to listen on |
| `envPath` | `string` | none | Path to a `.env` file to load (`AI_API_KEY`/`AI_ENDPOINT`/`AI_MODEL`, or legacy `GROQ_API_KEY`/`GROQ_MODEL`) |
| `designMdPath` | `string` | `<cwd>/DESIGN.md` | Where to read the design system reference from. Re-read automatically when the file's mtime changes — no server restart needed |
| `indexHtmlPath` | `string` | `<cwd>/index.html` | Fallback save target when `/api/save` isn't given a `page` |
| `staticDir` | `string` | `process.cwd()` | Directory served as static files. Narrow this to a `public/`-style folder in production instead of your whole project root |
| `apiToken` | `string` | none | If set, `/api/edit`, `/api/save` and `/api/handoff` require `Authorization: Bearer <token>` (or an `X-AI-Editor-Token` header). Pass the same value to the client via `init({ apiToken })` |
| `allowUnsafeProduction` | `boolean` | `false` | Bypasses the production safety check (see below) when you have auth at another layer (reverse proxy, VPN, etc.) |
| `silent` | `boolean` | `false` | If `true`, builds the Express app but doesn't call `.listen()` — returns `{ app, port }` so you can mount it yourself |
| `locale` | `'en' \| 'pt-BR'` | `'en'` | Language for server-generated messages (errors, warnings, logs) |
| `backup` | `boolean` | `true` | Write a timestamped backup to `.ai-editor/history/` before every save |
| `maxHtmlBytes` | `number` | `200000` | Reject `/api/edit` selections larger than this (413) before calling the AI provider |
| `ai` | `object` | see [Choosing an AI provider](#choosing-an-ai-provider) | `{ endpoint, model, apiKey, jsonMode, temperature }` |

### Setup (legacy — copy server.js)

Still supported for backward compatibility:

```bash
cp node_modules/visual-ai-editor/server/server.js ./server.js
cp node_modules/visual-ai-editor/server/.env.example ./.env
# Edit .env and set GROQ_API_KEY=your_key_here
node server.js
```

## Security & production

This tool is built for local development and internal/staging use — a designer or
developer editing their own project on their own machine. It is **not** hardened
to be exposed to the public internet as-is. Concretely:

- **`/api/edit` and `/api/save` are unauthenticated by default.** Anyone who can
  reach the server can burn through your Groq API quota via `/api/edit`, or
  overwrite `indexHtmlPath` via `/api/save`. Set `apiToken` (server) + pass the
  same value to `init({ apiToken })` (client) to require a bearer token on both
  endpoints. This is a shared-secret check, not real user authentication — it
  stops opportunistic/automated abuse, not a determined attacker who can read
  your page's source (the token is visible in the client bundle you serve). For
  real production protection, put this behind your own auth layer (session
  check, reverse-proxy auth, VPN) and treat `apiToken` as a second layer, not
  the only one.
- **The static file server defaults to serving your whole `process.cwd()`.**
  `.git/`, `node_modules/`, `.env*`, lockfiles, `.ssh/`, `.aws/`, and this
  tool's own `.ai-editor/` (save backups + handoff manifests, which may
  contain snippets of your source) are blocked outright. Everything else
  under `staticDir` is still served, because the editor needs to read/write
  your actual project files. In production, set `staticDir` to a narrow
  `public/` folder rather than your whole repo.
- **Save backups accumulate in `.ai-editor/history/`** (capped at the 100
  most recent per file). Add `.ai-editor/` to `.gitignore` — it's local
  working state, not something to commit.
- **`startServer()`/`buildApp()` refuse to start when `NODE_ENV=production` and
  no `apiToken` is set** — you'll get a thrown error explaining why, instead of
  a silently-exposed editor. Pass `allowUnsafeProduction: true` only if you've
  already solved authentication at another layer and understand the tradeoff.
- **The client-side toolbar has no visibility gate.** If you ship the `init()`
  call in your production bundle, every visitor sees and can use the editor
  UI (even if the backend correctly rejects their requests). Gate `init()`
  behind an environment check or an authenticated route in your own app —
  e.g. only call it when `process.env.NODE_ENV !== 'production'`, or behind
  a feature flag / admin-only route.

**Recommended pattern:** run this on a separate, non-public port/host during
development or in a staging environment gated by your own auth (e.g. behind a
VPN or an authenticated reverse proxy), with `apiToken` set as a second layer.
Don't wire it into your public production bundle.

## CSS Variables

The editor reads these CSS variables from your page:

```css
:root {
  --font: 'Inter', sans-serif;   /* Font family */
  --warning: #f4b400;            /* Warning color (yellow) */
  --lg: 16px;                    /* Toolbar left position */
}
```

## Features

- **Click selection** — click any element to select it
- **Area selection** — drag a rectangle to select multiple elements
- **Lasso selection** — draw freehand around elements
- **AI editing** — describe changes in natural language, any OpenAI-compatible provider
- **Design system enforcement** — the AI is instructed to follow `DESIGN.md`, backed by a deterministic server-side color-palette check that catches what the model misses
- **Force mode** — override design-system warnings; reuses the already-computed HTML, so it costs zero extra AI calls
- **Surgical saves** — patches your source file in place, preserving formatting, with an automatic pre-save backup
- **AI-agent handoff** — framework pages (React/Vue) export a change manifest instead of corrupting rendered output
- **Undo & redo** — Ctrl+Z / Ctrl+Y (client-side, zero tokens)
- **Multi-element editing** — select multiple elements and edit them together
- **DESIGN.md viewer** — view your design system reference in a modal
- **`design:lint`** — deterministic CLI check for off-palette colors across your whole project
- **English / Portuguese (pt-BR) UI** — auto-detected from `<html lang>`, or set explicitly

## File Structure

```
visual-ai-editor/
├── dist/
│   ├── ai-editor.js         (UMD — <script> tag)
│   ├── ai-editor.esm.js     (ES modules — import)
│   ├── ai-editor.min.js     (minified)
│   └── ai-editor.css        (styles)
├── src/
│   ├── index.js             (entry point)
│   ├── core.js              (state, utils, CSS-context collection, source detection)
│   ├── i18n.js               (client-side EN / pt-BR strings)
│   ├── tools.js             (selection tools)
│   ├── selection.js         (selection logic)
│   ├── actions.js           (AI, save, undo/redo)
│   └── ui.js                (UI creation, init/destroy)
├── server/
│   ├── index.js             (Express app — startServer/buildApp)
│   └── server.js            (legacy shim)
├── lib/
│   ├── design-tokens.js     (color extraction + palette validation)
│   ├── patch.js             (surgical source patching — exact + fuzzy match)
│   ├── design-check.js      (DESIGN.md discovery + section coverage)
│   ├── server-messages.js   (server-side EN / pt-BR strings)
│   └── agents-md.js         (AGENTS.md installer)
├── types/
│   ├── index.d.ts           (client types)
│   └── server.d.ts          (server types)
├── test/                    (node:test — `npm test`)
└── examples/
    ├── static.html
    ├── react.jsx
    ├── angular.ts
    └── vue.vue
```

## License

MIT
