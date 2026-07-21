#!/usr/bin/env bash
#
# visual-ai-editor — release workflow
#
# Automates the full release: pre-flight checks → version bump → CHANGELOG →
# commit/push → safe-guard audit → build & publish → git tag.
#
# Usage:
#   scripts/release.sh [patch|minor|major] [options]
#
# Options:
#   --dry-run          Show every step without writing, committing, pushing or publishing.
#   --skip-tests       Skip `npm test` (not recommended).
#   --skip-safeguard   Skip the safe-guard commit audit.
#   --yes              Assume "yes" for confirmations (non-interactive / CI).
#   -h, --help         Show this help.
#
# Exit codes: 0 ok · 1 pre-flight failure · 2 aborted by user · 3 safe-guard risk found
set -euo pipefail

# --------------------------------------------------------------------------
# Config & argument parsing
# --------------------------------------------------------------------------
PACKAGE_NAME="visual-ai-editor"
MAIN_BRANCH="main"

BUMP="patch"
DRY_RUN=0
SKIP_TESTS=0
SKIP_SAFEGUARD=0
ASSUME_YES=0

for arg in "$@"; do
  case "$arg" in
    patch|minor|major) BUMP="$arg" ;;
    --dry-run)         DRY_RUN=1 ;;
    --skip-tests)      SKIP_TESTS=1 ;;
    --skip-safeguard)  SKIP_SAFEGUARD=1 ;;
    --yes|-y)          ASSUME_YES=1 ;;
    -h|--help)         sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Argumento desconhecido: $arg (use -h)"; exit 1 ;;
  esac
done

# Resolve directories relative to this script so it works from any CWD.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"      # visual-ai-editor/
REPO_ROOT="$(cd "$PKG_DIR/.." && pwd)"       # repo root (holds .claude/)
cd "$PKG_DIR"

# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
c_reset=$'\033[0m'; c_bold=$'\033[1m'; c_green=$'\033[32m'; c_red=$'\033[31m'; c_yellow=$'\033[33m'; c_cyan=$'\033[36m'
step()  { printf '\n%s▸ %s%s\n' "$c_bold$c_cyan" "$1" "$c_reset"; }
ok()    { printf '%s  ✓ %s%s\n' "$c_green" "$1" "$c_reset"; }
warn()  { printf '%s  ! %s%s\n' "$c_yellow" "$1" "$c_reset"; }
die()   { printf '%s  ✗ %s%s\n' "$c_red" "$1" "$c_reset" >&2; exit "${2:-1}"; }

# run CMD — executes it, or just prints it in dry-run mode.
run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '%s  [dry-run] %s%s\n' "$c_yellow" "$*" "$c_reset"
  else
    "$@"
  fi
}

confirm() {
  [ "$ASSUME_YES" -eq 1 ] && return 0
  [ "$DRY_RUN" -eq 1 ] && { warn "(dry-run) confirmação pulada: $1"; return 0; }
  printf '%s  ? %s [y/N] %s' "$c_yellow" "$1" "$c_reset"
  read -r ans
  case "$ans" in y|Y|yes|s|S|sim) return 0 ;; *) return 1 ;; esac
}

printf '%s╔══ release %s ══ bump:%s%s%s%s\n' "$c_bold" "$PACKAGE_NAME" "$BUMP" \
  "$([ "$DRY_RUN" -eq 1 ] && echo ' (DRY-RUN)')" "$c_reset" ""

# --------------------------------------------------------------------------
# 1. Pre-release checks
# --------------------------------------------------------------------------
step "1/6 Pré-release — checagens"

if git -C "$PKG_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  HAS_GIT=1
  branch="$(git rev-parse --abbrev-ref HEAD)"
  [ "$branch" = "$MAIN_BRANCH" ] && ok "branch = $MAIN_BRANCH" \
    || { confirm "Você está em '$branch', não em '$MAIN_BRANCH'. Continuar?" || die "Abortado." 2; }
  if [ -n "$(git status --porcelain)" ]; then
    if [ "$DRY_RUN" -eq 1 ]; then
      warn "working tree sujo — um release real abortaria aqui (dry-run: seguindo)"
    else
      die "working tree sujo — faça commit/stash antes de liberar um release."
    fi
  else
    ok "working tree limpo"
  fi
else
  HAS_GIT=0
  warn "não é um repositório git — etapas de commit/push/tag serão puladas."
fi

if [ "$SKIP_TESTS" -eq 1 ]; then
  warn "testes pulados (--skip-tests)"
else
  step "  Rodando testes"
  npm test >/dev/null 2>&1 && ok "npm test passou" || die "npm test falhou — corrija antes de liberar."
fi

