# visual-ai-editor — Roadmap

## Visão Geral

Transformar o AI Editor (BMW M prototype) em um pacote npm instalável, framework-agnóstico, que funciona em HTML estático, React, Angular e Vue.

---

## Fase 1: Estrutura do Pacote

- [ ] 1.1 Criar pastas: `src/`, `dist/`, `styles/`, `server/`, `scripts/`, `examples/`
- [ ] 1.2 Criar `package.json` com exports ESM + UMD
- [ ] 1.3 Criar `scripts/build.js` (concat, UMD wrapper, cópia de CSS)

---

## Fase 2: Conversão para Módulos ES

- [ ] 2.1 `src/core.js` — Estado, utils, SVG constants, `describeEl`, `isEditorEl`, `px`
- [ ] 2.2 `src/tools.js` — `findElementsInRect`, `findElementsAtPoints`, `samplePath`, `walkElements`, `deduplicateElements`, `pointInPolygon`
- [ ] 2.3 `src/selection.js` — `selectElements`, `clearSelBoxes`, `updateSelectedBoxes`, `positionPanel`, `exitSelection`, `onClick`
- [ ] 2.4 `src/actions.js` — `applyWithAI`, `saveToFile`, `undoLast`, `showDesignModal`, `hideDesignModal`, `startRateLimitCountdown`
- [ ] 2.5 `src/ui.js` — `createUI`, `setTool`, `toggleMode`, `init(options)`, `destroy()`, event listeners

---

## Fase 3: Entry Point e Build

- [ ] 3.1 Criar `src/index.js` — importa todos os módulos, monta API pública, `export default AI`
- [ ] 3.2 Criar `scripts/build.js` — gera `dist/ai-editor.esm.js`, `dist/ai-editor.js` (UMD), `dist/ai-editor.min.js`
- [ ] 3.3 Rodar build pela primeira vez

---

## Fase 4: Server de Referência

- [ ] 4.1 Copiar `server.js` do BMW M para `server/server.js`
- [ ] 4.2 Criar `server/package.json` (express, dotenv)
- [ ] 4.3 Criar `server/.env.example`

---

## Fase 5: Exemplos

- [ ] 5.1 `examples/static.html` — HTML puro com `<script>` tag
- [ ] 5.2 `examples/react.jsx` — Componente React com useEffect
- [ ] 5.3 `examples/angular.ts` — Componente com OnInit/OnDestroy
- [ ] 5.4 `examples/vue.vue` — Componente com onMounted/onUnmounted

---

## Fase 6: Documentação

- [ ] 6.1 Criar `README.md` com instalação, uso, API, exemplos

---

## Fase 7: Validação

- [ ] 7.1 Testar `dist/ai-editor.esm.js` com import
- [ ] 7.2 Testar `dist/ai-editor.js` com `<script>` tag
- [ ] 7.3 Testar `AI.init()` + `AI.destroy()` cycle
- [ ] 7.4 Verificar que CSS injeta corretamente

---

## Estrutura Final

```
visual-ai-editor/
├── package.json
├── README.md
├── ROADMAP.md
├── src/
│   ├── index.js
│   ├── core.js
│   ├── tools.js
│   ├── selection.js
│   ├── actions.js
│   └── ui.js
├── dist/
│   ├── ai-editor.js       (UMD)
│   ├── ai-editor.min.js   (minificado)
│   ├── ai-editor.esm.js   (ESM)
│   └── ai-editor.css
├── styles/
│   └── ai-editor.css
├── scripts/
│   └── build.js
├── server/
│   ├── server.js
│   ├── package.json
│   └── .env.example
└── examples/
    ├── static.html
    ├── react.jsx
    ├── angular.ts
    └── vue.vue
```

## Arquivos de Referência (bmw-m/)

| Arquivo | Origem | Destino no pacote |
|---|---|---|
| `ai-editor-core.js` | BMW M | `src/core.js` |
| `ai-editor-tools.js` | BMW M | `src/tools.js` |
| `ai-editor-selection.js` | BMW M | `src/selection.js` |
| `ai-editor-actions.js` | BMW M | `src/actions.js` |
| `ai-editor.js` | BMW M | `src/ui.js` |
| `ai-editor.css` | BMW M | `styles/ai-editor.css` |
| `server.js` | BMW M | `server/server.js` |

## API Pública

```js
import AIEditor from 'visual-ai-editor';

// Lifecycle
AIEditor.init(options?)   // Cria UI, bind eventos
AIEditor.destroy()        // Remove tudo

// Seleção
AIEditor.setTool(tool)    // 'cursor' | 'area' | 'pencil'
AIEditor.selectElements(els)

// Opções de init()
{
  apiBase: '/api',        // Base URL dos endpoints (default: '/api')
  cssInject: true,        // Injeta CSS automaticamente
  cssUrl: '...',          // URL customizado do CSS
}
```

## Endpoints Necessários (server)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/edit` | Envia HTML + instrução para IA, retorna HTML editado |
| GET | `/api/design` | Retorna DESIGN.md como JSON `{ md: "..." }` |
| POST | `/api/save` | Salva HTML no servidor |
