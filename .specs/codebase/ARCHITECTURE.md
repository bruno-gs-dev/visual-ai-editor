# Arquitetura do Sistema

> Gerado a partir de leitura direta do código em 2026-07-17. `package.json` local
> declara versão **1.5.0**; o README/ROADMAP confirmam que **1.4.0** é a versão
> publicada no npm e **1.5.0** está pronta localmente mas ainda não commitada/
> publicada (ver "Divergências" no final deste documento).

## Visão geral

`visual-ai-editor` é um editor visual de HTML assistido por IA, distribuído
como pacote npm com duas metades que rodam em processos/contextos diferentes:

- **Client** (`src/`, empacotado em `dist/`): injetado na página alvo (via
  `<script>` UMD ou `import` ESM). Desenha uma toolbar flutuante e ferramentas
  de seleção (cursor/área/lasso) diretamente no DOM da página do consumidor.
  Não depende de nenhum framework — funciona em HTML estático, React, Vue ou
  Angular por igual, manipulando o DOM diretamente (`el.replaceWith(...)`).
- **Server** (`server/`): uma aplicação Express que o próprio consumidor
  inicia em processo (`startServer()`), servindo os arquivos estáticos do
  projeto e expondo 4 endpoints (`/api/edit`, `/api/design`, `/api/save`,
  `/api/handoff`) que fazem a ponte entre o client e o provedor de LLM, e entre
  o client e o(s) arquivo(s)-fonte do projeto.

Os dois lados só se falam por HTTP (`fetch` no client → Express no server);
não há estado compartilhado em memória nem import direto entre `src/` e
`server/`. Isso é o que permite o client rodar embutido em qualquer bundle de
frontend enquanto o server roda como um processo Node separado (tipicamente
`node start-ai-editor.js`, na raiz do projeto consumidor).

## Módulos / camadas

### `src/` — client (injetado na página)

Arquivo de entrada `src/index.js`, que importa (e concatena, no build) os
demais módulos nesta ordem: `core.js → i18n.js → tools.js → selection.js →
actions.js → ui.js`. Todo o estado é um único objeto global mutável `AI`
(definido em `core.js`), estendido por cada módulo subsequente — não é uma
classe, é literalmente um objeto compartilhado por referência entre arquivos.

- **`core.js`** — o estado do editor (`AI.selectedEls`, `AI.undoStack`,
  `AI.patches`, `AI.changes`, opções de `init()`, etc.), utilitários (`px`,
  `describeEl`, `isEditorEl`), detecção de código-fonte (`getSourceInfo` — lê
  fiber do React `_debugSource`, `__vueParentComponent.type.__file` do Vue 3,
  ou atributo manual `data-ai-source`) e coleta de contexto CSS
  (`collectCssContext`, varre `document.styleSheets` same-origin por regras
  que casam com a seleção, até 8000 caracteres).
- **`i18n.js`** — strings EN / pt-BR do lado cliente; `AI.t(key, vars)`.
- **`tools.js`** — lógica das 3 ferramentas de seleção: clique (`onClick` em
  `selection.js`), arrasto de área (`onMouseDown/Move/Up` com um `<rect>` SVG)
  e lasso livre (mesmo fluxo com um `<path>` SVG e teste ponto-em-polígono).
  Também tem `findElementsInRect`/`findElementsAtPoints` + deduplicação
  (remove elementos cujo ancestral já foi selecionado).
- **`selection.js`** — aplica a seleção: cria as caixas visuais
  (`.ai-sel-box`), posiciona o painel de instrução, abre/fecha o painel
  (`exitSelection`), trata clique único (`onClick`).
- **`actions.js`** — o núcleo funcional: `applyWithAI()` (chama `/api/edit`,
  trata `warn`/force mode/rate limit 429), `_commitEdit()` (troca os elementos
  no DOM via `_swapElements`, empilha undo, acumula `patches`/`changes`),
  `saveToFile()` (decide entre `/api/save` — patches cirúrgicos — e
  `/api/handoff` — manifesto para agente de IA — conforme
  `getSourceInfo` detectou origem de framework em algum change), `undoLast()`/
  `redoLast()` (client-side puro, zero chamadas de rede), e o modal do
  DESIGN.md (`showDesignModal`, usa `marked` se disponível).
- **`ui.js`** — construção do DOM da UI (toolbar, painel, overlay do
  DESIGN.md), `AI.init(options)`/`AI.destroy()` (ciclo de vida público),
  injeção/remoção de CSS (`_injectCSS`/`_removeCSS` — prefere CSS embutido via
  `AI.css`, cai para um `<link>` externo), bind de listeners globais
  (scroll/resize/mousemove/mousedown/mouseup/click/keydown — atalhos Ctrl+Z/
  Ctrl+Y/Escape).

