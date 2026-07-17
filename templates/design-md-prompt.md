<!--
  visual-ai-editor — DESIGN.md prompt template
  Fonte: metodologia de https://camaraux.com.br/como-criar-aplicar-design-md-ia/

  Este arquivo é a fonte única do texto usado por:
    - `npx visual-ai-editor design:init` (gera DESIGN.prompt.md no projeto consumidor)
    - o checklist de `npx visual-ai-editor design:check` (as 11 seções abaixo)
    - o "REGRAS" do system prompt em server/index.js (mesma lista, resumida)

  Não é executado como código — é um documento que o usuário cola em um agente
  de IA (Claude Code, Cursor, etc.) para gerar o DESIGN.md do próprio projeto.
-->

# Prompt: criar o DESIGN.md deste projeto

Você é um agente de IA ajudando a criar o arquivo `DESIGN.md` na raiz deste
projeto. Esse arquivo é lido automaticamente pelo `visual-ai-editor` (via
`GET /api/design`) e injetado no prompt da IA toda vez que alguém edita um
elemento visualmente — ele é o que impede a IA de inventar cores, espaçamentos
ou componentes fora do sistema de design do projeto.

Siga o processo abaixo em duas etapas: **entrevista** primeiro, **geração**
depois. Não pule a entrevista — um DESIGN.md genérico ("cores modernas",
"design limpo") não serve para nada, o objetivo é ser específico o suficiente
para outra IA seguir sem ambiguidade.

## Etapa 1 — Entrevista

Faça estas perguntas ao usuário antes de escrever qualquer coisa (pule as que já
puderem ser respondidas olhando o código/CSS existente no projeto):

1. **Personalidade visual** — a interface deve parecer moderna, técnica,
   editorial, premium ou acessível? (pode ser uma combinação)
2. **Referências** — quais marcas, produtos ou estilos visuais influenciam este
   projeto? (ex: "Linear + Stripe", "Material Design", "Notion")
3. **Sensação desejada** — que experiência o usuário deve sentir ao usar a
   interface? (confiança, velocidade, calma, autoridade, diversão...)
4. **Tipo de produto** — é um SaaS, marketplace, app mobile, fintech,
   plataforma de IA, painel administrativo, site institucional?
5. **Prioridades** — em ordem, o que importa mais: conversão, clareza,
   densidade de informação ou acessibilidade?

Se o projeto já tem HTML/CSS existente (como geralmente é o caso quando o
`visual-ai-editor` já está instalado), **extraia os tokens reais do código**
(cores em uso, fontes carregadas, espaçamentos, radius) em vez de inventar
valores novos — o DESIGN.md deve documentar o que já existe, não redesenhar o
projeto do zero, a menos que o usuário peça isso explicitamente.

## Etapa 2 — Estrutura do DESIGN.md (11 seções obrigatórias)

Gere o arquivo com exatamente estas seções, nesta ordem. Cada seção deve ser
concreta — valores, códigos hex, tamanhos em px/rem — nunca apenas adjetivos.

### 1. Visão Geral
Descreva a sensação visual da interface de forma concreta. Evite termos
genéricos como "moderno" ou "bonito" sem explicar o que isso significa em
termos visuais (cores, densidade, tipografia, formas).

### 2. Princípios de Design
Regras comportamentais de alto nível, ex: "clareza antes de decoração", "cada
componente deve ter função evidente", "hierarquia visual sempre clara".

### 3. Paleta de Cores
Cores primárias, neutras e de estado (sucesso/erro/aviso/info), cada uma com
código hex e regra de quando usar. Inclua regra de contraste mínimo.

### 4. Tipografia
Família de fonte (com fallbacks), e escala hierárquica completa: Display, H1,
H2, H3, Body, Caption/Label — cada nível com tamanho, peso e line-height.

### 5. Espaçamentos
Escala em múltiplos de 4px: 4, 8, 12, 16, 24, 32, 48, 80px — com indicação de
uso para cada valor (ex: "8px = gap entre ícone e label").

### 6. Bordas, Raios e Sombras
Radius nomeados (ex: small 6px, medium 12px, large 20px, pill 999px) e níveis
de sombra com regra de quando cada um se aplica (elevação em repouso vs hover).

### 7. Layout e Grid
Max-width do conteúdo (ex: 1200px desktop), padding de página, número de
colunas por breakpoint (ex: 12 desktop, 8 tablet, 4 mobile).

### 8. Componentes
Para cada componente relevante do projeto (botão, card, input, modal, badge,
tabela, etc.): aparência e **todos os estados** — hover, focus, active,
disabled, loading, error.

### 9. Acessibilidade
Contraste mínimo exigido, foco sempre visível, nunca depender só de cor para
transmitir estado, navegação completa por teclado, alvo de toque mínimo
(44x44px), texto alternativo em imagens/ícones funcionais.

### 10. Regras Específicas para IA
Instruções diretas que qualquer IA editando este projeto deve seguir:
- Não inventar cores, fontes ou espaçamentos fora do documentado aqui.
- Sempre seguir os tokens definidos (cores, tipografia, espaçamentos) com
  exatidão — não aproximar valores.
- Priorizar reuso de componentes/classes já existentes antes de criar novos.
- Preservar a hierarquia visual da tela ao fazer qualquer alteração.
- Adaptar responsivamente a qualquer mudança para os breakpoints definidos.
- Garantir acessibilidade em qualquer novo estado ou componente.
- Evitar efeitos visuais (glow, gradientes decorativos, blur) que não estejam
  documentados aqui.

### 11. Exemplos de Prompts
2-3 exemplos de instruções que um usuário poderia dar ao editor visual, e como
a IA deveria responder mantendo consistência com este documento. Ex:
> "deixe esse botão mais chamativo" → aumentar peso/contraste dentro da
> paleta documentada, nunca introduzir uma cor nova fora dela.

## Etapa 3 — Checklist de validação (rode antes de salvar)

Antes de considerar o `DESIGN.md` pronto, confirme:

- [ ] O objetivo visual está claro e específico (não genérico)?
- [ ] Cores têm nome, código hex e uso definidos?
- [ ] Tipografia possui escala completa com hierarquia (Display → Caption)?
- [ ] Espaçamentos seguem lógica de múltiplos (4px)?
- [ ] Componentes documentam todos os estados (hover/focus/active/disabled/
      loading/error)?
- [ ] Existem regras específicas para comportamento responsivo/mobile?
- [ ] Acessibilidade está integrada como padrão, não como nota de rodapé?
- [ ] As regras para IA são claras, diretas e objetivas?
- [ ] Há exemplos de prompt que demonstram a aplicação prática das regras?
- [ ] O arquivo é legível tanto por humanos quanto por outra IA (Markdown
      limpo, sem ambiguidade)?

## Etapa 4 — Salvar

Salve o resultado como `DESIGN.md` na raiz deste projeto (mesmo diretório do
`index.html`/`package.json`). Assim que o arquivo existir, o `visual-ai-editor`
passa a carregá-lo automaticamente e aplicá-lo em toda edição feita pelo editor
visual — nenhuma configuração adicional é necessária.
