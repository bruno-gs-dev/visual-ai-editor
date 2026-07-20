# Safe-guard — Auditoria das alterações atuais (não commitadas)

## Resumo
Severidade: 🟥 3 · 🟨 4 · 🟩 5

A leva tem duas naturezas misturadas. A parte nova (`demo/`, `.gitignore`, `CHANGELOG`,
`files: ["demo/"]`) é aditiva e foi verificada rodando: nenhum código de produção foi
tocado, `npm test` passa 51/51, o servidor sobe contra a demo e injeta o cliente, e o
tarball sai limpo. O risco não está aí.

O risco está no **README**: o diff mostra que o arquivo não foi só ajustado na seção Demo —
ele já estava reescrito de ponta a ponta no working tree (mudança anterior, não commitada),
e essa reescrita **apagou documentação de features que continuam existindo no código**.
Como o pedido é publicar no npm, o README é parte do artefato que vai para o registry: é o
que o usuário lê na página do pacote. Publicar hoje congela essa perda de documentação em
uma versão pública.

---

## Por superfície alterada

### 🟥 Publicação npm | working tree | não commitado — versão não foi incrementada
**O que mudou:** `package.json` ganhou `"demo/"` em `files`, mas `version` continua `1.6.0`.
**Risco:** `npm view visual-ai-editor version` retorna `1.6.0` — essa versão já é a `latest`
publicada.
**Quebra quando:** o `npm publish` roda como está: o registry responde **403 — cannot
publish over the previously published version**. A publicação simplesmente não acontece.
**Falta:** `npm version patch` (→ `1.6.1`) antes de publicar, e trocar o cabeçalho
`## Unreleased` do CHANGELOG por `## 1.6.1`. São mudanças de documentação e um arquivo de
demo, sem alteração de código de produção — patch é o nível correto, não minor.

---

### 🟥 README / página do pacote no npm | working tree | não commitado — avisos de segurança removidos
**O que mudou:** a seção "Security & production" (≈40 linhas) foi reduzida a quatro
bullets. Sumiram dois avisos que descrevem comportamento real do código:
- que `startServer()`/`buildApp()` **lançam erro e se recusam a subir** quando
  `NODE_ENV=production` sem `apiToken` — e que `allowUnsafeProduction: true` é o escape
  (`server/index.js:85-90`, `types/server.d.ts:49`);
- que **a toolbar do cliente não tem gate de visibilidade**: se o `init()` for parar no
  bundle de produção, todo visitante vê e usa a UI do editor, mesmo com o backend
  rejeitando as requisições.

**Risco:** o texto que sobrou diz que a API é desautenticada e que `.git`/`node_modules`/`.env*`
são bloqueados — o que dá a impressão de que proteger o backend basta. Não basta: o
`init()` no bundle é uma exposição de UI independente do backend.
**Quebra quando:** alguém segue só o README novo, deixa o `init()` no build de produção e
descobre em produção que qualquer visitante vê a toolbar de edição. Ou quando faz deploy
com `NODE_ENV=production`, o servidor se recusa a subir, e não há nada no README explicando
o porquê nem como contornar.
**Falta:** restaurar os dois parágrafos. O comportamento está implementado e testado
(`buildApp throws in production without apiToken or allowUnsafeProduction` passa na
suíte) — é a documentação que ficou para trás.

---

### 🟥 README | working tree | não commitado — `agents:init` e a entrega do AGENTS.md sumiram
**O que mudou:** a seção "AI agent onboarding" foi removida inteira, e `agents:init` não
aparece em nenhuma lista de comandos do README novo (a tabela de CLI só tem `--port`,
`--no-inject`, `--no-open`; a seção Design System só cobre `design:init/check/lint`).
**Risco:** o comportamento continua ativo — `scripts/postinstall.js` chama
`lib/agents-md.js:installAgentsMd()`, que **escreve ou modifica um `AGENTS.md` na raiz do
projeto do usuário** no `npm install`.
**Quebra quando:** alguém instala o pacote, vê um `AGENTS.md` aparecer no seu repositório
(ou o seu `AGENTS.md` existente ganhar um bloco novo), procura no README o que é aquilo e
não encontra nenhuma menção. Um pacote que escreve na raiz do projeto sem documentar é o
tipo de coisa que vira issue de desconfiança.
**Falta:** uma linha na tabela de comandos e um parágrafo curto explicando o que o
postinstall entrega e que o conteúdo existente nunca é sobrescrito.

---

