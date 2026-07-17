# Roadmap — Agent-Ready Onboarding + DESIGN.md Enforcement

Contexto: hoje o `visual-ai-editor` já enforça o design system quando um `DESIGN.md`
existe, mas (1) nada explica a um agente de IA como a ferramenta funciona por baixo
dos panos, e (2) se o `DESIGN.md` não existir, a IA simplesmente edita sem
referência nenhuma — sem sugerir criar um. Este roadmap cobre as duas lacunas.

Metodologia de referência para o `DESIGN.md`: https://camaraux.com.br/como-criar-aplicar-design-md-ia/
(perguntas, 11 seções, regras para IA, checklist — resumidos na Milestone 3).

---

## Milestone 1 — `AGENTS.md`: manual para agentes de IA, entregue na instalação ✅ implementado

> **Implementado:** `docs/AGENTS.md` (fonte versionada), `lib/agents-md.js`
> (lógica de merge idempotente: cria se não existir, faz append se existir
> `AGENTS.md` sem nosso bloco, substitui só o bloco delimitado
> `<!-- visual-ai-editor:start/end -->` se já existir — preservando sempre o
> conteúdo do usuário ao redor). Integrado ao `postinstall.js` existente
> (silencioso, nunca falha o install) e exposto também como comando manual
> `npx visual-ai-editor agents:init` para quem instala com `--ignore-scripts`.
>
> Testados os 3 cenários de merge (sem arquivo → created; arquivo do usuário
> sem nosso bloco → appended preservando conteúdo; bloco desatualizado →
> updated substituindo só o bloco) e o fluxo real via `npm pack` + instalação
> limpa + `npm rebuild` (simulando o hook de install real) — `AGENTS.md`
> apareceu corretamente na raiz do projeto de teste.
>
> **Nome do arquivo:** `AGENTS.md` (decidido com o usuário — convenção
> cross-tool, não conflita com um `CLAUDE.md` que o projeto já tenha).

**Objetivo:** todo projeto que instalar `visual-ai-editor` ganha automaticamente um
`AGENTS.md` na raiz, explicando pra qualquer agente (Claude Code, Cursor, etc.)
como a ferramenta funciona: seleção de elementos, endpoints da API, relação com
`DESIGN.md`, variáveis de ambiente, comandos disponíveis.

**Arquivos:**
- `docs/AGENTS.md` (novo, fonte da verdade versionada com o pacote) — conteúdo:
  o que é a ferramenta, como o editor injeta UI, contrato dos endpoints
  (`/api/edit`, `/api/design`, `/api/save`), como o `force mode` funciona, como o
  agente deve se comportar ao ser pedido para "mudar o layout" (verificar
  `DESIGN.md` primeiro, reusar classes, etc.), troubleshooting comum.
- `scripts/postinstall.js` (novo) — copia `docs/AGENTS.md` → `<raiz-do-consumidor>/AGENTS.md`
  **apenas se não existir**; se já existir um `AGENTS.md` no projeto, insere um
  bloco delimitado (`<!-- visual-ai-editor:start -->...<!-- visual-ai-editor:end -->`)
  em vez de sobrescrever — idempotente em upgrades de versão.
- `package.json` — adicionar `"postinstall": "node scripts/postinstall.js"`.

**Salvaguardas obrigatórias:**
- Nunca falhar o `npm install` do consumidor: tudo em try/catch, sempre `exit 0`.
- Detectar e pular quando rodando dentro do próprio repo da lib (comparar
  `INIT_CWD` com o diretório do pacote), pra não escrever `AGENTS.md` nele mesmo.
- Usar `INIT_CWD` (ou `npm_config_local_prefix`) para achar a raiz do projeto
  consumidor — funciona bem para deps diretas; monorepos com hoisting são
  best-effort (documentar a limitação no README).
- Expor também um comando manual (`npx visual-ai-editor init-docs`, ver Milestone 2)
  para quem instala com `--ignore-scripts` ou em ambientes que bloqueiam postinstall.

**Decisão a validar com você:** nome do arquivo. Recomendo `AGENTS.md` (convenção
cross-tool, também lida por Claude Code/Cursor) em vez de `CLAUDE.md` — se você já
usa `CLAUDE.md` no projeto, o postinstall só adiciona uma linha apontando pra ele,
não substitui.

