# Convenções de Código

> Gerado por leitura do código real em 2026-07-17 (`v1.5.0` local, `1.4.0` publicado no npm).
> Este arquivo documenta o que **já existe**, não o que deveria existir.

## Nomenclatura

- **Arquivos**: `kebab-case` em `lib/` e `test/` (`design-tokens.js`, `server-messages.js`,
  `design-tokens.test.js`), nomes curtos e diretos em `src/` (`core.js`, `ui.js`, `tools.js`).
  Um teste por módulo-fonte quando fizer sentido (`patch.js` → `patch.test.js`), mas nem todo
  módulo tem teste dedicado (ver TESTING.md).
- **Variáveis/funções**: `camelCase` em todo o código JS (client, server, lib, scripts, bin).
  Sem TypeScript no runtime — só `var`/`function` estilo ES5-ish mesmo em código novo
  (compatibilidade com o bundling manual em `scripts/build.js`, que faz strip de
  `import`/`export` via regex, não um transpiler real).
- **Namespace do client**: tudo pendurado no objeto único `AI` (definido em `src/core.js`,
  exportado como default). Métodos e estado do editor inteiro vivem em `AI.*`
  (`AI.selectedEls`, `AI.init`, `AI.describeEl`, etc.) — não há classes, é um singleton
  literal de objeto.
- **Constantes**: `UPPER_SNAKE_CASE` para valores fixos no topo de módulo
  (`DEFAULT_ENDPOINT`, `MAX_HISTORY_FILES`, `SENSITIVE_PATH_RE`, `PROVIDER_PRESETS`,
  `LINT_EXTENSIONS`).
- **IDs de DOM**: prefixo `ai-` (`#ai-toolbar`, `#ai-editor-panel`, `#ai-design-overlay`,
  `#ai-draw-overlay`, `#ai-selection-label`) — usado tanto para estilização quanto para a
  checagem `AI.isEditorEl()` que evita que o próprio editor se auto-selecione.
- **Chaves de i18n**: `namespace.chave-com-hifen` (ex.: `t('edit.no-api-key')`,
  `t('save.write-error', { error })`, `t('auth.invalid')`) — mesma convenção nos dois
  arquivos de i18n (`src/i18n.js` client, `lib/server-messages.js` server), independentes
  um do outro (não compartilham chaves nem arquivo).
- **Testes**: nome descritivo em inglês, frase completa que descreve o comportamento
  esperado (`'applyPatch: ambiguous match (appears twice) fails'`,
  `'POST /api/edit still requires an apiKey for a remote endpoint even with ai.provider unset'`).
  Não há `describe()` — só `test()` do módulo nativo `node:test`, um arquivo = um
  agrupamento lógico.

## Estrutura de pastas

