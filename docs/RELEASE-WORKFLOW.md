# Release Workflow

Processo padronizado para liberar uma nova versão do `visual-ai-editor` no npm,
automatizado por [`scripts/release.sh`](../scripts/release.sh) e conduzido pela
skill `release-workflow` no Claude Code.

## Pré-requisitos

- Estar autenticado no npm (`npm whoami` deve retornar seu usuário).
- Repositório git com remote `origin` configurado, na branch `main`.
- Working tree limpo (sem mudanças não commitadas).
- Testes passando (`npm test`).

## Uso

```bash
# Release patch (padrão): 2.0.2 → 2.0.3
scripts/release.sh

# Escolher o tipo de bump
scripts/release.sh minor      # 2.0.2 → 2.1.0
scripts/release.sh major      # 2.0.2 → 3.0.0

# Ensaiar sem escrever/commitar/publicar nada
scripts/release.sh minor --dry-run

# Modo não-interativo (CI)
scripts/release.sh patch --yes
```

| Opção | Efeito |
|-------|--------|
| `patch` \| `minor` \| `major` | Tipo de bump (padrão: `patch`). |
| `--dry-run` | Mostra cada passo sem escrever, commitar, dar push ou publicar. |
| `--skip-tests` | Pula `npm test` (não recomendado). |
| `--skip-safeguard` | Pula a auditoria de risco. |
| `--yes` / `-y` | Assume "sim" em todas as confirmações. |

## Fluxo detalhado

### 1. Pré-release
- Confirma que você está na branch `main` (pede confirmação se não estiver).
- Aborta se o working tree estiver sujo.
- Roda `npm test` — falha interrompe o release.
- Fora de um repositório git, as etapas de commit/push/tag são **puladas** com aviso (o resto do fluxo ainda funciona).

### 2. Versionamento
- Calcula a próxima versão a partir do `package.json` conforme o bump.
- Pede confirmação antes de prosseguir.
- Atualiza o `package.json` com `npm version --no-git-tag-version` (a tag é criada só no fim, após o publish).

### 3. CHANGELOG
- Insere uma seção `## X.Y.Z (YYYY-MM-DD)` no topo do `CHANGELOG.md`, se ainda não existir.
- Pausa para você **editar** o resumo das mudanças antes de continuar.

### 4. Commit & Push
- `git add package.json CHANGELOG.md`
- `git commit -m "release: vX.Y.Z"`
- `git push origin main`

### 5. Safe-guard
- Roda `.claude/skills/safe-guard/scripts/collect.sh commits 5` e grava o relatório em
  `docs/safe-guard/YYYY-MM-DD/release-vX.Y.Z.md`.
- Você revisa: se houver risco 🟥, aborte (o script pede confirmação antes de seguir).

### 6. Build & Publish
- Roda `npm run build` (se o script existir).
- `npm publish` (com confirmação).
- Cria e envia a tag git `vX.Y.Z`.

## Rollback

- **Antes do publish:** basta abortar (Ctrl-C). Reverta o bump com
  `git checkout package.json CHANGELOG.md`.
- **Depois do publish:** o npm não permite republicar a mesma versão. Use
  `npm deprecate visual-ai-editor@X.Y.Z "motivo"` e libere um patch corrigido.
  `npm unpublish` só é permitido nas primeiras 72h e para pacotes sem dependentes —
  evite.
- **Tag git errada:** `git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z`.

## Troubleshooting

| Sintoma | Causa provável | Ação |
|---------|----------------|------|
| `npm test falhou` | Regressão | Corrija e rode de novo. |
| `working tree sujo` | Mudanças pendentes | Commit/stash antes. |
| `403 Forbidden` no publish | Não autenticado / sem permissão | `npm login`; confira acesso ao pacote. |
| `You cannot publish over the previously published versions` | Versão já existe | Faça outro bump. |
| safe-guard "indisponível" | Sem git ou `collect.sh` ausente | Rode dentro do repo git com a skill safe-guard instalada. |
