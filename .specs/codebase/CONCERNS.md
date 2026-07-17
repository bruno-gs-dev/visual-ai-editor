# Preocupações e Dívida Técnica

> Baseado em código real (2026-07-17), `ROADMAP.md` (que documenta uma
> revisão anterior classificando o projeto como **"prototype-grade"**), e
> `README.md` (seção "Security & production", que é honesta sobre as
> limitações do projeto por design).

## Riscos ativos

| Área | Risco | Severidade | Observação |
|------|-------|------------|------------|
| `/api/edit`, `/api/save`, `/api/handoff` sem `apiToken` | Endpoints de escrita ficam abertos por padrão — qualquer um que alcance o servidor pode gastar sua cota de API de IA ou sobrescrever `indexHtmlPath` | Alta (se exposto à internet) | Documentado explicitamente no README ("Security & production"). Mitigado por `apiToken` opcional (não ligado por padrão) e por recusa de subir em `NODE_ENV=production` sem token (`assertProductionSafe`, `server/index.js`). Risco é do consumidor que não segue a recomendação, não um bug — mas é fácil de ignorar. |
| Static file server serve `process.cwd()` inteiro por padrão | `staticDir` não restrito a `public/` expõe todo o código-fonte do projeto consumidor via HTTP, exceto os paths bloqueados por `SENSITIVE_PATH_RE` | Média-Alta | Blocklist (`.git`, `.env*`, `node_modules`, lockfiles, `.ssh`, `.aws`, `.ai-editor`) é uma lista negra, não uma allowlist — qualquer arquivo sensível com nome não previsto (ex.: `credentials.json`, `secrets.yaml`, chaves privadas com outro nome) passa sem bloqueio. |
| Toolbar client-side sem gate de visibilidade | Se `init()` for chamado no bundle de produção, todo visitante vê e usa a UI do editor, mesmo que o backend rejeite a escrita | Média | README recomenda gatear atrás de `NODE_ENV !== 'production'` ou feature flag, mas isso é responsabilidade 100% do consumidor — a lib não força/verifica isso. |
| Minificador regex caseiro (`scripts/build.js`) | Não entende sintaxe JS de verdade (strings, regex literals) — já corrompeu silenciosamente `dist/ai-editor.min.js` em toda versão publicada antes da 1.5.0 (bug do `//` dentro de `'http://...'`) | Média (mitigada, mas a causa raiz — um minificador regex-based — continua lá) | Corrigido com um negative lookbehind pontual (`(?<!:)`), não com um parser real. Qualquer string futura contendo `//` não precedido por `:` (ex.: comentário dentro de um regex literal, ou `//` em outro contexto de string) pode reproduzir uma variante do mesmo bug. Coberto por 1 teste de regressão (`test/build.test.js`), mas esse teste só verifica o caso específico já encontrado (`SVG_NS`), não a classe geral de bug. |
| Nenhum teste automatizado para `src/*.js` (client) | Toda a lógica de seleção (clique/área/lasso), undo/redo, detecção de framework fonte (React fiber/Vue `__file`), coleta de contexto CSS e UI não tem cobertura de teste | Média-Alta | Ver TESTING.md. Regressões nessas áreas só são detectadas manualmente, em navegador real — e não há E2E automatizado (Playwright) para pegar isso em CI. |
| Modelos locais pequenos (Ollama 3B) produzem JSON malformado com o prompt real | Quando `DESIGN.md` + force-mode + contrato `{html}`/`{warn}` estão no system prompt, um modelo 3B às vezes corta a resposta de forma inválida | Baixa-Média (depende do usuário escolher rodar modelo pequeno) | Diagnosticado e documentado deliberadamente como "limitação de capacidade do modelo, não bug" (README, "A note on model capability"). Nenhuma mitigação de código foi adicionada de propósito (seria scope creep, decisão explícita registrada no ROADMAP.md). |
| `ROADMAP.md` pode ficar dessincronizado do estado real do repo entre sessões | O próprio arquivo alerta: "check `npm view visual-ai-editor version` and `git log -1` [...] before redoing anything" | Baixa (processo, não código) | Neste mapeamento, `git status` está limpo e `git log -1` = commit da v1.5.0, ou seja, o commit pendente mencionado no ROADMAP já foi feito — mas isso precisa ser reconfirmado a cada sessão nova, o arquivo é uma "aposta de estado", não fonte de verdade automática. |

## Dívida técnica conhecida

- **Blocklist em vez de allowlist para arquivos sensíveis.** `SENSITIVE_PATH_RE`
  em `server/index.js` é uma lista fixa de padrões proibidos. Qualquer arquivo
  fora dessa lista com conteúdo sensível (chaves de API em nomes não
  convencionais, dumps de banco, etc.) é servido normalmente se estiver
  dentro de `staticDir`. Isso é "por enquanto assim" — a alternativa correta
  de longo prazo (recomendada no próprio README) é o consumidor restringir
  `staticDir` a uma pasta `public/`, não a lib adivinhar o que é sensível.
