# Integrações Externas

> Gerado a partir de leitura direta de `server/index.js`, `README.md` e
> `ROADMAP.md` em 2026-07-17.

## Provedor de LLM — qualquer API compatível com chat-completions da OpenAI

Este projeto não integra com um provedor específico via SDK — ele fala HTTP
puro contra qualquer endpoint que implemente o contrato `chat/completions`
da OpenAI. Groq é o padrão; OpenAI, OpenRouter, Ollama e LM Studio são
suportados pelo mesmo caminho de código, sem branching por provedor (exceto
os dois presets de conveniência para Ollama/LM Studio, que só resolvem a URL
do endpoint).

### Protocolo / SDK

- **Não há SDK.** `callProvider()` em `server/index.js` faz um `fetch(provider.endpoint, { method: 'POST', headers, body })`
  cru, com `body = { model, temperature, messages: [{role:'system',...},{role:'user',...}], response_format? }`.
- Endpoint padrão (Groq): `https://api.groq.com/openai/v1/chat/completions`.
  Modelo padrão: `llama-3.3-70b-versatile`. Temperatura padrão: `0.2`.
- Resolução do endpoint/modelo/chave, em ordem de precedência
  (`resolveProvider`):
  1. `ai.endpoint` / `ai.model` / `ai.apiKey` passados a `startServer()`;
  2. preset `ai.provider: 'ollama' | 'lmstudio'` (só resolve `endpoint`, não
     `model` nem `apiKey` — presets deliberadamente não preenchem um modelo
     default, para não mascarar um erro de "modelo não puxado");
  3. env vars `AI_ENDPOINT` / `AI_MODEL` / `AI_API_KEY` (carregadas via
     `dotenv`, se `envPath` foi passado a `startServer()`);
  4. legado: `GROQ_MODEL` / `GROQ_API_KEY`;
  5. hardcoded default (endpoint/model do Groq acima).
- **Modo JSON estruturado**: por padrão (`jsonMode: ai.jsonMode !== false`) o
  request inclui `response_format: { type: 'json_object' }`, esperando de
  volta `{"html": "..."}` ou `{"warn": "..."}`. Se o provedor responder 400
  com uma mensagem mencionando `response_format`/`json_object`, o servidor
  automaticamente reenvia a mesma chamada sem esse parâmetro (fallback de
  compatibilidade para provedores que não suportam o modo JSON).
- `parseModelResponse()` também tolera respostas legadas/malformadas: tenta
  `JSON.parse` primeiro; se falhar mas o texto começa com `{`, tenta extrair
  um campo `"warn"` via regex; senão trata a resposta inteira como HTML puro.

### Autenticação

- Header `Authorization: Bearer <apiKey>` — só é adicionado à requisição se
  `provider.apiKey` estiver presente (`if (provider.apiKey) headers['Authorization'] = ...`).
- **Requisito de chave é condicional**, não incondicional: `provider.requiresApiKey`
  é calculado por `isLocalEndpoint(endpoint)` — `false` (chave dispensada)
  para hosts `localhost`/`127.0.0.1`/`::1`/`0.0.0.0`; `true` (chave exigida)
  para qualquer outro host. Pode ser sobrescrito explicitamente em ambas as
  direções via `ai.requiresApiKey: true|false`.
- Esse comportamento foi corrigido na 1.5.0 (local, não publicada): antes,
  `/api/edit` recusava com 500 sempre que `apiKey` estivesse vazio,
  independentemente do endpoint — o que tornava Ollama/LM Studio inutilizáveis
  sem uma chave fake. Ver `CHANGELOG.md` / `ROADMAP.md`.

### Comportamento esperado quando indisponível

- **Chave ausente quando exigida**: `POST /api/edit` responde `500 { error: "..." }`
  (mensagem `edit.no-api-key`, i18n) antes mesmo de tentar chamar o provedor —
  falha rápida, sem gastar uma requisição de rede.
- **Erro HTTP do provedor (não 429)**: a mensagem de erro do provedor
  (`data.error.message`) é propagada como `500 { error }`.
- **Rate limit (HTTP 429)**: o servidor tenta extrair o tempo de espera da
  mensagem de erro (regex `try again in ([\d.]+)s`) ou do header
  `retry-after`; se nenhum dos dois existir, usa 10s como padrão. Responde
  `429 { error, retryAfter }`; o client (`AI.startRateLimitCountdown`) mostra
  uma contagem regressiva na UI e desabilita o botão "Aplicar" até zerar.
- **Endpoint totalmente fora do ar / erro de rede**: o `fetch` rejeita, cai no
  `catch` do handler, loga no console do servidor (`console.error('[ai-editor] /api/edit error:', err)`)
  e responde `500 { error: err.message }`.