`src/index.js` também injeta `__EMBEDDED_CSS__` (placeholder substituído pelo
build) e exporta `init`, `destroy`, `setTool`, `selectElements` como named
exports além do default `AI`.

### `server/` — backend Express

- **`server/index.js`** — implementação real. Exporta `startServer(options)` e
  `buildApp(options)`. Responsável por: checagem de segurança em produção
  (`assertProductionSafe` — recusa subir com `NODE_ENV=production` sem
  `apiToken` nem `allowUnsafeProduction`), resolução do provedor de IA
  (`resolveProvider` — presets `ollama`/`lmstudio`, env vars, fallback legado
  Groq), leitura com cache de `DESIGN.md` por mtime (`designMdReader`),
  bloqueio de paths sensíveis (`SENSITIVE_PATH_RE`) com exceção explícita para
  o próprio `dist/` do pacote (`OWN_DIST_ALLOW_RE`), resolução segura de
  página multi-arquivo (`resolvePageFile` — rejeita path traversal), backup
  automático antes de salvar (`backupFile`, até 100 arquivos em
  `.ai-editor/history/`), e os 4 handlers de rota.
- **`server/server.js`** — shim legado (`require('./index.js').startServer()`)
  para quem ainda roda `node node_modules/visual-ai-editor/server/server.js`
  copiado manualmente (fluxo anterior ao `startServer()` programático).
- **`server/.env.example`** — só documenta as variáveis legadas
  (`GROQ_API_KEY`, `PORT`, `GROQ_MODEL`) — não foi atualizado para as novas
  `AI_ENDPOINT`/`AI_MODEL`/`AI_API_KEY` (ver Divergências).

### `lib/` — lógica compartilhada, usada pelo server e pelo CLI

- **`lib/design-tokens.js`** — extração e normalização determinística de
  cores (hex/rgb/rgba/hsl) de qualquer texto; `extractPalette(md)` trata
  qualquer cor mencionada em `DESIGN.md` (frontmatter, prosa, code fences)
  como "permitida"; `findViolations(outputHtml, inputHtml, palette)` é o que
  o server chama após cada `/api/edit` bem-sucedido para sinalizar cores que a
  IA introduziu e que não estavam nem na paleta nem no HTML original;
  `lintContent` dá suporte ao `design:lint` da CLI.
- **`lib/patch.js`** — patch cirúrgico de código-fonte: `applyPatch` tenta
  substring exato primeiro (falha se ambíguo — mais de uma ocorrência),
  depois um regex "tolerante a espaço em branco" (`fuzzyPattern` — todo run de
  whitespace vira `\s+`, bordas de tag `< > =` ganham `\s*` extra para tolerar
  reformatação por prettier/etc). `applyPatches` aplica uma lista sequencial e
  reporta falhas por índice.
- **`lib/design-check.js`** — descoberta de `DESIGN.md` no projeto consumidor
  (via `rg --files` se disponível, senão uma busca manual em árvore limitada a
  profundidade 6, ignorando `node_modules`/`.git`/etc.) e checagem heurística
  de cobertura das 11 seções recomendadas (regex por tópico, não por heading
  literal — tolera PT/EN e variação de nível de heading).
- **`lib/server-messages.js`** — strings EN / pt-BR do lado servidor
  (`t(key, vars)`, `resolveLocale`), usadas em toda resposta/log de
  `server/index.js`.
- **`lib/agents-md.js`** — instalador idempotente de `docs/AGENTS.md` no
  projeto consumidor: cria se não existir, adiciona o bloco delimitado
  (`<!-- visual-ai-editor:start/end -->`) se o arquivo já existir sem o bloco,
  ou substitui apenas o bloco em upgrades — nunca toca no conteúdo que o
  usuário escreveu ao redor.

### `bin/` — CLI

`bin/cli.js` (bin `visual-ai-editor`) expõe 4 comandos:
`design:check`, `design:init` (gera `DESIGN.prompt.md` a partir de
`templates/design-md-prompt.md`), `design:lint` (varre o projeto por cores
fora da paleta, extensões `.css/.html/.htm/.js/.jsx/.ts/.tsx/.vue/.svelte`,
até 5000 arquivos) e `agents:init` (chama `lib/agents-md.js` manualmente, para
quem bloqueia scripts de instalação).

### `scripts/` — build e ciclo de vida do pacote

