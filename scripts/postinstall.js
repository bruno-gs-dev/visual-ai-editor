/**
 * visual-ai-editor postinstall
 *
 * Best-effort, never fails `npm install`: everything here is wrapped so any
 * error just gets swallowed (with a console.warn) instead of aborting the
 * consumer's install.
 *
 * What it does:
 *   - Skips entirely when running inside this package's own repo (so
 *     `npm install` here, during development, doesn't warn about itself).
 *   - Delivers/updates AGENTS.md in the consumer project root (idempotent —
 *     see lib/agents-md.js for the merge logic).
 *   - Looks for DESIGN.md in the consumer project. If missing, prints a
 *     one-line nudge to run `npx visual-ai-editor design:init`.
 */

function main(){
  var path = require('path');
  var PKG_ROOT = path.join(__dirname, '..');

  var projectRoot = process.env.INIT_CWD || process.cwd();

  // Running inside the lib's own repo (e.g. `npm install` for local dev) — skip.
  if (path.resolve(projectRoot) === path.resolve(PKG_ROOT)) return;

  try {
    var installAgentsMd = require('../lib/agents-md.js').installAgentsMd;
    var result = installAgentsMd(projectRoot);
    if (result.action === 'created'){
      console.log('[visual-ai-editor] AGENTS.md criado em ' + result.path + ' (guia para agentes de IA).');
    } else if (result.action === 'appended' || result.action === 'updated'){
      console.log('[visual-ai-editor] AGENTS.md atualizado em ' + result.path + '.');
    }
  } catch (e) {
    console.warn('[visual-ai-editor] Não foi possível instalar AGENTS.md (não crítico): ' + (e && e.message));
  }

  var designCheck = require('../lib/design-check.js');
  var found = designCheck.findDesignMd(projectRoot);

  console.log('');
  console.log('[visual-ai-editor] Pronto! Para começar:  npx visual-ai-editor start');
  console.log('[visual-ai-editor] (primeira execução abre o config interativo — escolha um provider e chave)');
  if (!found){
    console.log('[visual-ai-editor] Opcional: "npx visual-ai-editor design:init" gera um prompt guiado');
    console.log('[visual-ai-editor] de DESIGN.md e melhora a precisão das edições feitas pela IA.');
  }
  console.log('');
}

try {
  main();
} catch (e) {
  // Never break `npm install` because of this.
  console.warn('[visual-ai-editor] postinstall check falhou (não crítico): ' + (e && e.message));
}