### 🟨 README — tabelas de opções | working tree | não commitado — quatro opções documentadas desapareceram
**O que mudou:** as tabelas de `init()` e `startServer()` foram encurtadas.
**Risco:** saíram opções que continuam existindo e tipadas: `cssUrl` (`src/ui.js:185`,
`types/index.d.ts:13`), `allowUnsafeProduction`, `silent` e `maxHtmlBytes`
(`types/server.d.ts:49,57`).
**Quebra quando:** um usuário de TypeScript vê a opção no autocomplete, vai ao README
entender o default e não acha — ou pior, conclui que foi removida e para de usar.
**Falta:** devolver as quatro linhas às tabelas, ou remover as opções do código se a
intenção era descontinuá-las. Hoje código e doc discordam.

---

### 🟨 README — fluxo de save | working tree | não commitado — "Saving edits" e o handoff perderam a explicação
**O que mudou:** a seção que explicava o save cirúrgico e o handoff de framework foi
removida; `/api/handoff` sobrou como uma linha de tabela ("Append change manifest for
framework pages").
**Risco:** duas coisas não óbvias deixaram de ser ditas: (1) quando o texto `before` de um
patch não é localizado — porque o usuário editou o arquivo à mão desde o último save — o
save cai para escrever a página inteira; (2) em páginas React/Vue nada é escrito no
source: as mudanças vão para `.ai-editor/pending-changes.md` para um agente aplicar.
**Quebra quando:** um usuário de React clica **Save**, vê "salvo", e vai procurar a
mudança no JSX — que não mudou. Sem o README explicando o handoff, isso se lê como bug.
**Falta:** restaurar a seção, ou pelo menos duas frases sobre o comportamento em páginas
de framework.

---

### 🟨 README — edição em página estática | working tree | não commitado — o alerta de event listeners sumiu
**O que mudou:** a seção "Event listeners on edited elements" foi removida; `onAfterApply`
sobrou como uma linha de tabela ("Callback after AI edit replaces elements").
**Risco:** o edit é aplicado com `replaceWith()`, o que **descarta os listeners** ligados
ao elemento antigo via `addEventListener`. O README antigo explicava isso e mostrava como
religar no `onAfterApply`.
**Quebra quando:** uma página HTML estática com `<script>` próprio tem um botão editado
pela IA — o botão continua na tela e para de responder ao clique. É silencioso, não gera
erro no console, e é exatamente o caso de uso principal do produto.
**Falta:** restaurar o parágrafo e o exemplo de `onAfterApply`.

---

### 🟨 README — configuração de provider | working tree | não commitado — presets e env vars não documentados
**O que mudou:** a seção "Choosing an AI provider" foi substituída por uma tabela de quatro
provedores.
**Risco:** a tabela mostra as URLs de endpoint mas não menciona os atalhos
`ai: { provider: 'ollama' }` / `'lmstudio'` (`server/index.js:96-99`), a flag
`requiresApiKey`, as env vars `AI_ENDPOINT`/`AI_MODEL`, nem o fallback legado
`GROQ_API_KEY`/`GROQ_MODEL` — que ainda é honrado no código.
**Quebra quando:** um usuário vindo da 1.4/1.5 com `GROQ_API_KEY` no `.env` lê o README
novo, que só fala em `AI_API_KEY`, e troca a variável sem necessidade — ou pior, conclui
que a configuração dele deixou de ser suportada.
**Falta:** uma subseção curta com os presets, as env vars e a nota de compatibilidade.

---

### 🟩 Baixo risco — verificado, sem ação necessária

- **`demo/index.html` + `demo/DESIGN.md` (arquivos novos)** — a paleta fecha exatamente:
  `design:lint` na pasta reporta zero cores fora da paleta e `design:check` reporta 11/11
  seções. Sem requisições externas, sem imagens, sem build.
- **Servidor contra a demo (verificado rodando na porta 3111)** — página servida com o
  cliente injetado, `/__ai-editor/ai-editor.esm.js` responde 200 (93 KB),
  `/api/design` devolve `exists: true` com 17 cores.
- **`files: ["demo/"]`** — `npm pack --dry-run` confirma 40 arquivos, 140.8 kB, com
  `demo/` incluído e **sem** `.env` nem `.ai-editor/` (só o `server/.env.example`
  intencional). O `demo/DESIGN.md` no tarball não sequestra o `design:check` de quem
  instala: tanto o caminho ripgrep (`-g '!node_modules/**'`) quanto o fallback
  `walkForDesignMd` ignoram `node_modules`.
- **`.gitignore` + `.ai-editor/`** — alinha o repositório com o que o próprio README
  recomenda; sem isso os backups de save entrariam em commits.
- **`npm test`** — 51/51 passando. Nenhum arquivo de `src/`, `server/` ou `lib/` foi
  tocado nesta leva, então o risco de regressão funcional é efetivamente nulo.

---

## Veredito

**Não publique ainda — mas o bloqueio é de uma linha.** A versão `1.6.0` já está no
registry, então o `npm publish` falha de qualquer forma sem um bump.

Sobre o resto: nada aqui quebra código. O que quebra é a documentação pública de features
que continuam funcionando — e publicar é justamente o ato que torna isso visível para todo
mundo. Os três 🟥 e os quatro 🟨 são todos no README, todos de restauração de texto que já
existia no commit anterior, e todos podem ser resolvidos sem tocar em uma linha de código.

Caminho recomendado: bump de versão + restaurar os dois avisos de segurança e a menção ao
`agents:init` (o mínimo defensável para publicar), depois publicar. Os 🟨 restantes podem
ir em um commit de documentação seguinte, sem segurar a release.

---

## Ações aplicadas nesta sessão (pós-auditoria)

Resolvidos antes do commit/publish, por serem restauração de texto que já existia no
commit anterior:

- 🟥 versão: `1.6.0` → `1.6.1`; `## Unreleased` do CHANGELOG virou `## 1.6.1`.
- 🟥 segurança: os dois avisos (recusa em produção sem `apiToken`; ausência de gate de
  visibilidade na toolbar) voltaram para a seção Security.
- 🟥 `agents:init`: tabela de comandos do CLI + parágrafo explicando o `AGENTS.md`
  entregue no postinstall.
- 🟨 tabelas de opções: `cssUrl`, `allowUnsafeProduction`, `silent` e `maxHtmlBytes`
  devolvidas.
- Extra encontrado durante a gravação deste relatório: `files` do `package.json` inclui
  `docs/`, então esta auditoria iria dentro do tarball publicado. Adicionado
  `"!docs/safe-guard/"` em `files` e `docs/safe-guard/` no `.gitignore`; `npm pack
  --dry-run` confirma 40 arquivos com `docs/AGENTS.md` presente e o relatório fora.

### Segunda rodada — os 🟨 restantes também foram fechados

Depois da publicação da 1.6.1, os três 🟨 que tinham ficado para depois foram corrigidos:

- 🟨 **"Saving Edits"** — seção nova cobrindo os dois caminhos do save: patches cirúrgicos
  em página estática (incluindo o fallback para escrita do arquivo inteiro quando o texto
  `before` não é localizado, e o `page` para multi-página) e o handoff de framework, com
  o aviso explícito de que **Save em página React não altera o `.jsx`**.
- 🟨 **Event listeners** — subseção explicando que `replaceWith()` derruba listeners de
  `addEventListener` sem gerar erro, com o exemplo de religação em `onAfterApply`.
- 🟨 **"AI Providers"** — seção nova com presets `ollama`/`lmstudio`, `requiresApiKey`,
  env vars `AI_ENDPOINT`/`AI_MODEL`, a nota sobre capacidade do modelo, e o fallback
  legado `GROQ_API_KEY`/`GROQ_MODEL` ainda honrado no código.

Um item adicional entrou de carona, verificado no código na hora: a seção **CSS variables**
(`--font`, `--warning`, `--lg`) também tinha sumido do README, e as três continuam sendo
lidas por `styles/ai-editor.css` (linhas 3, 24 e 64-69). Restaurada.

**Nada em aberto.** Todos os 🟥 e 🟨 desta auditoria estão resolvidos.

### Ambiente de validação — falso positivo, descartado

Durante a segunda rodada o `node -v` da máquina respondeu `v10.24.1`, o que levantou a
suspeita de que a suíte não rodaria (`node --test` não existe na v10) e de que o `fetch`
usado pelo servidor para chamar o provider quebraria. **Não é um problema deste projeto:**
o autor gerencia versões com `nvm` e a v10 estava ativa por causa de outro projeto na
mesma máquina. Este projeto roda na **v24**.

Revalidado explicitamente na v24.18.0: **51/51 testes passando**. Nada a corrigir — a
observação fica registrada só para que uma leitura futura deste relatório não a
interprete como pendência.

### Onde este relatório vive

`docs/` faz parte de `files` no `package.json`, então esta auditoria iria dentro do
tarball publicado no npm. A solução aplicada mantém as duas propriedades desejáveis:

- `"!docs/safe-guard/"` em `files` → **fora** do pacote npm;
- **não** listado no `.gitignore` → **versionado** no git, junto do código que auditou.