- **`scripts/build.js`** — zero dependências externas (só stdlib Node). Lê o
  UMD do `marked` de `node_modules/marked` e o embute como uma instrução
  top-level independente (IIFE auto-executável) antes do próprio bundle, nos
  três artefatos (`ai-editor.esm.js`, `.js`, `.min.js`). Concatena `src/*.js`
  na ordem `ESM_ORDER`, removendo `import`/`export` (duas funções distintas:
  `stripImports` para ESM, `stripImportsExports` para UMD). Gera também
  `ai-editor.css` (cópia direta), `ai-editor.css.js`/`ai-editor.css.umd.js`
  (CSS como string embutida, para consumidores de `<script>` avulso). Um
  minificador regex "básico" roda só sobre o código próprio (nunca sobre o
  `marked`, que já vem minificado) — tem uma lookbehind negativo para não
  tratar `://` dentro de strings como início de comentário (bug real corrigido
  na 1.5.0, ver CHANGELOG).
- **`scripts/postinstall.js`** — roda no `npm install` do consumidor (nunca
  falha o install; todo erro é engolido com `console.warn`). Pula
  completamente se detecta que está rodando dentro do próprio repo do pacote.
  Instala/atualiza `AGENTS.md` e avisa (não bloqueia) se não encontrar
  `DESIGN.md`.

### `templates/`, `types/`, `test/`, `examples/`, `styles/`, `docs/`

- `templates/design-md-prompt.md` — prompt guiado (entrevista + estrutura de
  11 seções) usado por `design:init`.
- `types/index.d.ts` / `types/server.d.ts` — tipos TypeScript para os dois
  entry points (`visual-ai-editor` e `visual-ai-editor/server`).
- `test/*.test.js` — `node:test` (`npm test`), cobre extração de tokens,
  matching de patch, build (embedding do `marked` + regressão do minificador)
  e todos os endpoints do servidor.
- `examples/` — snippets de integração por framework (static/react/angular/
  vue), refletem a seção "Quick Start" do README.
- `styles/ai-editor.css` — fonte da CSS (o build copia/embute a partir daqui).
- `docs/AGENTS.md` — o conteúdo entregue ao projeto consumidor via
  `lib/agents-md.js`; documenta a API e o funcionamento interno para um
  agente de IA que for mexer no projeto consumidor.

## Fluxo de dados

Fluxo completo de uma edição, do clique do usuário até o arquivo em disco:

1. **Seleção no DOM (client)** — usuário escolhe uma ferramenta
   (`AI.setTool`), clica/arrasta/desenha sobre a página; `tools.js` resolve
   quais elementos caíram na seleção (`findElementsInRect` /
   `findElementsAtPoints` + deduplicação por contenção); `selection.js`
   (`selectElements`) desenha as caixas e abre o painel de instrução.
2. **Composição do request** — usuário digita a instrução e clica "Aplicar"
   (`AI.applyWithAI` em `actions.js`). O client serializa o(s) elemento(s)
   selecionado(s) (`outerHTML`, ou um wrapper `<div data-ai-multi>` se for
   seleção múltipla), coleta CSS relevante (`collectCssContext`), e detecta a
   origem no código-fonte (`getSourceInfo` — fiber do React / `__file` do Vue
   / atributo manual).
3. **`POST /api/edit`** (`{ html, instruction, selector, css, force }`) →
   `server/index.js`. O servidor:
   - valida presença dos campos e tamanho (`maxHtmlBytes`, 413 se excede);
   - resolve o provedor de IA (`resolveProvider` — endpoint/model/apiKey);
   - recusa com 500 se o provedor exige API key e nenhuma foi configurada;
   - monta o prompt (`buildEditPrompts` — injeta `DESIGN.md` inteiro se
     existir, o CSS coletado, e a instrução de force mode se `force: true`);
   - chama o provedor (`callProvider` — `fetch` HTTP puro para o endpoint
     configurado, com retry sem `response_format: json_object` se o provedor
     rejeitar esse parâmetro);
   - trata 429 (rate limit) extraindo `retryAfter` da mensagem de erro ou do
     header, devolvendo isso ao client para ele mostrar um countdown;
   - faz o parse estruturado da resposta (`parseModelResponse` — espera JSON
     `{"html": ...}` ou `{"warn": ...}`, com fallbacks para respostas
     malformadas/legadas);
   - se não houve `warn` do próprio modelo e não é force mode, roda a
     checagem determinística de paleta (`tokens.findViolations`) — se achar
     cor fora da paleta, devolve `{ warn, violations, html }` (o `html` já
     computado, para o "aplicar mesmo assim" não custar uma segunda chamada
     de IA);
   - devolve `{ html }` no caminho feliz.
