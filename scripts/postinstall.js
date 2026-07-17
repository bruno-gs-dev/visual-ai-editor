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
 *   - Looks for DESIGN.md in the consumer project. If missing, prints a
 *     one-line nudge to run `npx visual-ai-editor design:init`.
 */

function main(){
  var path = require('path');
  var PKG_ROOT = path.join(__dirname, '..');

  var projectRoot = process.env.INIT_CWD || process.cwd();

  // Running inside the lib's own repo (e.g. `npm install` for local dev) — skip.
  if (path.resolve(projectRoot) === path.resolve(PKG_ROOT)) return;

  var designCheck = require('../lib/design-check.js');
  var found = designCheck.findDesignMd(projectRoot);

  if (!found){
    console.log('');
    console.log('[visual-ai-editor] Nenhum DESIGN.md encontrado neste projeto.');
    console.log('[visual-ai-editor] Rode "npx visual-ai-editor design:init" para gerar um prompt');
    console.log('[visual-ai-editor] guiado e melhorar a precisão das edições feitas pela IA.');
    console.log('');
  }
}

try {
  main();
} catch (e) {
  // Never break `npm install` because of this.
  console.warn('[visual-ai-editor] postinstall check falhou (não crítico): ' + (e && e.message));
}
