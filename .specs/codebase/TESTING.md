# Testes

> Verificado rodando `npm test` em 2026-07-17: **40/40 passando**, ~0.6s de
> execução, sem side-effects residuais (`git status` limpo depois — o bug do
> `indexHtmlPath` que poluía a raiz do repo, descrito no ROADMAP.md, está
> corrigido e coberto por teste de regressão).

## O que existe

- [x] Unitários — `lib/design-tokens.js` (extração/normalização de cor,
  detecção de violação de paleta) e `lib/patch.js` (patch exato e
  fuzzy/whitespace-tolerant). Puros, sem I/O real além de string matching.
- [x] Integração — `test/server.test.js` sobe uma instância real do app
  Express (via `buildApp({ silent: true })`) e bate nos endpoints com
  `fetch`, usando diretórios temporários reais (`fs.mkdtempSync`) para
  `staticDir`/`designMdPath`/`indexHtmlPath` — não faz mock do Express nem
  do filesystem, só faz mock/stub do `fetch` para a chamada ao provedor de
  IA (Groq/Ollama/etc.), evitando rede real e custo de API.
- [x] Build/regressão de artefato — `test/build.test.js` executa os arquivos
  `dist/*.js` de fato gerados dentro de uma sandbox `node:vm` simulando um
  `<script>` tag de browser (sem `module`/`exports`/AMD), validando que o
  bundle publicado realmente funciona, não só que o source pré-build está
  correto.
- [ ] End-to-end — não existe. Nenhum teste dirige a UI real do navegador
  (seleção por clique, digitar instrução, aplicar edição, salvar). Ver
  ROADMAP.md, seção "Not started": "Live browser E2E test [...] Worth adding
  once the API surface stabilizes." Testado manualmente contra um projeto
  real (`../smartvia`) em sessões anteriores, mas isso não é automatizado
  nem repetível por CI.

## Comando de execução

```bash
npm test
# equivalente a: node --test test/*.test.js
```

Sem framework externo (nem Jest, Mocha, Vitest, Playwright) — usa só o
runner nativo `node:test` + `node:assert/strict`. Zero dependências de
teste no `package.json` (nem em `devDependencies`).

`npm run dev` (`node scripts/build.js --watch`) não é um comando de teste,
é o watcher de build — mencionado aqui só para não confundir com `npm test`.

## Coverage atual

40 testes em 4 arquivos:

| Arquivo | Nº testes | O que cobre |
|---|---|---|
| `test/build.test.js` | 4 | Os 3 arquivos `dist/*.js` gerados de fato funcionam num sandbox tipo-browser (marked embutido, `AIEditor` global, string literal `SVG_NS` sobrevive à minificação). Regressão direta do bug do minificador (v1.5.0). |
| `test/design-tokens.test.js` | 9 | `normalizeColor` (hex curto, rgb/rgba→hex, rejeição de lixo), `extractColors`, `extractPalette` (frontmatter + prosa do DESIGN.md), `findViolations` (flag de cor fora da paleta, não-flag de cor pré-existente, paleta vazia = sem enforcement), `lintContent` (números de linha). |
| `test/patch.test.js` | 5 | `applyPatch` exato, fuzzy (whitespace-tolerant após reformatação), ambíguo (aparece 2x → falha), não encontrado → falha; `applyPatches` (múltiplos patches, relatório de falha parcial). |
| `test/server.test.js` | 22 | Todos os 4 endpoints (`/api/design`, `/api/edit`, `/api/save`, `/api/handoff`): happy path, validação de campo obrigatório, tamanho excedido (413), API key ausente (500) vs. dispensada para endpoint local (Ollama/LM Studio, incluindo override explícito `requiresApiKey` nas duas direções), enforcement de paleta (com e sem `force`), patch cirúrgico + backup, fallback para HTML completo, path traversal em `page`, resolução de página multi-page, manifest de handoff, proteção por `apiToken` (inclusive confirmando que `/api/design` continua público), bloqueio de paths sensíveis pelo middleware estático, `indexHtmlPath` derivado corretamente de `staticDir` customizado (regressão do bug descrito no ROADMAP.md), e `buildApp` recusando subir em produção sem `apiToken`/`allowUnsafeProduction`. |

Nenhum teste usa rede real — chamadas ao provedor de IA são sempre via
`fetch` stubado/injetado no teste, o que os torna rápidos (~0.6s no total) e
determinísticos, mas também significa que **nenhum teste valida a integração
real contra Groq/OpenAI/Ollama** — essa verificação é manual (ver notas de
sessão no ROADMAP.md sobre testes ao vivo contra `../smartvia` e uma
instância real do Ollama).

## O que não tem cobertura

- **Código client-side inteiro (`src/*.js`)** — `core.js`, `tools.js`,
  `selection.js`, `actions.js`, `ui.js`, `i18n.js` não têm nenhum teste
  automatizado, unitário ou de integração. Isso inclui lógica não-trivial
  como: seleção por área/lasso, undo/redo, detecção de fonte
  (React fiber `_debugSource`, Vue `__file`), coleta de contexto CSS
  (`collectCssContext`), e toda a UI (criação de toolbar, painel, overlays).
  `test/build.test.js` só verifica que o *bundle* carrega e expõe os
  símbolos certos — não exercita o comportamento interno dessas funções.
  **Risco**: qualquer regressão de lógica de seleção/undo/DOM-swap só seria
  pega manualmente, em um browser real.
- **`lib/design-check.js`** (descoberta de DESIGN.md, contagem de seções) —
  sem arquivo de teste dedicado. Usado tanto pelo `postinstall.js` quanto
  pelo `bin/cli.js` (`design:check`, `design:init`, `design:lint`).
- **`lib/agents-md.js`** (instalador idempotente do AGENTS.md no projeto
  consumidor: criar vs. anexar vs. atualizar em uma seção marcada) — lógica
  de merge/idempotência não coberta por teste, apesar de mexer diretamente
  em arquivo do usuário durante `postinstall`.
- **`bin/cli.js`** (os 4 comandos: `design:check`, `design:init`,
  `design:lint`, `agents:init`) — nenhum teste de CLI invoca o binário nem
  testa `walkLintFiles`/`cmdDesignLint` isoladamente. `design:lint` reusa
  `lib/design-tokens.js` (que tem teste), mas a varredura de diretório e a
  saída formatada do CLI em si não têm teste.
- **`scripts/postinstall.js`** — sem teste; depende de comportamento
  best-effort (nunca falha a instalação) que só foi validado manualmente
  (`npm install` real em `../smartvia`, conforme ROADMAP.md).
- **Integração real com provedores de IA** — Groq, OpenAI, Ollama, LM Studio
  reais nunca são chamados em teste automatizado (por design, para
  determinismo/velocidade), só manualmente. Isso inclui o comportamento de
  fallback de `response_format: json_object` quando um provedor rejeita, e o
  parsing de resposta malformada de modelos locais pequenos (mencionado no
  README como limitação conhecida, não bug).
- **End-to-end de browser** — nenhum Playwright/Cypress/similar; fluxo
  completo clique→seleção→instrução→aplicar→salvar nunca é exercitado
  automaticamente (ver ROADMAP.md).
- **`server/server.js`** (shim legado) — não testado diretamente; só
  `server/index.js` (`buildApp`/`startServer`) tem cobertura via
  `server.test.js`.