4. **Resposta no client** — se veio `warn`, mostra o aviso com botão "forçar"
   (que reaplica localmente o `html` já computado, sem nova requisição, ou
   reenvia com `force: true` se não havia `html` anexado). Se veio `html`,
   `_commitEdit` troca os elementos antigos pelos novos no DOM
   (`_swapElements`, via `replaceWith`), empilha a entrada de undo, acumula
   o patch (`{ before, after }`) em `AI.patches` e o change (com
   `source`/`selector`/`instruction`/before/after) em `AI.changes`.
5. **Undo/redo** — puramente client-side (`undoLast`/`redoLast`), sem
   nenhuma chamada de rede; apenas re-troca elementos no DOM e ajusta as
   pilhas `patches`/`changes`.
6. **Persistência (`saveToFile`)** — ao clicar "Salvar": se nenhum `change`
   registrado tem `source` (nenhum framework detectado), o client serializa a
   página inteira (removendo os próprios elementos de UI do editor) e envia
   `POST /api/save` com `{ html, page: location.pathname, patches }`. O
   servidor resolve o arquivo alvo dentro de `staticDir`
   (`resolvePageFile`, rejeitando path traversal), faz backup
   (`backupFile` → `.ai-editor/history/`), e tenta aplicar cada patch via
   `lib/patch.js` (`applyPatches` — exato, depois fuzzy); se todos aplicarem,
   responde `mode: 'patch'`; se algum falhar e um `html` de fallback foi
   enviado, escreve o snapshot completo (`mode: 'full'`); se nenhum patch
   aplicar e não há fallback, responde 409 com os patches que falharam.
   Se **algum** change tiver `source` (framework detectado), o client em vez
   disso envia `POST /api/handoff` com a lista de changes; o servidor
   anexa cada um como uma entrada Markdown em
   `<staticDir>/.ai-editor/pending-changes.md`, para um agente de IA aplicar
   manualmente ao código-fonte real (JSX/template).
7. **`GET /api/design`** — usado pelo modal "ver DESIGN.md" do client
   (`showDesignModal`, renderiza com `marked` se disponível) e por
   `design:lint`/`design:check` da CLI (que leem o arquivo diretamente do
   disco em vez de bater no servidor).

## Pontos de integração externos

- **Qualquer API de chat-completions compatível com OpenAI** — Groq
  (padrão), OpenAI, OpenRouter, Ollama, LM Studio, ou qualquer outro endpoint
  que aceite o mesmo contrato `{ model, messages, temperature,
  response_format }`. Toda a comunicação é um único `fetch` HTTP feito pelo
  server (`callProvider` em `server/index.js`) — não há SDK de provedor
  nenhum embutido. Ver `INTEGRATIONS.md` para detalhes de autenticação e
  comportamento em falha.
- **`marked`** (biblioteca de markdown) — não é uma integração em runtime
  externa; é embutida como um bundle UMD no build (`scripts/build.js`),
  vira uma dependência puramente de build (`devDependencies`), e o client só
  usa o global que ela expõe (`typeof marked !== 'undefined'`).
- **`smartvia`** (projeto consumidor externo, `../smartvia`) — instala
  `visual-ai-editor` via npm (`^1.5.0` no `package.json` dele) e o inicializa
  com `startServer()` (server) + `init({ apiBase: '/api' })` (client), exatamente
  como qualquer outro consumidor documentado no README. Não é um monorepo:
  são dois diretórios de projeto separados, sem link simbólico nem workspace
  compartilhado — a sincronização entre eles hoje é manual (copiar
  `node_modules/visual-ai-editor` ou publicar+reinstalar). Ver
  `INTEGRATIONS.md` para mais detalhes; o mapeamento profundo de `smartvia`
  está fora do escopo deste documento.

## Divergências observadas entre a documentação e o código

- `package.json` local já está em **1.5.0**; ROADMAP.md confirma que essa
  versão está "done in this session, not yet released" — ainda não commitada
  nem publicada no npm (que serve 1.4.0). CHANGELOG.md já documenta a 1.5.0
  como se estivesse lançada — está descrevendo trabalho local ainda não
  publicado, não uma divergência de comportamento.
- `server/.env.example` só lista as variáveis legadas
  (`GROQ_API_KEY`/`PORT`/`GROQ_MODEL`) — o README e o código (`resolveProvider`
  em `server/index.js`) já suportam `AI_ENDPOINT`/`AI_MODEL`/`AI_API_KEY` como
  forma preferencial desde a 1.4.0, mas o arquivo de exemplo não foi
  atualizado para refletir isso.
- O `node_modules/visual-ai-editor` dentro de `smartvia` já reporta versão
  `1.5.0` — ou seja, o projeto consumidor já está rodando a build local não
  publicada (sincronizada manualmente), consistente com o passo descrito no
  ROADMAP ("manually sync node_modules/visual-ai-editor there for a faster
  inner loop before publishing").
