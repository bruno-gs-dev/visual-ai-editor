# visual-ai-editor

AI-powered visual HTML editor. Select any element on the page, describe what you want to change, and the AI modifies it following your design system.

Works everywhere: static HTML, React, Angular, Vue, or any framework.

## Install

```bash
npm install visual-ai-editor
```

Peer dependency (optional, for DESIGN.md rendering):
```bash
npm install marked
```

## Plug & play (recommended)

No more copying `server.js`, wiring `<link>`/`<script>` tags by hand, or juggling `express`/`dotenv` as separate installs — both now ship as real dependencies of this package.

**1. Create `start-ai-editor.js`** in your project root:

```js
const { startServer } = require('visual-ai-editor/server');

startServer({
  port: 3000,
  envPath: require('path').join(__dirname, '.env') // GROQ_API_KEY=...
});
```

**2. Add one line to your HTML** (before `</body>`):

```html
<script type="module">
  import { init } from './node_modules/visual-ai-editor/dist/ai-editor.esm.js';
  init({ apiBase: '/api' });
</script>
```

**3. Create `.env`** with your key (free at console.groq.com):

```
GROQ_API_KEY=your_key_here
```

**4. Run:**

```bash
node start-ai-editor.js
```

That's it — the CSS is embedded in the bundle and injected automatically (no relative paths to break), and the backend runs in-process, serving your project's static files plus the `/api/*` endpoints.

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
```

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
| `cssInject` | `boolean` | `true` | Auto-inject CSS into `<head>` |
| `cssUrl` | `string` | `'dist/ai-editor.css'` | Custom CSS URL when injecting |

### `AIEditor.destroy()`

Removes all editor UI, event listeners, and cleans up state. Call this on component unmount.

### `AIEditor.setTool(tool)`

Switches the active selection tool.

- `'cursor'` — click to select single elements
- `'area'` — drag to select elements by rectangle
- `'pencil'` — draw freehand lasso to select elements

### `AIEditor.selectElements(elements)`

Programmatically select an array of DOM elements.

## Server Required

The editor needs a backend API with these endpoints:

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/edit` | Send HTML + instruction to AI, returns edited HTML |
| `GET` | `/api/design` | Returns DESIGN.md as `{ md: "..." }` |
| `POST` | `/api/save` | Saves HTML to the server |

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
| `envPath` | `string` | none | Path to a `.env` file to load (`GROQ_API_KEY`, `GROQ_MODEL`) |
| `designMdPath` | `string` | `<cwd>/DESIGN.md` | Where to read the design system reference from |
| `indexHtmlPath` | `string` | `<cwd>/index.html` | Where `/api/save` writes the edited HTML |
| `silent` | `boolean` | `false` | If `true`, builds the Express app but doesn't call `.listen()` — returns `{ app, port }` so you can mount it yourself |

### Setup (legacy — copy server.js)

Still supported for backward compatibility:

```bash
cp node_modules/visual-ai-editor/server/server.js ./server.js
cp node_modules/visual-ai-editor/server/.env.example ./.env
# Edit .env and set GROQ_API_KEY=your_key_here
node server.js
```

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
- **AI editing** — describe changes in natural language
- **Design system enforcement** — AI warns when changes conflict with DESIGN.md
- **Force mode** — override design system warnings
- **Undo** — Ctrl+Z to undo AI changes (client-side, zero tokens)
- **Multi-element editing** — select multiple elements and edit them together
- **DESIGN.md viewer** — view your design system reference in a modal

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
│   ├── core.js              (state, utils)
│   ├── tools.js             (selection tools)
│   ├── selection.js         (selection logic)
│   ├── actions.js           (AI, save, undo)
│   └── ui.js                (UI creation, init/destroy)
├── server/
│   ├── server.js            (Express + Groq API)
│   ├── package.json
│   └── .env.example
└── examples/
    ├── static.html
    ├── react.jsx
    ├── angular.ts
    └── vue.vue
```

## License

MIT