```
src/       cliente (browser) — bundlado por scripts/build.js em dist/. ESM-like
           (import/export) mas roda por um bundler caseiro que faz strip de
           sintaxe ESM via regex, não um bundler real (webpack/rollup/esbuild).
server/    entry-point programático do backend (index.js: startServer/buildApp)
           + server.js (shim legado para quem copiava o arquivo manualmente).
lib/       módulos Node puros, sem estado de servidor — reutilizados por
           server/index.js E por bin/cli.js (design-tokens.js, patch.js,
           design-check.js, server-messages.js, agents-md.js). CommonJS puro
           (module.exports = {...}), sem import/export ESM.
bin/       CLI (`npx visual-ai-editor <comando>`), CommonJS, shebang node.
scripts/   build.js (gera dist/) e postinstall.js (hook de npm install) — nunca
           publicados como entry point, só rodam via npm scripts.
templates/ arquivos-modelo copiados/gerados para o projeto consumidor
           (design-md-prompt.md → vira DESIGN.prompt.md via `design:init`).
test/      node:test puro (`node --test test/*.test.js`), sem framework externo
           (sem jest/mocha/vitest). Um arquivo por área: build, design-tokens,
           patch, server.
types/     .d.ts hand-written (não gerado por tsc) para os dois entry points
           públicos (index.d.ts client, server.d.ts server).
docs/      conteúdo entregue ao projeto consumidor via postinstall
           (AGENTS.md — guia para agentes de IA lerem sobre a própria
           ferramenta).
examples/  snippets de integração por framework (static.html, react.jsx,
           angular.ts, vue.vue) — não são testados automaticamente, são
           documentação executável para o README.
dist/      gerado, não editado à mão — 6 arquivos de saída do build (ver
           seção "Padrões de build"). Versionado no git (está no .files do
           package.json, ou seja, é publicado no pacote npm).
styles/    CSS fonte (ai-editor.css) — copiado/embutido em dist/ pelo build,
           nunca importado direto pelo cliente final.
```

Separação de responsabilidade chave: `lib/` é a camada compartilhada entre
`server/` (runtime Express) e `bin/` (CLI standalone) — qualquer lógica que
precise rodar nos dois contextos (extração de paleta, patch de arquivo,
descoberta de DESIGN.md) vive lá, não duplicada.

## Padrões de API

- **Formato de resposta**: sempre JSON via `res.json({...})`. Sucesso não tem
  envelope fixo — cada endpoint retorna o shape que faz sentido para ele
  (`{ html }`, `{ warn }`, `{ warn, violations, html }`, `{ md, exists, palette }`,
  `{ ok: true, path, count }`). Erro é sempre `{ error: string }` com um
  `res.status(code)` explícito (400/401/404/409/413/429/500) — nunca 200 com
  erro embutido no corpo.
- **Autenticação**: bearer token opcional (`apiToken` no server, `apiToken` no
  client `init()`). Header aceito é `Authorization: Bearer <token>` OU
  `X-AI-Editor-Token: <token>` (fallback). Middleware `requireApiToken()` só
  ativa a checagem se `token` foi configurado — sem token configurado, os
  endpoints ficam abertos (comportamento default documentado no README como
  risco de segurança, não bug). Aplicado seletivamente: protege
  `/api/edit`, `/api/save`, `/api/handoff` (escrita), mas **não**
  `/api/design` (leitura, sempre público).
- **Versionamento**: nenhum versionamento de rota (`/api/v1/...`) — apenas
  `/api/edit`, `/api/design`, `/api/save`, `/api/handoff`, fixo. Mudanças de
  contrato são tratadas via CHANGELOG/semver do pacote npm, não da URL.
- **i18n na API**: mensagens de erro/aviso passam por `t(key, params)`
  (`lib/server-messages.js`), respeitando `locale: 'en' | 'pt-BR'` passado a
  `startServer()`. Chaves de erro nunca são strings hardcoded na rota.
- **Rate limit / erros upstream**: erros 429 do provedor de IA são repassados
  como 429 com `retryAfter`, não abafados como 500 genérico.
- **Paths sensíveis**: qualquer requisição de arquivo estático que bata em
  `SENSITIVE_PATH_RE` (`.git`, `.env*`, `node_modules`, lockfiles, `.ssh`,
  `.aws`, `.ai-editor`) retorna 404, com uma exceção explícita para o próprio
  `dist/` do pacote dentro de `node_modules/visual-ai-editor/dist/`.

## Padrões de build

`scripts/build.js` é zero-dependency (só `fs`/`path` do Node), sem bundler de
mercado. Pipeline:

1. **Lê `marked.umd.js`** de `node_modules/marked/lib/` (devDependency) e
   embute o texto bruto, verbatim, como um statement top-level independente —
   nunca passa pelo strip de import/export nem pelo minificador (ver por quê
   abaixo).
2. **Copia CSS** (`styles/ai-editor.css` → `dist/ai-editor.css`) e gera uma
   versão escapada como template literal para injeção automática (`__EMBEDDED_CSS__`).
3. **Bundle ESM** (`dist/ai-editor.esm.js`): concatena `src/*.js` numa ordem
   fixa (`ESM_ORDER = ['core.js','i18n.js','tools.js','selection.js','actions.js','ui.js']`)
   + `index.js`, removendo apenas as linhas `import ... from '...'` via regex
   (`stripImports`) — mantém `export`.
4. **Bundle UMD** (`dist/ai-editor.js`): mesma concatenação, mas
   `stripImportsExports` também remove `export default`/`export var`/
   `export function`/`export const`, envolvido num wrapper UMD manual
   (`(function(root, factory){ ... }(...))`).
5. **CSS standalone** (`dist/ai-editor.css.js` ESM, `dist/ai-editor.css.umd.js`
   UMD) — para quem quer importar CSS separado do bundle principal.
6. **Minificação** (`dist/ai-editor.min.js`): `basicMinify()` é um minificador
   regex caseiro (strip de comentários `//` e `/* */`, colapso de espaços,
   remoção de espaço ao redor de pontuação). **Só roda sobre o código próprio**
   — `marked` é prependado depois, já minificado de fábrica, porque o
   minificador caseiro não entende strings/regex JS o suficiente para não
   corromper código denso de terceiros.

**Bug conhecido e corrigido (v1.5.0)**: o regex de strip de comentário de
linha (`/\/\/[^\n]*/g`) tratava `//` dentro de string literal (ex.:
`'http://...'`) como início de comentário, corrompendo `dist/ai-editor.min.js`
silenciosamente em toda versão publicada antes de 1.5.0. Corrigido com um
negative lookbehind (`(?<!:)\/\/[^\n]*`), assumindo que comentários reais
nunca são precedidos por `:` neste código. Regressão coberta por
`test/build.test.js` (ver TESTING.md) — **qualquer alteração futura no
minificador deve rodar esse teste antes de publicar**.

