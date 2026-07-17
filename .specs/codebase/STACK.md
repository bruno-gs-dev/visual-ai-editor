# Stack Tecnológica

> Gerado por leitura direta de `package.json`, `README.md`, `ROADMAP.md`, `docs/AGENTS.md` e do código-fonte
> (`src/`, `server/`, `lib/`, `bin/`, `scripts/`, `test/`, `types/`) em 2026-07-17.
> Projeto: `visual-ai-editor`, pacote npm publicado, versão local em `package.json`: **1.5.0**
> (ROADMAP.md indica que 1.5.0 está pronta/testada mas ainda não publicada no registry no momento
> deste mapeamento — versão publicada mais recente confirmada no npm era 1.4.0; confirme com
> `npm view visual-ai-editor version` se precisar do estado exato do registry).

## Linguagens
- **JavaScript (ES2015+ módulos ES / CommonJS)** — linguagem única do projeto. Sem transpilação:
  `src/*.js` usa `import`/`export` (ESM) e é convertido para UMD/CommonJS por um script de build
  próprio (regex-based), não por Babel/TypeScript/Webpack. `server/`, `lib/`, `bin/`, `scripts/`
  são CommonJS puro (`require`/`module.exports`), sintaxe var-based, compatível com Node antigo.
- **TypeScript (apenas declarações, `.d.ts`)** — `types/index.d.ts` (API do cliente) e
  `types/server.d.ts` (API do servidor) são escritos à mão para tipar o pacote para consumidores;
  não há compilação TypeScript no projeto, é tipagem estática pura de um pacote JS.
- **Ambiente de execução**: Node.js — testado localmente com **v24.18.0** (`node --version` no
  ambiente de mapeamento); o código em si usa apenas APIs estáveis desde versões bem mais antigas
  do Node (sem uso de features exclusivas de versões recentes), então não há um "engines" mínimo
  declarado em `package.json`.

## Frameworks e bibliotecas principais
- **Express 4.19.2** — servidor HTTP (`server/index.js`): serve arquivos estáticos do projeto
  consumidor, expõe os endpoints `/api/edit`, `/api/design`, `/api/save`, `/api/handoff`.
- **Nenhum framework de frontend próprio.** O cliente (`src/`) é DOM vanilla — sem React/Vue/etc.
  como dependência; o pacote é *consumido* por projetos React/Angular/Vue/estático (ver
  `examples/`), mas não depende de nenhum deles.
- **marked 18.0.6** (devDependency, não dependency) — parser de Markdown para renderizar o
  `DESIGN.md` no modal do editor. Não é instalado pelo consumidor: `scripts/build.js` lê
  `node_modules/marked/lib/marked.umd.js` diretamente do ambiente de build e **embute o bundle
  UMD inteiro, verbatim**, no topo de cada arquivo gerado em `dist/` (ESM, UMD e minificado). Em
  runtime o cliente apenas checa `typeof marked !== 'undefined'`.
- **dotenv 16.4.5** — carrega variáveis de ambiente (`AI_API_KEY`, `AI_ENDPOINT`, `AI_MODEL`,
  legado `GROQ_API_KEY`/`GROQ_MODEL`) de um `.env` via `envPath` passado a `startServer()`.
  Carregado com `try/catch` — se não estiver instalado, assume que as env vars já estão no
  processo (não quebra).

## Bancos de dados
- **Nenhum.** Não há banco de dados. Persistência é feita inteiramente em arquivos:
  - `DESIGN.md` (lido, nunca escrito pelo pacote) — fonte da verdade do design system, relido
    automaticamente quando o `mtime` muda (sem restart do servidor).
  - `.ai-editor/history/*.bak.html` — backups timestamped antes de cada save, cap de 100 arquivos
    mais recentes por arquivo-alvo.
  - `.ai-editor/pending-changes.md` — manifesto de mudanças pendentes para handoff a um agente de
    IA em projetos com framework (React/Vue).
  - O próprio arquivo HTML do projeto consumidor (`index.html` ou outra página) é o "banco" que
    recebe patches cirúrgicos via `/api/save`.

## Infra e plataforma
- **Nenhuma nuvem/infra própria.** É uma biblioteca npm consumida por outros projetos — não há
  deploy, container, ou serviço hospedado deste pacote em si.
