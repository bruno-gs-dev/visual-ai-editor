# Feature: zero-config-start

**Status:** implementado (v1.6.0 local) — validado E2E em projeto vazio; pendente publicar no npm
**Escopo (auto-sizing):** Grande — multi-componente (`bin/cli.js`, `server/index.js`, README, testes)
**Criado em:** 2026-07-17

## Problema real

Onboarding atual exige 4 passos manuais mesmo no modo "plug & play" do README:

1. Criar `start-ai-editor.js` na raiz chamando `startServer()`
2. Editar o HTML do projeto para importar `ai-editor.esm.js` e chamar `init()`
3. Criar `.env` com a chave
4. Rodar `node start-ai-editor.js`

O operador testou em projeto novo e desistiu no meio — fricção real de adoção.
Meta declarada: **instalar → no máximo um arquivo de config auto-gerado onde
cola a chave → rodar → funcionando.**

## Estado-alvo (UX final)

```bash
npm i visual-ai-editor
npx visual-ai-editor start
# → "[visual-ai-editor] .env criado. Cole sua chave em AI_API_KEY e rode de novo."
#   (edita .env, cola a chave)
npx visual-ai-editor start
# → servidor no ar, abre http://localhost:3000, toolbar já aparece em qualquer .html servido
```

Zero arquivos de bootstrap escritos pelo usuário. Zero edição de HTML.
Um único arquivo tocado pelo humano: `.env` (auto-gerado com template comentado).

## Requisitos

### R1 — Comando `start` no CLI
- **R1.1** `npx visual-ai-editor start` sobe o servidor via `startServer()` com defaults
  (port 3000 ou `PORT` do `.env`, `staticDir = cwd`, `envPath = ./​.env`).
- **R1.2** `npx visual-ai-editor` sem argumentos também executa `start` (o usage atual
  vira `help`/fallback com `--help`).
- **R1.3** Flags mínimas: `--port <n>`, `--no-inject`, `--no-open`.
- **R1.4** Ao subir, imprime URL e, se possível, abre o browser (best-effort,
  `start`/`open`/`xdg-open` conforme plataforma; falha silenciosa).

### R2 — `.env` auto-gerado (o "arquivo de config" único)
- **R2.1** Se não existe `.env` no cwd **e** nenhuma chave no ambiente
  (`AI_API_KEY`/`GROQ_API_KEY`), `start` cria `.env` a partir de um template
  comentado (chave em branco, provider/model/port comentados com os defaults e
  exemplos Groq/OpenAI/Ollama/LM Studio) e **encerra com instrução clara** de
  colar a chave e rodar de novo. Não sobrescreve `.env` existente jamais.
- **R2.2** Se `.env` existe mas a chave está vazia/placeholder, mesma mensagem, exit 1.
  Exceção: endpoint localhost (Ollama/LM Studio) dispensa chave — comportamento
  já existente no server, o CLI não pode bloquear esse caso.
- **R2.3** `start` garante `.env` no `.gitignore` do projeto (cria/appenda com aviso
  impresso; nunca remove nada).
- **R2.4** Decisão de formato: `.env`, não `ai-editor.config.json`. Justificativa:
  já suportado pelo server (`AI_ENDPOINT`/`AI_MODEL`/`AI_API_KEY`/`PORT`), convenção
  universal para segredos, já está na blocklist do static server (nunca é servido),
  e gitignore-friendly. Um JSON com chave dentro seria commitado por acidente.

### R3 — Auto-injeção do client nas páginas servidas
- **R3.1** O static middleware do server, ao servir qualquer `.html`, injeta antes de
  `</body>`: `<script type="module">import { init } from '/node_modules/visual-ai-editor/dist/ai-editor.esm.js'; init({ apiBase: '/api' });</script>`.
  (O server já allowlista seu próprio `dist/` dentro de `node_modules` — sem obstáculo.)
- **R3.2** Skip determinístico se a página já carrega o editor (detectar
  `ai-editor.esm.js`/`AIEditor.init`/`data-ai-editor="off"` no HTML) — evita init duplo
  em projetos que fizeram wiring manual.
- **R3.3** Injeção só quando o server é iniciado com `inject: true` — default `true`
  no caminho do CLI `start`, default `false` no `startServer()` programático
  (não muda comportamento de consumidores existentes como smartvia; opt-in lá).
- **R3.4** HTML sem `</body>` (fragmentos): appenda ao final. HTML via framework dev
  server (Vite/CRA/etc.) está **fora de escopo** — auto-injeção só vale para páginas
  servidas por este server; React/Vue continuam com wiring manual documentado.

### R4 — Postinstall como guia, não como ação
- **R4.1** Mensagem final do postinstall passa a ser: `Pronto! Rode: npx visual-ai-editor start`
  (substitui/precede o nudge atual do DESIGN.md, que continua existindo mas depois).
- **R4.2** Postinstall **não** cria `.env` nem toca no projeto além do AGENTS.md atual
  (criação do `.env` fica no `start`, onde há intenção explícita do usuário).

### R5 — Docs e testes
- **R5.1** README: seção "Plug & play" reescrita para o fluxo de 2 comandos; wiring
  manual movido para seção avançada (continua válido e necessário p/ frameworks).
- **R5.2** AGENTS.md template (`lib/agents-md.js`): documentar o comando `start` e a
  auto-injeção, para agentes de IA nos projetos consumidores.
- **R5.3** Testes (`node:test`, padrão existente): geração do `.env` template
  (cria/não-sobrescreve/gitignore), gate de chave vazia, injeção de HTML
  (com `</body>`, sem `</body>`, skip por wiring manual, skip por `--no-inject`),
  default `inject:false` no programático.
- **R5.4** CHANGELOG.md + bump para 1.6.0 (feature, não breaking — R1.2 muda o
  comportamento do comando vazio de "usage" para "start", aceito como minor por
  ser ferramenta dev; documentar no changelog).

## Fora de escopo (explícito)

- Auto-injeção em dev servers de framework (Vite plugin etc.) — já é a maior lacuna
  arquitetural registrada no ROADMAP (source-mapping), não entra aqui.
- Wizard interativo de configuração (perguntas no terminal) — contradiz a meta
  "um arquivo, colar chave, pronto".
- Mudar o mecanismo de auth (`apiToken`) — permanece opt-in como está.

## Plano de execução (fases)

| # | Fase | Arquivos | Depende de |
|---|------|----------|-----------|
| 1 | Template `.env` + lógica de geração/gate | `templates/env-template`, `lib/` novo helper, testes | — |
| 2 | Comando `start` no CLI (flags, gitignore, open browser) | `bin/cli.js` | 1 |
| 3 | Middleware de injeção HTML no server | `server/index.js`, testes | — [P] com 1–2 |
| 4 | Postinstall + README + AGENTS.md + types | `scripts/postinstall.js`, `README.md`, `lib/agents-md.js`, `types/` | 1–3 |
| 5 | Validação real: projeto novo vazio, do zero, cronometrado | manual + smartvia regression (`npm test`) | 4 |

Fases 1–2 e 3 são paralelizáveis. Gate final (fase 5): num diretório novo com um
`index.html` qualquer, o fluxo `npm i` → `start` → colar chave → `start` → editar
elemento → salvar tem que funcionar sem tocar em nenhum outro arquivo.

## Pré-condição de release

ROADMAP.md registra que a **1.5.0 local ainda não foi commitada/publicada**
(npm serve 1.4.0). Publicar 1.5.0 antes de começar esta feature — não empilhar
duas releases não publicadas na mesma working tree.