- **Dual export ESM+CJS**: `package.json.exports` declara `import` →
  `dist/ai-editor.esm.js`, `require`/`default` → `dist/ai-editor.js` (UMD, não
  CJS puro, mas funciona via `module.exports=factory()` no wrapper). O
  subpath `./server` é CJS puro (`server/index.js`, sem versão ESM — o server
  não roda no browser). `marked` passou de `peerDependency` opcional para
  `devDependency` build-time-only em 1.5.0 — consumidores nunca instalam nem
  importam `marked` diretamente.
- **`npm run dev`**: `node scripts/build.js --watch` (mesmo script, flag
  `--watch` — não confirmado neste mapeamento se o watch está de fato
  implementado dentro de build.js; verificar antes de depender disso).

## Git

- **Branch strategy**: trunk-based simples — um único branch `main`, sem
  branches de feature no histórico local (`git branch -a` só lista `main` +
  `origin/main`). Trabalho em progresso fica descrito no `ROADMAP.md`
  ("shipped this session, pending release") em vez de branches/PRs.
- **Convenção de commits reais** (via `git log --oneline`):
  `<tipo>: <resumo curto>` seguido às vezes de `(vX.Y.Z)` no fim quando o
  commit fecha uma versão:
  ```
  feat: bundle marked, first-class Ollama/LM Studio support (v1.5.0)
  feat: surgical saves, framework handoff, provider-agnostic AI, deterministic palette enforcement (v1.4.0)
  docs: mark Milestone 4 complete — roadmap fully implemented
  feat: AGENTS.md onboarding + fix cross-element edit leak (v1.3.0)
  fix: harden server against secret leaks and unauthenticated writes (v1.2.1)
  feat: DESIGN.md discovery, CLI, and postinstall onboarding (v1.2.0)
  fix: strip bare import statements from bundle output
  ```
  Tipos observados: `feat`, `fix`, `docs`. Não há `chore`, `refactor`, `test`
  isolados no histórico — mudanças de teste normalmente entram junto do
  `feat`/`fix` que motivou o teste. Mensagens são descritivas e às vezes
  agregam múltiplas mudanças relacionadas num único commit por versão (não é
  um commit por unidade atômica de trabalho, é um commit por release).
- **Working tree**: no momento deste mapeamento, `git status` reporta limpo,
  branch `main` sincronizado com `origin/main` — mas o `ROADMAP.md` registra
  que a versão local (1.5.0) está à frente da publicada no npm (1.4.0) e que
  o commit da 1.5.0 ainda não foi feito "as of this writing" em uma sessão
  anterior. Ou seja: **o ROADMAP.md pode ficar temporariamente dessincronizado
  do `git log` real entre sessões** — sempre confirmar com `git log -1` e
  `npm view visual-ai-editor version` antes de assumir o que já foi
  publicado/commitado.