- **Runtime alvo**: o servidor (`server/index.js`) roda em processo Node local, tipicamente
  iniciado por um script pequeno (`start-ai-editor.js`) no projeto consumidor, com
  `startServer({ port, envPath, ... })`. Documentado explicitamente como **ferramenta de
  desenvolvimento/staging**, não hardened para produção pública (ver seção "Security & production"
  do README — sem containerização, sem autenticação real, apenas um token compartilhado opcional).
- **LLM externo (não hospedado pelo pacote)**: qualquer endpoint compatível com a API
  chat-completions da OpenAI. Padrão: **Groq** (`https://api.groq.com/openai/v1/chat/completions`,
  modelo `llama-3.3-70b-versatile`). Suporta também OpenAI, OpenRouter, e provedores locais
  (**Ollama** em `localhost:11434`, **LM Studio** em `localhost:1234`) via presets em
  `PROVIDER_PRESETS` (`server/index.js`).
- **Sem containerização** (sem Dockerfile no repo).

## Ferramentas de build / empacotamento
- **npm** — gerenciador de pacotes e registry de publicação (`npm publish`, pacote público
  `visual-ai-editor`).
- **Build script próprio, zero dependências externas** (`scripts/build.js`) — não usa
  Rollup/Webpack/esbuild/Vite. É um script Node puro que:
  1. Lê o UMD do `marked` de `node_modules` e embute como statement de topo.
  2. Lê `styles/ai-editor.css` e copia para `dist/`.
  3. Concatena os módulos ESM de `src/` (ordem fixa: `core.js`, `i18n.js`, `tools.js`,
     `selection.js`, `actions.js`, `ui.js`, `index.js`), removendo `import`/`export` via regex,
     gerando `dist/ai-editor.esm.js` e `dist/ai-editor.js` (wrapper UMD manual).
  4. Gera módulos de CSS standalone (`dist/ai-editor.css.js` ESM, `dist/ai-editor.css.umd.js` UMD).
  5. Minifica com um **minificador regex artesanal** (`basicMinify`) — remove comentários de
     linha/bloco e espaços; tem cuidado explícito para não corromper strings com `://` (bug real
     encontrado e corrigido na v1.5.0).
  - `npm run build` executa o script; `npm run dev` roda em modo `--watch`.
- **`node --test`** (test runner nativo do Node, sem Jest/Mocha/Vitest) — `npm test` roda
  `node --test test/*.test.js`.
- **postinstall automático** (`scripts/postinstall.js`) — roda no `npm install` do **consumidor**
  do pacote (não durante desenvolvimento do próprio pacote — auto-detecta e pula quando
  `INIT_CWD` aponta para o próprio repo): instala/atualiza `AGENTS.md` no projeto consumidor e
  avisa se falta `DESIGN.md`. Nunca falha a instalação (tudo em try/catch).
- **CLI própria** (`bin/cli.js`, exposta como binário `visual-ai-editor` via `npm install -g` ou
  `npx`) — comandos `design:check`, `design:init`, `design:lint`, `agents:init`.
- **Sem linter/formatter configurado** (sem ESLint/Prettier no repo).
- **Sem CI configurado no repo mapeado** (nenhum diretório `.github/workflows` encontrado).

## Dependências principais

### `dependencies` (runtime, instaladas no consumidor)
- **express `^4.19.2`** — servidor HTTP: roteamento dos 4 endpoints da API, `express.static` para
  servir os arquivos do projeto consumidor, `express.json` para parsear os bodies.
- **dotenv `^16.4.5`** — leitura de `.env` (chave de API do provedor LLM, porta, etc.) via
  `envPath` opcional passado a `startServer()`.

### `devDependencies` (apenas build-time, nunca instaladas no consumidor)
- **marked `^18.0.6`** — gera o HTML renderizado do `DESIGN.md` no modal do cliente. Seu bundle
  UMD é embutido diretamente em `dist/` no momento do build (`scripts/build.js`); o consumidor
  final **não precisa instalar `marked`** — daí ser devDependency e não peerDependency (mudança
  feita na v1.5.0, antes era peerDependency opcional).

### Sem dependências de teste externas
Os testes usam exclusivamente o runner nativo `node:test` — não há Jest, Mocha, Sinon, Supertest,
etc. Mocks de rede (ex.: `fetch` stub para simular respostas de provedores Ollama/remotos em
`test/server.test.js`) são feitos manualmente substituindo `global.fetch`.