- **Modelo pequeno/local produzindo JSON malformado ou truncado**: documentado
  como limitação conhecida, não como bug — testado ao vivo contra Ollama
  (`llama3.2:3b`) com o prompt completo (DESIGN.md + force mode + contrato
  JSON): o modelo às vezes retorna `finish_reason: "stop"` com um JSON quebrado
  (decisão do próprio modelo, não corte por limite de tokens). Nenhum "modo
  simplificado" para modelos fracos foi implementado — deliberadamente fora de
  escopo (ver ROADMAP.md, seção "1.5.0").
- **Servidor recusa subir em produção sem proteção**: independente do
  provedor, `assertProductionSafe()` lança erro na inicialização se
  `NODE_ENV=production` e nem `apiToken` nem `allowUnsafeProduction: true`
  foram configurados — previne expor os endpoints (e, por consequência, o
  consumo da API do provedor) sem nenhuma camada de autenticação.

## smartvia (projeto consumidor)

- **Como consome**: dependência npm declarada como `"visual-ai-editor": "^1.5.0"`
  em `smartvia/package.json` (descrição do projeto: "SmartVia — central de
  controle de fiscalização (com visual-ai-editor)"). Não é monorepo — é um
  diretório de projeto totalmente separado (`../smartvia` a partir da raiz
  deste pacote), sem link simbólico nem workspace compartilhado. Hoje, o
  `node_modules/visual-ai-editor` local dentro de `smartvia` já reporta versão
  `1.5.0` — ou seja, foi sincronizado manualmente com a build local ainda não
  publicada (o fluxo descrito no ROADMAP: copiar `node_modules/visual-ai-editor`
  em vez de esperar o `npm publish`, para um loop de teste mais rápido).
- **O que usa**:
  - **Server**: `smartvia/start-ai-editor.js` chama
    `require('visual-ai-editor/server').startServer({ port, envPath })` — usa
    apenas `port` (via `process.env.PORT`) e `envPath` (aponta para
    `smartvia/.env`, que contém `GROQ_API_KEY`). Não passa `ai`, `apiToken`,
    `staticDir` nem outras opções — roda com todos os defaults (Groq, sem
    autenticação de token, servindo `process.cwd()` inteiro).
  - **Client**: `smartvia/index.html` importa o bundle ESM diretamente de
    `./node_modules/visual-ai-editor/dist/ai-editor.esm.js` e chama
    `init({ apiBase: '/api' })` — também sem opções extras (sem `apiToken`,
    sem `onAfterApply`/`onAfterUndo`, sem `locale` explícito).
  - `smartvia` também tem `AGENTS.md` e `DESIGN.md` próprios na raiz — o
    `AGENTS.md` provavelmente contém (ou deveria conter) o bloco instalado
    automaticamente por `lib/agents-md.js` no `postinstall`; `DESIGN.md` é o
    que alimenta o enforcement de paleta descrito em `ARCHITECTURE.md`.
- **Papel no desenvolvimento deste pacote**: é o "test bed" real citado no
  ROADMAP — usado para smoke tests manuais (`/api/edit` contra a API real do
  Groq, save cirúrgico no `index.html` real, geração de manifesto de
  handoff) antes de cada release. Mapeamento profundo do `smartvia` em si
  (rotas, domínio de fiscalização, etc.) está fora do escopo deste
  levantamento — o único ponto de acoplamento real com este pacote é o par
  `startServer()` + `init()` acima.

## Outros serviços / infra

- **`dotenv`** (`^16.4.5`, dependência real de produção) — usado por
  `tryLoadDotenv()` em `server/index.js` para carregar `envPath` (se passado a
  `startServer()`); envolvido em `try/catch` — se `dotenv` não estiver
  instalável por algum motivo, o servidor assume que as env vars já estão
  definidas pelo SO e segue sem quebrar.
- **`express`** (`^4.19.2`, dependência real de produção) — serve os arquivos
  estáticos do projeto consumidor (`express.static(staticDir)`) e implementa
  os 4 endpoints da API. Sem middleware de terceiros além do parser JSON
  nativo (`express.json({ limit: '4mb' })`).
- **`ripgrep` (binário externo opcional, via `rg`)** — `lib/design-check.js`
  tenta localizar `DESIGN.md` primeiro via `execFileSync('rg', [...])`; se o
  binário não existir ou falhar, cai automaticamente para uma busca manual em
  árvore de diretórios (`walkForDesignMd`, profundidade máxima 6). Não é uma
  dependência declarada no `package.json` — é um binário de sistema opcional,
  puramente uma otimização de velocidade.
- **Sistema de arquivos do projeto consumidor** — não é bem uma "integração
  externa" no sentido de rede, mas é a superfície de I/O mais sensível do
  pacote: leitura/escrita de `DESIGN.md`, `index.html`/páginas do
  `staticDir`, backups em `.ai-editor/history/` e o manifesto
  `.ai-editor/pending-changes.md`. Protegido por `resolvePageFile` (rejeita
  path traversal) e pelo bloqueio de paths sensíveis
  (`SENSITIVE_PATH_RE`) na camada estática do Express.
- **Nenhum banco de dados, fila, cache externo ou serviço de terceiros** além
  do provedor de LLM foi encontrado no código.
