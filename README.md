<div align="center">

# Visual AI Editor

**Edit existing HTML with AI using natural language.**

Select any element, describe the change, and let AI update your code while respecting your Design System.

[![npm version](https://img.shields.io/npm/v/visual-ai-editor?color=4f46e5&label=version)](https://www.npmjs.com/package/visual-ai-editor)
[![license](https://img.shields.io/npm/l/visual-ai-editor)](LICENSE)

[Demo](#demo) · [Install](#installation) · [Quick Start](#quick-start) · [Providers](#ai-providers) · [Frameworks](#usage-by-framework) · [Design System](#design-system) · [API](#api-reference) · [Security](#security)

</div>

---

## Installation

```bash
npm install visual-ai-editor
```

Or your preferred package manager:

```bash
pnpm add visual-ai-editor
# or
yarn add visual-ai-editor
```

That's it — `express`, `dotenv`, and markdown rendering are bundled. Nothing else to install.

---

## Demo

Both recordings below are the real editor driven against [`demo/`](demo/) — real
selections, real `/api/edit` round-trips, real responses. Only the cursor is drawn in,
because a browser recording can't capture the OS pointer.

### Edit an element

Pick **Select**, click the hero heading, type `make the heading color indigo`, press **Apply**.

![Selecting the heading and changing its color to indigo with a natural-language instruction](https://raw.githubusercontent.com/bruno-gs-dev/visual-ai-editor/main/docs/gifs/basic-edit.gif)

The heading re-renders in indigo using the `--primary` token from the demo's design
system — the AI reused it because [`DESIGN.md`](demo/DESIGN.md) was in its system prompt,
not because the instruction mentioned it. Hit **Save** and the change lands in
`demo/index.html` as a small diff, with the original copied to `.ai-editor/history/` first.

### Hit the palette guard

Same flow, but ask for `change the background to pink`.

![The server rejecting an off-palette color and offering Apply anyway](https://raw.githubusercontent.com/bruno-gs-dev/visual-ai-editor/main/docs/gifs/design-warning.gif)

Pink isn't in the demo's 17-color palette, so the **server** rejects the response — not the
model's good intentions. The **Apply anyway** button reuses the HTML the model already
returned, so overriding costs zero extra tokens.

### Run it yourself

```bash
git clone https://github.com/bruno-gs-dev/visual-ai-editor
cd visual-ai-editor/demo
npx visual-ai-editor start
```

First run writes a `.env` — paste an API key into `AI_API_KEY=` and run it again.
(Already installed the package? The demo ships in the tarball too:
`cd node_modules/visual-ai-editor/demo`.)

```
[ai-editor] DESIGN.md loaded (6784 characters, 17 palette colors).
[ai-editor] server at http://localhost:3000
[visual-ai-editor] Editor no ar: http://localhost:3000
[visual-ai-editor] Toolbar injetada automaticamente em qualquer .html servido.
```

One more thing worth trying that the GIFs don't cover: **Area selection** drags a rectangle
over the four metric tiles, and **Pencil** lassoes freehand around a group. With several
elements selected, `make these use the secondary button style` rewrites all of them in one
request. `Ctrl+Z` undoes any of it instantly and without an API call.

> CLI output is currently Portuguese-only; the in-browser UI follows `<html lang>`
> (`en` / `pt-BR`). The demo page is `lang="en"`, so its toolbar is in English.

---

## Why Visual AI Editor?

Most AI coding tools generate code from scratch.

Visual AI Editor takes a different approach.

Instead of rewriting an entire page, you simply select an existing HTML element and describe the change you want. The editor sends only the necessary context to the AI, validates the generated output, and applies the modification while preserving your project's structure and Design System.

---

## What You Can Do

- Edit existing HTML visually
- Modify interfaces using natural language
- Follow your Design System automatically
- Choose your preferred AI provider
- Review generated changes before applying
- Iterate faster on existing projects

**Supported providers:** OpenAI · Claude · Gemini · Groq

---

## Quick Start

### 1. Start the editor

```bash
npx visual-ai-editor start
```

First run opens the Settings panel — configure your AI provider there.

### 2. Run again

```bash
npx visual-ai-editor start
```

The server boots, the browser opens, and the editor toolbar is **auto-injected** into every `.html` page. No script tags to add, no start scripts to write.

### CLI flags

| Flag | Description |
|------|-------------|
| `--port <n>` | Port to listen on (default: `3000`) |
| `--no-inject` | Serve without auto-injecting the client |
| `--no-open` | Don't open the browser automatically |

### CLI commands

| Command | Description |
|---------|-------------|
| `start` (default) | Boot the editor in the current directory |
| `design:init` | Write `DESIGN.prompt.md` — a guided prompt for creating your `DESIGN.md` |
| `design:check` | Report which of the 11 recommended `DESIGN.md` sections exist |
| `design:lint` | Find off-palette colors across the project's CSS/HTML/JS |
| `agents:init` | Install or update `AGENTS.md` (normally done automatically on install) |

---

## Your First Edit

1. Select any HTML element.
2. Describe the change in natural language.
3. Review the generated result.
4. Apply the modification.

Example:

> "Increase the button padding and use the primary color."

The editor updates only the selected element while keeping the surrounding code untouched.

---

## Features

| Feature | Description |
|---------|-------------|
| **Visual selection** | Click, drag-to-select area, or draw a freehand lasso around elements |
| **AI-powered edits** | Describe changes in natural language — any OpenAI-compatible provider works |
| **Design system enforcement** | AI follows your `DESIGN.md` — deterministic palette check catches what the model misses |
| **Surgical saves** | Patches your source file in-place with 1-line diffs; auto-backup before every save |
| **AI-agent handoff** | React/Vue pages export a change manifest instead of overwriting rendered output |
| **Undo / Redo** | `Ctrl+Z` / `Ctrl+Y` — zero tokens, instant |
| **Framework-agnostic** | Works with static HTML, React, Angular, Vue, or any framework |
| **EN / pt-BR UI** | Auto-detected from `<html lang>`, or set explicitly |
| **DESIGN.md viewer** | View your design system reference in a modal inside the editor |

---

## Usage by Framework

### HTML (static pages)

The zero-config CLI handles everything — just run `npx visual-ai-editor start` and the toolbar appears automatically.

If you prefer manual wiring, add this before `</body>`:

```html
<script type="module">
  import { init } from '/__ai-editor/ai-editor.esm.js';
  init({ apiBase: '/api' });
</script>
```

Or via UMD (no module):

```html
<script src="node_modules/visual-ai-editor/dist/ai-editor.js"></script>
<script>
  AIEditor.init({ apiBase: '/api' });
</script>
```

---

### React

```jsx
import { useEffect } from 'react';
import AIEditor from 'visual-ai-editor';
import 'visual-ai-editor/dist/ai-editor.css';

export function AIEditorProvider({ children }) {
  useEffect(() => {
    AIEditor.init({ apiBase: '/api' });
    return () => AIEditor.destroy();
  }, []);

  return <>{children}</>;
}
```

Wrap your app:

```jsx
function App() {
  return (
    <AIEditorProvider>
      <YourApp />
    </AIEditorProvider>
  );
}
```

---

### Angular

```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';
import AIEditor from 'visual-ai-editor';

@Component({
  selector: 'app-root',
  template: '<router-outlet></router-outlet>'
})
export class AppComponent implements OnInit, OnDestroy {
  ngOnInit() {
    if (!environment.production) {
      AIEditor.init({ apiBase: 'http://localhost:3000' });
    }
  }
  ngOnDestroy() {
    AIEditor.destroy();
  }
}
```

That's it — no proxy needed, no extra config. The editor server (v1.7.0+)
accepts cross-origin requests from `localhost:*` automatically, so calling
`init({ apiBase: 'http://localhost:3000' })` from `ng serve` (`:4200`) just
works. Use environment guards to keep the editor out of production builds.

> **Source mapping (optional):** Without a build plugin, Save targets
> `index.html` (the SPA shell), not your `.component.html` files. Install
> `@ai-editor/angular-plugin` ([see below](#angular-build-plugin)) to
> auto-inject `data-ai-source` attributes during `ng serve`, enabling
> the same agent-handoff flow as React and Vue.
>
> **Change detection:** `replaceWith` bypasses Angular's view engine.
> Elements with `{{interpolation}}`, `*ngIf`, or `[binding]` may break on
> the next CD cycle. The editor works best on structural/style markup.

#### Angular build plugin (optional)

For source mapping — install `@ai-editor/angular-plugin` and swap the
builders in `angular.json`:

```json
"build":  { "builder": "@ai-editor/angular-plugin:browser", ... },
"serve":  { "builder": "@ai-editor/angular-plugin:dev-server", ... }
```

During `ng serve`, every template element gets
`data-ai-source="component.ts:line"`, enabling the same agent-handoff
save flow as React and Vue.

---

### Vue

```vue
<script setup>
import { onMounted, onUnmounted } from 'vue';
import AIEditor from 'visual-ai-editor';
import 'visual-ai-editor/dist/ai-editor.css';

onMounted(() => AIEditor.init({ apiBase: '/api' }));
onUnmounted(() => AIEditor.destroy());
</script>

<template>
  <router-view />
</template>
```

---

## AI Providers

Any OpenAI-compatible chat-completions API works. Configure it three ways, in order of
precedence: the `ai` option to `startServer()`, then environment variables, then the
built-in default (Groq, `llama-3.3-70b-versatile`).

**Via `.env`** — no code changes:

```
AI_ENDPOINT=https://api.openai.com/v1/chat/completions
AI_MODEL=gpt-4o-mini
AI_API_KEY=sk-...
```

**Via code:**

```js
startServer({
  ai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    apiKey: process.env.OPENAI_API_KEY
  }
});
```

### Local models (Ollama, LM Studio)

Local providers have a shorthand, so you don't type the endpoint URL:

```js
startServer({ ai: { provider: 'ollama', model: 'llama3.2' } });   // pull it first
startServer({ ai: { provider: 'lmstudio', model: 'your-loaded-model' } });
```

`'ollama'` resolves to `http://localhost:11434/v1/chat/completions`, `'lmstudio'` to
`http://localhost:1234/v1/chat/completions`. An explicit `endpoint` always wins over the
preset. No API key is required — there's nothing to authenticate against on localhost, and
the server auto-detects this from the endpoint's host for any `localhost`/`127.0.0.1` URL,
preset or not. Override it either direction with `requiresApiKey: true | false`.

### Legacy environment variables

`GROQ_API_KEY` and `GROQ_MODEL` are still honored as a fallback, so setups from earlier
versions keep working — there's no need to rename anything.

---

## Design System

`DESIGN.md` keeps the AI on-brand. It documents your colors, typography, spacing, components, and rules — and the AI is instructed to follow it on every edit.

### Create your DESIGN.md

```bash
npx visual-ai-editor design:init
```

This writes a `DESIGN.prompt.md` — a guided interview you feed to any AI agent (Claude Code, Cursor, etc.) to generate your `DESIGN.md`.

### Check coverage

```bash
npx visual-ai-editor design:check
```

Reports which of the 11 recommended sections exist in your `DESIGN.md`.

### Lint off-palette colors

```bash
npx visual-ai-editor design:lint
```

Scans your CSS/HTML/JS for colors that aren't in `DESIGN.md`'s palette.

### How enforcement works

1. **AI-side:** `DESIGN.md` content is injected into the LLM's system prompt on every edit
2. **Server-side:** Every response is checked against the palette — if a color isn't in `DESIGN.md`, the edit is rejected with a warning (the computed HTML is attached so "Apply anyway" costs zero extra AI calls)
3. **Force mode:** Click "Apply anyway" to override — reuses the already-computed HTML, no second API call

Try it end-to-end in [`demo/`](demo/) — see [Demo](#demo) above.

---

## Saving Edits

**Save** does one of two very different things, depending on the page.

### Static / server-rendered HTML — surgical patches

The client sends `{ before, after }` pairs of exactly the HTML that changed to
`/api/save`, which locates that text in your source file and replaces just it:

- Formatting, comments and indentation everywhere else are untouched.
- Git diffs stay small — one line changed, not the whole file.
- A timestamped backup goes to `.ai-editor/history/` before every save (capped at the 100
  most recent per file; `.ai-editor/` belongs in `.gitignore`).
- **If a patch's `before` text can't be located** — you hand-edited the file since the
  last save, for example — that save falls back to writing the full page snapshot. The
  status bar tells you which mode was used, so a silent full-file overwrite never
  surprises you.
- Multi-page projects: the browser's `location.pathname` is sent automatically as `page`,
  and the server resolves it to a file inside `staticDir`, rejecting any path that escapes it.

### Framework pages (React / Vue / Angular) — agent handoff

Writing rendered DOM back over JSX or a template would corrupt it, so nothing is written
to your source. Instead the edit is appended to `.ai-editor/pending-changes.md` via
`/api/handoff` — one entry per edit, with the detected source location, your instruction,
and the before/after HTML.

**This means clicking Save on a React page does not change your `.jsx`.** Open that
manifest with an AI coding agent (Claude Code, Cursor, …), ask it to apply the listed
changes to the real source, and delete each entry as it lands.

The source location comes from React's `_debugSource` fiber data, Vue 3's `__file`
metadata, or a `data-ai-source="path/to/File.tsx:42"` attribute when available.

For **Angular**, install `@ai-editor/angular-plugin` (see [Angular
section](#angular) above) to auto-inject `data-ai-source` during `ng serve`.
Without it, Save targets `index.html` (the SPA shell).

### Event listeners after an edit

Applying an AI edit (and redo) replaces the element via `el.replaceWith(newEl)`, which
**drops any listener attached directly to the old element with `addEventListener`**. The
element still looks right and simply stops responding — no console error.

Frameworks re-bind on re-render, so React/Vue/Angular apps don't need to care (and
framework pages go through the handoff flow above anyway). Plain `<script>` wiring on a
static page does. Re-run it in `onAfterApply`, scoped to the returned elements:

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

`onAfterUndo` is the same hook for the undo path.

---

## Advanced Notes

<details>
<summary><strong>Small local models</strong></summary>

Smaller local models (for example 3B models) may struggle with complex UI modifications due to limited context and reasoning capabilities.

The plumbing (no-auth requests, error propagation, structured-JSON parsing) works regardless of model size. Response *quality* doesn't. A capable model — Groq's 70B, GPT-4o-mini, or a comparable local model your hardware can run — reliably follows the full instruction set (`DESIGN.md` compliance, force mode, the `{html}`/`{warn}` JSON contract).

For the best experience, use models capable of handling larger contexts.

</details>

<details>
<summary><strong>AGENTS.md, delivered on install</strong></summary>

On `npm install`, the package writes an `AGENTS.md` to `.ai-editor/` — a guide that
explains this tool to any AI coding agent (Claude Code, Cursor, …): the API contract, how
`DESIGN.md` enforcement works, force mode, and troubleshooting. If you already have an
`AGENTS.md`, only our own block is appended (and updated in place on later upgrades) —
**your existing content is never touched.** If your npm setup blocks install scripts, run
`npx visual-ai-editor agents:init` to get the same result.

</details>

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Select element | `Click` |
| Select area | `Drag` |
| Lasso select | `Draw freehand` |
| Undo | `Ctrl+Z` |
| Redo | `Ctrl+Y` |

---

## API Reference

### Client (`visual-ai-editor`)

```js
import AIEditor from 'visual-ai-editor';

AIEditor.init(options?);
AIEditor.destroy();
AIEditor.setTool(tool);        // 'cursor' | 'area' | 'pencil'
AIEditor.selectElements(els);  // programmatically select DOM elements
```

**`init()` options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiBase` | `string` | `'/api'` | Backend API base URL |
| `apiToken` | `string` | — | Bearer token for authenticated endpoints |
| `cssInject` | `boolean` | `true` | Auto-inject CSS into `<head>` |
| `cssUrl` | `string` | `'dist/ai-editor.css'` | Custom CSS URL when injecting |
| `locale` | `'en' \| 'pt-BR'` | auto | UI language |
| `maxHtmlSize` | `number` | `60000` | Reject selections larger than this (chars) |
| `onAfterApply` | `(elements) => void` | — | Callback after AI edit replaces elements |
| `onAfterUndo` | `(elements) => void` | — | Callback after undo restores elements |

---

### Server (`visual-ai-editor/server`)

```js
const { startServer } = require('visual-ai-editor/server');

startServer({
  port: 3000,
  envPath: require('path').join(__dirname, '.env'),
  inject: true  // auto-inject client into served HTML
});
```

**`startServer()` options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | `number` | `3000` | Port to listen on |
| `envPath` | `string` | — | Path to `.env` file |
| `inject` | `boolean` | `false` | Auto-inject editor into served `.html` pages |
| `staticDir` | `string` | `cwd` | Directory to serve as static files |
| `designMdPath` | `string` | `cwd/DESIGN.md` | Design system reference path |
| `indexHtmlPath` | `string` | `cwd/index.html` | Fallback save target |
| `apiToken` | `string` | — | Require bearer token on write endpoints |
| `allowUnsafeProduction` | `boolean` | `false` | Bypass the `NODE_ENV=production` safety check |
| `silent` | `boolean` | `false` | Build the app without calling `.listen()` — returns `{ app, port }` to mount yourself |
| `maxHtmlBytes` | `number` | `200000` | Reject `/api/edit` selections larger than this (413) before calling the provider |
| `backup` | `boolean` | `true` | Write timestamped backup before saves |
| `locale` | `'en' \| 'pt-BR'` | `'en'` | Server message language |
| `ai` | `object` | — | `{ endpoint, model, apiKey, jsonMode, temperature }` |

**Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/edit` | Send HTML + instruction → `{ html }`, `{ warn }`, or `{ warn, violations, html }` on a palette conflict |
| `GET` | `/api/design` | Returns `{ md, exists, palette }` — `palette` is the colors extracted from `DESIGN.md` |
| `POST` | `/api/save` | Applies `patches` surgically to the source file, falling back to writing `html` in full |
| `POST` | `/api/handoff` | Appends a change manifest to `.ai-editor/pending-changes.md` for framework pages |

### CSS variables

The editor's own UI reads three variables from your page, each with a fallback — set them
to match your product's look, or ignore them entirely:

```css
:root {
  --font: 'Inter', sans-serif;   /* Font family for the toolbar and panel */
  --warning: #f4b400;            /* Color of the design-system warning state */
  --lg: 16px;                    /* Toolbar distance from the left edge */
}
```

---

## Security

This is a **development/staging tool** by default:

- The API is unauthenticated unless you set `apiToken`
- The static server serves your project directory (`.git`, `node_modules`, `.env*` are blocked)
- Save backups accumulate in `.ai-editor/history/` — add it to `.gitignore`

For production, put this behind your own auth layer (reverse proxy, VPN) and set `apiToken` as a second layer.

Two behaviors worth knowing before you deploy anything:

**The server refuses to start in production without a token.** With `NODE_ENV=production`
and no `apiToken`, `startServer()`/`buildApp()` throw an explanatory error rather than
silently exposing an editor. If you've already solved authentication at another layer,
pass `allowUnsafeProduction: true` to opt out deliberately.

**The client toolbar has no visibility gate.** If the `init()` call ships in your
production bundle, every visitor sees and can use the editor UI — even when the backend
correctly rejects their requests. Gate `init()` yourself: an environment check
(`process.env.NODE_ENV !== 'production'`), a feature flag, or an admin-only route.

---

## Contributing

Contributions are welcome.

If you have suggestions, bug reports, or improvements, feel free to open an Issue or submit a Pull Request.

---

## License

[MIT](LICENSE)

---

## Support the Project

If Visual AI Editor helps you, consider giving the repository a star.

It helps the project reach more developers and supports future development.
