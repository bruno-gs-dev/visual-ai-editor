# Estrutura do Projeto

> Árvore de diretórios relevante (node_modules, .git ignorados), com anotações baseadas em leitura
> real dos arquivos (não suposição). Gerado em 2026-07-17 para a versão local 1.5.0.
> `.specs/codebase/` (este diretório) é gerado por esta tarefa de mapeamento.

```
visual-ai-editor/
├── package.json              # Nome "visual-ai-editor" v1.5.0. main=dist/ai-editor.js (UMD/CJS),
│                              #   module=dist/ai-editor.esm.js, types=types/index.d.ts.
│                              #   exports "." (cliente), "./server" (server/index.js),
│                              #   "./server.js" (shim legado), "./dist/ai-editor.css".
│                              #   bin: visual-ai-editor -> bin/cli.js.
│                              #   scripts: build, dev (--watch), postinstall, test.
│                              #   deps runtime: express, dotenv. devDeps: marked (build-time only).
├── package-lock.json
├── README.md                  # Doc principal: instalação, plug&play, escolha de provedor LLM
│                              #   (Groq/OpenAI/Ollama/LM Studio), DESIGN.md, salvamento (patches
│                              #   cirúrgicos vs handoff para frameworks), API completa client+
│                              #   server, segurança/produção, variáveis CSS, features, estrutura
│                              #   de arquivos (mantido ativamente — já cobre a maior parte do
│                              #   projeto).
├── CHANGELOG.md               # Changelog por versão (1.5.0, 1.4.0, ...) — detalha bugs corrigidos
│                              #   e features por release.
├── ROADMAP.md                 # Estado entre sessões de IA: o que foi publicado (1.4.0 no npm),
│                              #   o que está pronto localmente mas não publicado (1.5.0), passos
│                              #   restantes antes do release, ideias não iniciadas, e onde as
│                              #   coisas vivem (inclui referência a `../smartvia`, projeto irmão
│                              #   usado como banco de teste real, fora deste repo).
├── LICENSE                    # MIT
├── .gitignore
│
├── bin/
│   └── cli.js                 # CLI (`npx visual-ai-editor <comando>`). Comandos: design:check
│                              #   (relata cobertura das 11 seções do DESIGN.md), design:init
│                              #   (copia templates/design-md-prompt.md -> DESIGN.prompt.md),
│                              #   design:lint (varre CSS/HTML/JS do projeto consumidor em busca
│                              #   de cores fora da paleta do DESIGN.md; ignora node_modules/.git/
│                              #   dist/build/.next/.cache/coverage/.ai-editor, limite 5000
│                              #   arquivos), agents:init (instala/atualiza AGENTS.md manualmente,
│                              #   útil se postinstall foi bloqueado). Sem comando -> printUsage().
│
├── server/
│   ├── index.js               # Implementação real do backend Express (~555 linhas).
│                              #   Exporta startServer(options) / buildApp(options).
│                              #   - resolveProvider(): resolve endpoint/model/apiKey a partir de
│                              #     ai.provider ('ollama'|'lmstudio' presets), ai.endpoint, ou env
│                              #     vars (AI_ENDPOINT/AI_MODEL/AI_API_KEY, legado GROQ_*).
│                              #     isLocalEndpoint() detecta localhost/127.0.0.1/::1/0.0.0.0 para
│                              #     dispensar apiKey automaticamente (ai.requiresApiKey override).
│                              #   - designMdReader(): cache com invalidação por mtime do
│                              #     DESIGN.md; re-lê sem restart do servidor.
│                              #   - resolvePageFile(): resolve `page` (pathname do browser) para
│                              #     um arquivo dentro de staticDir, rejeitando path traversal.
│                              #   - backupFile(): copia o arquivo-alvo para
│                              #     staticDir/.ai-editor/history/ antes de sobrescrever, mantendo
│                              #     só os 100 mais recentes.
│                              #   - buildEditPrompts()/parseModelResponse()/callProvider():
│                              #     monta o prompt (system+user) para o LLM, injeta DESIGN.md e
│                              #     CSS relevante, exige resposta JSON {html} ou {warn}, com
│                              #     fallback para providers que rejeitam response_format.
│                              #   - Middleware SENSITIVE_PATH_RE bloqueia .git/.svn/.hg/
│                              #     .ai-editor/node_modules/.env*/.npmrc/lockfiles/.ssh/.aws
│                              #     independente de staticDir; OWN_DIST_ALLOW_RE reabre exceção
│                              #     para node_modules/visual-ai-editor/dist (bundle do próprio
│                              #     pacote precisa ficar acessível).
│                              #   - assertProductionSafe(): recusa iniciar com
│                              #     NODE_ENV=production sem apiToken, a menos que
│                              #     allowUnsafeProduction seja true.
│                              #   - Endpoints: POST /api/edit (chama o LLM, aplica enforcement
│                              #     determinístico de paleta via lib/design-tokens.js antes de
│                              #     aceitar a resposta), GET /api/design (retorna md/exists/
│                              #     palette), POST /api/save (aplica patches cirúrgicos via
│                              #     lib/patch.js, fallback para escrita completa), POST
│                              #     /api/handoff (acrescenta manifesto de mudanças a
│                              #     .ai-editor/pending-changes.md para páginas de framework).
│   ├── server.js               # Shim legado — apenas require('./index.js').startServer() para
│                              #   quem ainda copia server.js manualmente (compat retroativa).
│   └── .env.example            # Exemplo de .env: GROQ_API_KEY, PORT, GROQ_MODEL (nomes legados;
│                              #   README documenta os nomes novos AI_API_KEY/AI_ENDPOINT/AI_MODEL).
│
├── src/                        # Código-fonte do cliente (ES modules, concatenados por
│                              #   scripts/build.js na ordem: core, i18n, tools, selection,
│                              #   actions, ui, index — tudo compartilha o objeto global `AI`
│                              #   definido em core.js, cada módulo anexa métodos a ele).
│   ├── index.js                # Ponto de entrada (15 linhas): importa os demais módulos por
│                              #   efeito colateral (anexam a AI), injeta CSS embutido
│                              #   (placeholder __INJECT_CSS__ substituído pelo build), exporta
│                              #   AI como default e os atalhos init/destroy/setTool/
│                              #   selectElements nomeados.
│   ├── core.js                 # Estado global (objeto AI: elementos selecionados, ferramenta
│                              #   ativa, pilhas de undo/redo, patches, changes, opções de init),
│                              #   utilitários (px, describeEl, isEditorEl, authHeaders),
│                              #   getSourceInfo() (detecta origem do elemento: atributo
│                              #   data-ai-source, fiber._debugSource do React <=18, ou
│                              #   __vueParentComponent.type.__file do Vue 3 — usado para o
│                              #   handoff), collectCssContext() (varre document.styleSheets e
│                              #   coleta regras CSS que casam com os elementos selecionados/seus
│                              #   descendentes, até 8000 chars, para enviar ao LLM como contexto).
│   ├── i18n.js                  # Strings de UI em inglês/pt-BR (AI.I18N), resolução de locale
│                              #   (init option -> <html lang> -> 'en'), AI.t(key, params) com
│                              #   interpolação de placeholders {name}.
│   ├── tools.js                 # Lógica das ferramentas de seleção: lasso (updateLassoPath,
│                              #   lassoPoints), interseção de retângulos (rectsIntersect),
│                              #   travessia do DOM (walkElements), deduplicação de elementos
│                              #   aninhados (deduplicateElements), setTool/toggleMode (troca
│                              #   ferramenta ativa: cursor/area/pencil), handlers globais de
│                              #   scroll/resize/keydown (Ctrl+Z undo, Ctrl+Y/Ctrl+Shift+Z redo,
│                              #   Escape).
│   ├── selection.js             # Lógica de seleção visual: caixas de destaque
│                              #   (clearSelBoxes/updateSelectedBoxes), posicionamento do painel
│                              #   de instrução relativo aos elementos selecionados
│                              #   (positionPanel).
│   ├── actions.js               # Ações principais (maior arquivo do cliente, ~388 linhas):
│                              #   showDesignModal/hideDesignModal (busca GET /api/design e
│                              #   renderiza com `marked` se disponível, senão <pre>),
│                              #   startRateLimitCountdown (UI de espera em 429), _swapElements
│                              #   (troca elementos antigos por novos parseados do HTML retornado
│                              #   pela IA, checagem estrita de contagem de elementos), chamada a
│                              #   POST /api/edit (envia html+instruction+selector+css+force),
│                              #   fluxo de "force mode" (aplica localmente pendingForceHtml sem
│                              #   nova chamada à IA), saveToFile() (decide entre enviar patches
│                              #   cirúrgicos a /api/save ou manifesto a /api/handoff conforme
│                              #   getSourceInfo detectar framework), undo/redo.
│   └── ui.js                    # Construção da UI (toolbar flutuante, painel de instrução,
│                              #   overlays de desenho/lasso, modal do DESIGN.md, rótulos de
│                              #   seleção), AI.init()/AI.destroy() (monta/desmonta toda a UI e
│                              #   listeners), injeção de CSS (cssInject/cssUrl).
│
├── lib/                         # Módulos server-side/CLI compartilhados (CommonJS).
│   ├── design-tokens.js         # Extração e validação determinística de cores (não usa IA):
│                              #   extractColors/extractPalette (hex, rgb/rgba, hsl/hsla via
│                              #   regex, normalizados para forma canônica), findViolations
│                              #   (compara HTML de saída da IA contra a paleta do DESIGN.md +
│                              #   cores já presentes no HTML de entrada). Usado por
│                              #   server/index.js (checagem pós-edição) e bin/cli.js
│                              #   (design:lint).
│   ├── patch.js                 # Patching cirúrgico de arquivos-fonte: escapeRegExp,
│                              #   fuzzyPattern (constrói regex tolerante a espaços em branco a
│                              #   partir do outerHTML serializado, já que o DOM normaliza
│                              #   espaços de forma diferente do arquivo-fonte formatado),
│                              #   applyPatches(source, patches) tenta casamento exato primeiro,
│                              #   depois fuzzy; reporta falha se 0 ou >1 ocorrências forem
│                              #   encontradas (ambiguidade). Usado por POST /api/save.
│   ├── design-check.js          # Descoberta de DESIGN.md no projeto consumidor (findDesignMd,
│                              #   ignora node_modules/.git/dist/build/.next/.cache/coverage) e
│                              #   checklist de cobertura das 11 seções recomendadas (overview,
│                              #   principles, colors, typography, spacing, elevation, layout,
│                              #   components, accessibility, ai-rules, prompts) via regex
│                              #   temática (não exige heading literal, aceita PT/EN).
│                              #   formatReport() gera o texto impresso por `design:check`. Usado
│                              #   por bin/cli.js e scripts/postinstall.js.
│   ├── server-messages.js       # Strings de mensagens do servidor (erros, avisos, logs) em
│                              #   inglês/pt-BR — msg(locale)(key, params) com interpolação.
│                              #   Espelha o padrão de src/i18n.js, mas do lado do servidor.
│   └── agents-md.js             # Instalador do AGENTS.md no projeto consumidor: copia
│                              #   docs/AGENTS.md deste pacote; se já existir um AGENTS.md no
│                              #   consumidor, acrescenta o bloco delimitado por
│                              #   <!-- visual-ai-editor:start/end --> (ou atualiza in-place se o
│                              #   bloco já existir e estiver desatualizado), preservando todo
│                              #   conteúdo escrito pelo usuário fora do bloco. Usado por
│                              #   scripts/postinstall.js e `bin/cli.js agents:init`.
│
├── scripts/
│   ├── build.js                 # Script de build (zero dependências externas de bundling):
│                              #   embute o UMD do `marked` lido de node_modules (build-time),
│                              #   copia styles/ai-editor.css para dist/, concatena os módulos de
│                              #   src/ removendo import/export via regex para gerar o bundle ESM
│                              #   (dist/ai-editor.esm.js) e o bundle UMD (dist/ai-editor.js,
│                              #   wrapper AMD/CommonJS/global manual), gera módulos de CSS
│                              #   standalone (dist/ai-editor.css.js, dist/ai-editor.css.umd.js),
│                              #   e minifica com basicMinify() — um minificador regex artesanal
│                              #   com cuidado explícito para não tratar "://" dentro de strings
│                              #   como início de comentário (bug real corrigido na v1.5.0) ->
│                              #   dist/ai-editor.min.js. Suporta --watch (não lido neste trecho,
│                              #   mas referenciado pelo script "dev" do package.json).
│   └── postinstall.js           # Roda automaticamente no `npm install` do projeto CONSUMIDOR
│                              #   (pula a si mesmo quando INIT_CWD aponta para este próprio
│                              #   repo). Instala/atualiza AGENTS.md via lib/agents-md.js e avisa
│                              #   (sem falhar o install) se DESIGN.md estiver ausente. Tudo em
│                              #   try/catch — nunca aborta a instalação do consumidor.
│
├── dist/                        # Artefatos gerados por `npm run build` — NÃO editar à mão.
│   ├── ai-editor.js             # Bundle UMD (uso via <script src>, expõe window.AIEditor).
│   ├── ai-editor.esm.js         # Bundle ES modules (uso via import).
│   ├── ai-editor.min.js         # Bundle UMD minificado.
│   ├── ai-editor.css            # CSS puro (fallback <link>).
│   ├── ai-editor.css.js         # CSS embutido como módulo ESM (export default string).
│   └── ai-editor.css.umd.js     # CSS embutido como módulo UMD (AIEditor.css = "...").
│
├── styles/
│   └── ai-editor.css            # Fonte do CSS do editor (toolbar, painel, overlays, modal) —
│                              #   é a partir daqui que scripts/build.js gera todas as variantes
│                              #   em dist/. Lê variáveis CSS do host (--font, --warning, --lg).
│
├── templates/
│   └── design-md-prompt.md      # Template copiado para DESIGN.prompt.md pelo comando
│                              #   `design:init` — prompt guiado (entrevista + estrutura de 11
│                              #   seções + checklist de validação) para um agente de IA gerar o
│                              #   DESIGN.md do projeto consumidor, seguindo a metodologia
│                              #   descrita em camaraux.com.br/como-criar-aplicar-design-md-ia.
│
├── docs/
│   └── AGENTS.md                # Documento fonte instalado no projeto consumidor (via
│                              #   postinstall/agents-md.js) explicando a um agente de IA como o
│                              #   editor funciona: contrato da API, DESIGN.md, force mode,
│                              #   patches cirúrgicos vs handoff, troubleshooting. É o mesmo
│                              #   conteúdo entregue como AGENTS.md em qualquer projeto que
│                              #   instale este pacote.
│
├── examples/                    # Exemplos de integração por framework (não executados por
│                              #   testes, apenas referência para consumidores).
│   ├── static.html              # Integração via <script>/<link> puro.
│   ├── react.jsx                 # Integração via useEffect (init/destroy no mount/unmount).
│   ├── angular.ts                # Integração via ngOnInit/ngOnDestroy.
│   └── vue.vue                   # Integração via onMounted/onUnmounted (Composition API).
│
├── test/                        # Testes automatizados (`node --test test/*.test.js`, sem
│                              #   framework externo).
│   ├── build.test.js            # Regressão do pipeline de build: confirma que o `marked`
│                              #   embutido funciona como global em contexto sandboxed (node:vm,
│                              #   simulando <script> sem module/exports/AMD) e que o
│                              #   minificador não corrompe strings com "://" (ex.: SVG_NS).
│                              #   4 testes adicionados na v1.5.0.
│   ├── design-tokens.test.js    # Testa extractPalette/findViolations de lib/design-tokens.js
│                              #   (normalização de cores, detecção de violação de paleta).
│   ├── patch.test.js             # Testa applyPatches de lib/patch.js (casamento exato, fuzzy,
│                              #   falha por ambiguidade/ausência).
│   └── server.test.js            # Maior suíte (460 linhas): testa buildApp()/startServer() via
│                              #   Express real com requisições simuladas — endpoints /api/edit,
│                              #   /api/save, /api/handoff, /api/design; autenticação por
│                              #   apiToken; resolveProvider (presets ollama/lmstudio,
│                              #   requiresApiKey auto-detect e override); segurança de path
│                              #   (SENSITIVE_PATH_RE); indexHtmlPath derivado de staticDir
│                              #   (regressão da v1.5.0); assertProductionSafe.
│
├── types/
│   ├── index.d.ts               # Tipos do pacote cliente: SelectionTool, InitOptions,
│                              #   AIEditorAPI (init/destroy/setTool/selectElements).
│   └── server.d.ts              # Tipos do pacote server: AIProviderOptions (provider/endpoint/
│                              #   model/apiKey/requiresApiKey/jsonMode/temperature),
│                              #   ServerOptions (todas as opções de startServer/buildApp),
│                              #   StartServerResult. app/server tipados como `any`
│                              #   deliberadamente para não exigir @types/express do consumidor.
│
└── .specs/
    └── codebase/                 # Este diretório — mapeamento gerado (STACK.md, STRUCTURE.md).
```

## Observações de arquitetura (confirmadas por leitura do código)

- **Padrão de módulo do cliente**: todos os arquivos em `src/` (exceto `index.js`) anexam métodos
  a um único objeto mutável `AI` exportado por `core.js` — não há classes nem módulos isolados em
  runtime; a divisão em arquivos é só organizacional e some após `scripts/build.js` concatenar
  tudo.
- **`AI` (cliente) e o backend Express são desacoplados por HTTP** — o cliente nunca importa nada
  do servidor; toda comunicação é via os 4 endpoints REST documentados em `docs/AGENTS.md` e no
  README.
- **`lib/` é a camada mais reutilizada**: `design-tokens.js` e `patch.js` são usados tanto pelo
  servidor (`server/index.js`) quanto pela CLI (`bin/cli.js`) — são os módulos mais testados
  (según ROADMAP.md, "os dois módulos mais testados e mais críticos da 1.4.0").
- **i18n duplicado propositalmente**: `src/i18n.js` (strings de UI do navegador) e
  `lib/server-messages.js` (strings de erro/log do servidor) são independentes um do outro, cada
  um com seu próprio dicionário en/pt-BR — não há um pacote de i18n compartilhado.