# --------------------------------------------------------------------------
# 2. Versioning
# --------------------------------------------------------------------------
step "2/6 Versionamento"
CUR_VERSION="$(node -p "require('./package.json').version")"
NEXT_VERSION="$(node -e "
  const [maj,min,pat] = require('./package.json').version.split('.').map(Number);
  const b='$BUMP';
  const v = b==='major' ? [maj+1,0,0] : b==='minor' ? [maj,min+1,0] : [maj,min,pat+1];
  console.log(v.join('.'));
")"
ok "versão: $CUR_VERSION → $c_bold$NEXT_VERSION$c_reset"
TAG="v$NEXT_VERSION"

confirm "Liberar $PACKAGE_NAME@$NEXT_VERSION?" || die "Abortado." 2

# Bump package.json (no git tag — we tag ourselves at the end).
run npm version "$NEXT_VERSION" --no-git-tag-version --allow-same-version
ok "package.json atualizado"

# --------------------------------------------------------------------------
# 3. CHANGELOG
# --------------------------------------------------------------------------
step "3/6 CHANGELOG"
TODAY="$(date +%Y-%m-%d)"
CHANGELOG="$PKG_DIR/CHANGELOG.md"
if grep -q "^## $NEXT_VERSION" "$CHANGELOG" 2>/dev/null; then
  ok "CHANGELOG já tem a seção $NEXT_VERSION"
else
  if [ "$DRY_RUN" -eq 1 ]; then
    warn "[dry-run] adicionaria seção '## $NEXT_VERSION ($TODAY)' ao topo do CHANGELOG"
  else
    node -e "
      const fs=require('fs');
      const f='$CHANGELOG';
      const md=fs.existsSync(f)?fs.readFileSync(f,'utf8'):'# Changelog\n';
      const entry='## $NEXT_VERSION ($TODAY)\n\n- _(descreva as mudanças aqui antes de publicar)_\n\n';
      const out=md.replace(/^(# Changelog\s*\n)/, (m)=>m+'\n'+entry);
      fs.writeFileSync(f, out===md ? md.replace(/^/, '# Changelog\n\n'+entry) : out);
    "
    ok "seção $NEXT_VERSION adicionada — ${c_yellow}edite o CHANGELOG antes de publicar${c_reset}"
    confirm "CHANGELOG editado e pronto?" || die "Abortado — edite o CHANGELOG e rode de novo." 2
  fi
fi

# --------------------------------------------------------------------------
# 4. Commit & push
# --------------------------------------------------------------------------
step "4/6 Commit & push"
if [ "$HAS_GIT" -eq 1 ]; then
  run git add package.json CHANGELOG.md
  run git commit -m "release: $TAG"
  run git push origin "$MAIN_BRANCH"
  ok "commit + push"
else
  warn "sem git — pulado"
fi

# --------------------------------------------------------------------------
# 5. Safe-guard audit
# --------------------------------------------------------------------------
step "5/6 Safe-guard — auditoria de risco"
COLLECT="$REPO_ROOT/.claude/skills/safe-guard/scripts/collect.sh"
if [ "$SKIP_SAFEGUARD" -eq 1 ]; then
  warn "safe-guard pulado (--skip-safeguard)"
elif [ "$HAS_GIT" -eq 1 ] && [ -x "$COLLECT" ]; then
  AUDIT_DIR="$PKG_DIR/docs/safe-guard/$TODAY"
  run mkdir -p "$AUDIT_DIR"
  if [ "$DRY_RUN" -eq 1 ]; then
    warn "[dry-run] rodaria: $COLLECT commits 5  →  $AUDIT_DIR/release-$TAG.md"
  else
    bash "$COLLECT" commits 5 > "$AUDIT_DIR/release-$TAG.md" 2>&1 || true
    ok "relatório: docs/safe-guard/$TODAY/release-$TAG.md"
    warn "revise o relatório — se houver risco 🟥, aborte com Ctrl-C"
    confirm "Auditoria ok, seguir para publish?" || die "Abortado após auditoria." 3
  fi
else
  warn "safe-guard indisponível (sem git ou collect.sh não encontrado) — pulado"
fi

# --------------------------------------------------------------------------
# 6. Build & publish
# --------------------------------------------------------------------------
step "6/6 Build & publish"
if node -e "process.exit(require('./package.json').scripts?.build?0:1)"; then
  run npm run build
  ok "build"
else
  warn "sem script build — pulado"
fi

confirm "Publicar no npm agora ($PACKAGE_NAME@$NEXT_VERSION)?" || die "Abortado antes do publish." 2
run npm publish
ok "publicado no npm"

if [ "$HAS_GIT" -eq 1 ]; then
  run git tag "$TAG"
  run git push origin "$TAG"
  ok "tag $TAG"
fi

printf '\n%s✔ Release %s@%s concluído.%s\n' "$c_bold$c_green" "$PACKAGE_NAME" "$NEXT_VERSION" "$c_reset"