- **Minificação sem parser real.** `basicMinify()` em `scripts/build.js` é
  regex puro (comentários, espaços, pontuação). Funciona hoje porque o
  código-fonte é pequeno e escrito à mão em um estilo previsível (sem regex
  literals complexos, sem template strings aninhadas incomuns), mas é frágil
  por construção — qualquer padrão novo de sintaxe introduzido em `src/*.js`
  no futuro (um regex literal com `//` dentro, por exemplo) pode quebrar
  silenciosamente de novo, do mesmo jeito que o bug do `SVG_NS` aconteceu.
- **Bundler caseiro em vez de webpack/rollup/esbuild.** `stripImports`/
  `stripImportsExports` fazem strip de `import`/`export` via regex de linha
  inteira (`^import ... from '...';$`). Funciona para o estilo de código
  atual (imports simples, sem import dinâmico, sem `import * as`, sem
  desestruturação multi-linha), mas não é um bundler real — não valida
  sintaxe, não detecta erros de ordem de dependência além da lista manual
  `ESM_ORDER` em `scripts/build.js`. Se `src/` crescer ou passar a usar
  sintaxe ES2020+ mais exótica, esse script precisa ser reescrito ou
  substituído.
- **`marked` embutido via leitura direta de `node_modules`.** O build lê
  `node_modules/marked/lib/marked.umd.js` diretamente (path hardcoded para a
  v18.x atual). Um bump de versão do `marked` que mude a estrutura interna
  de pastas do pacote quebraria o build silenciosamente (só o `console.warn`
  de "not found" alertaria, não uma falha hard).
- **`design:lint` é heurístico, não AST-based.** Extração de cor via regex
  sobre CSS/HTML/JS — o próprio README admite "hash-prefixed IDs or
  dynamically-generated colors can produce false positives". Aceito como
  trade-off (rápido, sem dependência de parser CSS/JS real), mas é uma
  limitação conhecida, não um bug a corrigir.
- **`server/server.js` (shim legado)** mantido só por compatibilidade com
  quem ainda copia o arquivo manualmente (fluxo pré-1.2.0). Não teve testes
  dedicados adicionados quando o fluxo programático (`startServer`/
  `buildApp`) ganhou toda a cobertura em `server.test.js`.

## Áreas frágeis

- **`scripts/build.js` — ninguém deveria mexer sem rodar `test/build.test.js`
  logo em seguida.** É o único lugar onde um regex mal ajustado corrompe
  silenciosamente o artefato publicado (já aconteceu uma vez, real, descrito
  no ROADMAP.md). A ordem de concatenação (`ESM_ORDER`) e o tratamento
  especial do `marked` (nunca passa pelo minificador) são acoplamentos
  implícitos que não estão documentados em nenhum outro lugar além dos
  comentários inline do próprio arquivo.
- **`lib/patch.js` (patch cirúrgico exato + fuzzy) e `lib/design-tokens.js`
  (extração/enforcement de paleta)** são citados no próprio `ROADMAP.md` como
  "the two most-tested, most load-bearing new modules from 1.4.0. Read their
  doc comments before touching palette logic or save patching." — ou seja,
  o autor original já sinalizou esses dois como sensíveis o suficiente para
  merecer um aviso formal a uma sessão futura. Mudanças aqui afetam
  diretamente a integridade do arquivo-fonte do usuário (patch aplicado
  errado = corrupção de código real) e a confiabilidade do enforcement de
  design system.
- **Detecção de framework fonte em `src/core.js` (`getSourceInfo`)** depende
  de internals não documentados/não estáveis de React (`fiber._debugSource`,
  chave `__reactFiber$...`) e Vue (`__vueParentComponent`). Isso é
  inerentemente frágil a mudanças de versão major do React/Vue (o próprio
  código comenta "React dev builds ≤18" — sugerindo que já não é garantido
  para React 19+). Sem teste automatizado algum sobre essa função (ver
  TESTING.md), uma quebra só apareceria como handoff manifest vazio/errado
  em uso real.
- **Caminho de "source-mapping para saves em frameworks"** (mencionado no
  ROADMAP.md como "Not started", maior esforço identificado na revisão
  original: um plugin Vite/Babel para marcar `data-ai-source` em dev,
  ao estilo Onlook) é a lacuna arquitetural mais significativa do projeto —
  hoje o handoff para React/Vue é manual (arquivo markdown para um agente de
  IA aplicar), não um save direto. Ninguém começou essa frente ainda; é o
  item mais citado como "biggest lift, biggest reward" e mais adiado.