---

## Milestone 2 — CLI: detectar `DESIGN.md` e sugerir criação ✅ implementado

**Objetivo:** ao instalar (ou sob demanda), o pacote procura `DESIGN.md` no projeto
que está sendo instalado. Se achar, valida a cobertura das 11 seções. Se não achar,
imprime instruções + gera um prompt pronto para o usuário colar no Claude/Cursor/
agente, seguindo a metodologia do artigo.

> **Implementado:** `lib/design-check.js` (busca via ripgrep com fallback em Node
> puro — testado nesta máquina sem `rg` no PATH, o fallback funcionou), `bin/cli.js`
> (`design:check` / `design:init`), `scripts/postinstall.js` (aviso silencioso,
> nunca falha o install, auto-skip dentro do próprio repo), `/api/design` agora
> retorna `{ md, exists }`, e o modal do editor (`showDesignModal`) mostra um CTA
> com o comando `design:init` quando `exists === false`. Testado end-to-end via
> Chrome headless/CDP: toolbar carrega, modal abre, CTA aparece corretamente.
>
> **Nota de ambiente:** esta máquina tem um wrapper de segurança do npm
> (allow-scripts) que bloqueia `postinstall` de pacotes de terceiros até
> aprovação explícita — isso é comportamento correto do npm, documentado no
> README ("Se seu setup de npm exige aprovar scripts..."). A lógica do
> postinstall foi validada rodando o script diretamente (simulando `INIT_CWD`),
> não apenas via `npm install`.
>
> **Bug crítico encontrado e corrigido antes de publicar:** `"bin": {"visual-ai-editor": "./bin/cli.js"}`
> (com `./` no início) faz o `npm publish` silenciosamente remover o campo
> `bin` inteiro (warning: `"bin[...] script name ... was invalid and removed"`)
> — o pacote publicaria sem nenhum comando executável, quebrando `npx
> visual-ai-editor` por completo. Corrigido para `"bin/cli.js"` (sem `./`) e
> validado de ponta a ponta: `npm pack` → instalar o tarball num projeto de
> teste limpo → `npx visual-ai-editor` e `npx visual-ai-editor design:check`
> executam corretamente, com `node_modules/.bin/visual-ai-editor(.cmd/.ps1)`
> gerados.

**Arquivos:**
- `bin/cli.js` (novo) + `"bin": {"visual-ai-editor": "./bin/cli.js"}` no
  `package.json`, com subcomandos:
  - `visual-ai-editor design:check` — procura `DESIGN.md` na raiz do projeto e em
    `docs/`, `design/` (via `rg --files -g DESIGN.md` quando ripgrep estiver
    disponível no PATH, com fallback em Node puro — `fs` + walk limitado, pulando
    `node_modules`/`.git` — para funcionar também no Windows sem ripgrep
    instalado). Se achar, roda um checklist (regex por `## <seção>` esperada) e
    imprime um relatório ✓/✗ por seção — só consultivo, não bloqueia nada.
  - `visual-ai-editor design:init` — escreve `DESIGN.prompt.md` no projeto (o
    prompt pronto da Milestone 3), para o usuário rodar `cat DESIGN.prompt.md | claude`
    ou colar manualmente em qualquer agente.
- `scripts/postinstall.js` (mesmo arquivo da Milestone 1) — ao final, chama a
  checagem de `DESIGN.md` em modo silencioso e, se não achar, imprime um aviso de
  uma linha: `[visual-ai-editor] Nenhum DESIGN.md encontrado — rode
  "npx visual-ai-editor design:init" para gerar um e melhorar a edição por IA.`
- `server/index.js` — `/api/design` passa a responder também `exists: boolean`.
- `src/actions.js` (`showDesignModal`) — quando `exists === false`, o modal do
  editor mostra uma chamada para ação com o mesmo comando, em vez de
  "(DESIGN.md vazio)".

---

## Milestone 3 — Conteúdo do prompt (fonte: metodologia camaraux.com.br) ✅ implementado

> `templates/design-md-prompt.md` criado e incluído em `files` do `package.json`.
> Contém: entrevista (5 perguntas), 11 seções obrigatórias, regras para IA,
> checklist de 10 itens, e instrução final de salvar como `DESIGN.md`. Validado
> por script (`### N.` × 11, `- [ ]` × 10). Ainda não consumido por nenhum
> comando — isso é a Milestone 2.

