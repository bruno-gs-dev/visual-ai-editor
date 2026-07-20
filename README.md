<div align="center">

# visual-ai-editor

**AI-powered visual HTML editor.**

Select any element on the page, describe what you want to change in natural language, and the AI rewrites it — following your design system.

[![npm version](https://img.shields.io/npm/v/visual-ai-editor?color=4f46e5&label=version)](https://www.npmjs.com/package/visual-ai-editor)
[![license](https://img.shields.io/npm/l/visual-ai-editor)](LICENSE)

[Demo](#demo) · [Install](#install) · [Quick Start](#quick-start) · [Frameworks](#usage-by-framework) · [Design System](#design-system) · [API](#api-reference)

</div>

---

## Demo

[`demo/`](demo/) is a runnable page — a fictional analytics landing page with its own
[`DESIGN.md`](demo/DESIGN.md). It exists so you can see the design-system enforcement do
something real: the page uses a 17-color palette, and the demo doc documents it, so an
off-palette request gets blocked by the server rather than by the model's good intentions.

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

The browser opens with the toolbar on the left. Three things worth trying, in order:

**1. Edit an element.** Pick **Select**, click one of the feature cards, type
`add a warning badge saying Beta`, press **Apply**. The card re-renders in place using the
`.badge.highlight` class from the demo's design system — the AI reused it because
`DESIGN.md` was in its system prompt. Hit **Save** and the change lands in
`demo/index.html` as a small diff, with the original copied to `.ai-editor/history/` first.

**2. Hit the palette guard.** Select anything and ask for
`change the background to pink`. Pink isn't in the demo's palette, so the server rejects
the response and shows a warning with an **Apply anyway** button. That button reuses the
HTML the model already returned — overriding costs zero extra tokens.

**3. Select more than one thing.** **Area selection** drags a rectangle over the four
metric tiles; **Pencil** lassoes freehand around a group. With several elements selected,
`make these use the secondary button style` rewrites all of them in one request.

`Ctrl+Z` undoes any of it instantly and without an API call.

The demo folder also gives the design commands something real to report on:

```
$ npx visual-ai-editor design:lint
[visual-ai-editor] Paleta detectada (17 cores): #6366f1, #0b0f19, #131a2a, ...
[visual-ai-editor] Verificando 1 arquivo(s)...

Nenhuma cor fora da paleta encontrada. ✓

$ npx visual-ai-editor design:check
[visual-ai-editor] DESIGN.md encontrado em: .../demo/DESIGN.md

  ✓ Visão Geral          ✓ Layout e Grid
  ✓ Princípios de Design ✓ Componentes
  ✓ Paleta de Cores      ✓ Acessibilidade
  ✓ Tipografia           ✓ Regras Específicas para IA
  ✓ Espaçamentos         ✓ Exemplos de Prompts
  ✓ Bordas, Raios e Sombras

Cobertura completa — todas as 11 seções recomendadas foram encontradas.
```

(Two columns here for space — the CLI prints one section per line.)

> CLI output is currently Portuguese-only; the in-browser UI follows `<html lang>`
> (`en` / `pt-BR`). The demo page is `lang="en"`, so its toolbar is in English.

---

## Features

| Feature | Description |
|---------|-------------|
| 🎯 **Visual selection** | Click, drag-to-select area, or draw a freehand lasso around elements |
| 🤖 **AI-powered edits** | Describe changes in natural language — any OpenAI-compatible provider works |
| 🎨 **Design system enforcement** | AI follows your `DESIGN.md` — deterministic palette check catches what the model misses |
| 💾 **Surgical saves** | Patches your source file in-place with 1-line diffs; auto-backup before every save |
| ⌨️ **Undo / Redo** | `Ctrl+Z` / `Ctrl+Y` — zero tokens, instant |
| 🌐 **Framework-agnostic** | Works with static HTML, React, Angular, Vue, or any framework |
| 🌍 **EN / pt-BR UI** | Auto-detected from `<html lang>`, or set explicitly |
| 📋 **DESIGN.md viewer** | View your design system reference in a modal inside the editor |

---

## Install

```bash
npm install visual-ai-editor
```

That's it — `express`, `dotenv`, and markdown rendering are bundled. Nothing else to install.

---

## Quick Start

### 1. Start the editor

```bash
npx visual-ai-editor start
```

First run creates a `.env` file in your project root.

### 2. Add your API key

Open `.env` and paste your key:

```
AI_API_KEY=gsk_your_key_here
```

Any OpenAI-compatible provider works. The fastest way to try it:

| Provider | How to get a key | Default endpoint |
|----------|------------------|------------------|
| **Groq** (free tier) | [console.groq.com](https://console.groq.com) | Built-in |
| **OpenAI** | [platform.openai.com](https://platform.openai.com) | `https://api.openai.com/v1/chat/completions` |
| **Ollama** (local) | [ollama.com](https://ollama.com) | `http://localhost:11434/v1/chat/completions` |
| **LM Studio** (local) | [lmstudio.ai](https://lmstudio.ai) | `http://localhost:1234/v1/chat/completions` |

> Local providers (Ollama, LM Studio) don't need an API key — the server detects `localhost` endpoints automatically.

### 3. Run again

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

### AGENTS.md, delivered on install

On `npm install`, the package writes an `AGENTS.md` to your project root — a guide that
explains this tool to any AI coding agent (Claude Code, Cursor, …): the API contract, how
`DESIGN.md` enforcement works, force mode, and troubleshooting. If you already have an
`AGENTS.md`, only our own block is appended (and updated in place on later upgrades) —
**your existing content is never touched.** If your npm setup blocks install scripts, run
`npx visual-ai-editor agents:init` to get the same result.

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
import 'visual-ai-editor/dist/ai-editor.css';

@Component({
  selector: 'app-root',
  template: '<router-outlet></router-outlet>'
})
export class AppComponent implements OnInit, OnDestroy {
  ngOnInit() {
    AIEditor.init({ apiBase: '/api' });
  }

  ngOnDestroy() {
    AIEditor.destroy();
  }
}
```

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
| `POST` | `/api/edit` | Send HTML + instruction → AI returns `{ html }` or `{ warn }` |
| `GET` | `/api/design` | Returns `{ md, exists, palette }` |
| `POST` | `/api/save` | Apply patches surgically to source file |
| `POST` | `/api/handoff` | Append change manifest for framework pages |

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

## License

[MIT](LICENSE)
