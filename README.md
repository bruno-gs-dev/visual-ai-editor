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

## Quick Start

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

### Setup

```bash
# Copy server files to your project
cp node_modules/visual-ai-editor/server/server.js ./server.js
cp node_modules/visual-ai-editor/server/.env.example ./.env

# Install server dependencies
npm install express dotenv

# Add your Groq API key (free at console.groq.com)
# Edit .env and set GROQ_API_KEY=your_key_here

# Start server
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