**Objetivo:** ter uma única fonte versionada do texto que vira `DESIGN.prompt.md`,
em vez de duplicar a lógica em vários lugares.

**Arquivo:** `templates/design-md-prompt.md` (novo) — contém, fielmente à
metodologia do artigo:

1. **Perguntas de entrevista** que o agente deve fazer ao usuário antes de gerar o
   arquivo: personalidade visual (moderna/técnica/editorial/premium/acessível),
   referências de marca/estilo, sensação desejada, tipo de produto (SaaS/
   marketplace/app/fintech/plataforma de IA), prioridades (conversão/clareza/
   densidade/acessibilidade).
2. **Estrutura obrigatória de 11 seções**: Visão Geral; Princípios de Design;
   Paleta de Cores (hex + regras de contraste + quando usar cada cor); Tipografia
   (família, escala Display/H1/H2/Body/Caption com tamanho/peso/line-height);
   Espaçamentos (múltiplos de 4px: 4/8/12/16/24/32/48/80 com uso de cada um);
   Bordas/Raios/Sombras (small 6px, medium 12px, large 20px, pill 999px + regras
   de elevação); Layout e Grid (max-width, padding, colunas por breakpoint —
   12/8/4); Componentes (botão, card, input, modal — todos os estados: hover,
   focus, active, disabled, loading, error); Acessibilidade (contraste, foco
   visível, não depender só de cor, navegação por teclado, alvo de toque mínimo,
   alt text); Regras Específicas para IA (não inventar estilos, priorizar
   componentes existentes, preservar hierarquia, manter tokens exatos); Exemplos
   de Prompts prontos.
3. **Regras que a IA deve seguir** ao gerar ou aplicar o design system (a mesma
   lista que já usamos no `system prompt` do `server/index.js` — este template
   vira também a fonte única para manter os dois em sincronia).
4. **Checklist de validação final** (10 itens do artigo) — é o mesmo checklist que
   o `design:check` roda automaticamente por regex.
5. Instrução explícita final: "salve o resultado como `DESIGN.md` na raiz do
   projeto".

`bin/cli.js` lê este arquivo (via `fs.readFileSync`, embutido no bundle publicado
como os outros templates) em vez de ter o texto hardcoded em múltiplos lugares.

---

## Milestone 4 — Docs, versionamento e verificação

- Atualizar `README.md` com uma seção "Onboarding para agentes de IA": o que
  acontece automaticamente na instalação (`AGENTS.md`, aviso de `DESIGN.md`) e os
  comandos manuais (`design:check`, `design:init`).
- Bump de versão para **1.2.0** (funcionalidade nova, não é só patch).
- **Plano de verificação end-to-end:**
  1. `npm install` em um projeto de teste limpo (sem `DESIGN.md`) → confirmar que
     `AGENTS.md` aparece na raiz e que o aviso de `DESIGN.md` ausente é impresso.
  2. Rodar `npx visual-ai-editor design:init` → confirmar que `DESIGN.prompt.md` é
     gerado com as 11 seções, perguntas, regras e checklist.
  3. Colocar um `DESIGN.md` de exemplo (ex.: o do `smartvia`, que já é bem
     completo) e rodar `design:check` → confirmar relatório ✓/✗ por seção
     coerente com o conteúdo real.
  4. Validar em `smartvia` como consumidor real (ele já tem `DESIGN.md` completo
     — bom caso de teste para o "found" path).
  5. Confirmar que o `postinstall` nunca quebra `npm install --ignore-scripts` nem
     lança exceção não tratada em nenhum cenário (rodar dentro do próprio repo da
     lib, em um projeto sem `package.json` na raiz esperada, etc.).

---

## Ordem de execução sugerida

1. Milestone 3 primeiro (o template é a base que as outras duas consomem).
2. Milestone 2 (CLI + detecção) — maior valor imediato, entrega a "sugestão de
   criar" pedida.
3. Milestone 1 (`AGENTS.md` + postinstall) — pode reaproveitar a infraestrutura de
   postinstall já criada na 2.
4. Milestone 4 por último (docs + release).
