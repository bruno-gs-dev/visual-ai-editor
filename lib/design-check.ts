/**
 * visual-ai-editor — DESIGN.md discovery + checklist
 *
 * Used by:
 *   - bin/cli.js (`design:check`, `design:init`)
 *   - scripts/postinstall.js (Milestone 1, silent check on install)
 */

var fs = require('fs');
var path = require('path');
var childProcess = require('child_process');

var IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', '.next', '.cache', 'coverage'];

// Topic-based (not literal-heading) matchers — real DESIGN.md files vary in
// language (PT/EN) and heading level, so we search the whole content for
// concepts, not a specific "### 1. Visão Geral" string.
var SECTIONS = [
  { key: 'overview', label: 'Visão Geral', pattern: /vis[ãa]o geral|overview/i },
  { key: 'principles', label: 'Princípios de Design', pattern: /princ[íi]pios|design principles/i },
  { key: 'colors', label: 'Paleta de Cores', pattern: /(paleta de cores|colors?\b).*[\s\S]{0,400}#[0-9a-f]{3,8}|#[0-9a-f]{3,8}[\s\S]{0,400}(paleta de cores|colors?\b)/i },
  { key: 'typography', label: 'Tipografia', pattern: /tipografia|typography/i },
  { key: 'spacing', label: 'Espaçamentos', pattern: /espaçamentos|spacing/i },
  { key: 'elevation', label: 'Bordas, Raios e Sombras', pattern: /sombras?|shadows?|elevation|border-radius|raios|rounded/i },
  { key: 'layout', label: 'Layout e Grid', pattern: /layout|grid|breakpoint/i },
  { key: 'components', label: 'Componentes', pattern: /componentes|components?/i },
  { key: 'accessibility', label: 'Acessibilidade', pattern: /acessibilidade|accessibility|a11y/i },
  { key: 'ai-rules', label: 'Regras Específicas para IA', pattern: /regras[\s\S]{0,20}(ia|ai)\b|ai[\s-]?specific rules|rules for ai/i },
  { key: 'prompts', label: 'Exemplos de Prompts', pattern: /exemplos? de prompts?|example prompts?/i }
];

function findDesignMd(cwd){
  var viaRipgrep = findWithRipgrep(cwd);
  if (viaRipgrep !== undefined) return viaRipgrep; // null = ripgrep ran and found nothing; trust it

  return walkForDesignMd(cwd);
}

function findWithRipgrep(cwd){
  try {
    // execFileSync avoids shell interpolation entirely (no injection surface).
    var out = childProcess.execFileSync('rg', [
      '--files', '--max-depth', '6', '-g', 'DESIGN.md',
      '-g', '!node_modules/**', '-g', '!.git/**', '-g', '!dist/**', '-g', '!build/**'
    ], { cwd: cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();

    if (!out) return null;
    var first = out.split(/\r?\n/)[0];
    return path.resolve(cwd, first);
  } catch (e) {
    return undefined; // ripgrep missing or failed — signal "unknown", caller falls back
  }
}

function walkForDesignMd(root){
  var maxDepth = 6;
  var queue = [{ dir: root, depth: 0 }];

  while (queue.length){
    var item = queue.shift();
    var entries;
    try { entries = fs.readdirSync(item.dir, { withFileTypes: true }); }
    catch (e) { continue; }

    for (var i = 0; i < entries.length; i++){
      if (entries[i].isFile() && entries[i].name === 'DESIGN.md'){
        return path.join(item.dir, entries[i].name);
      }
    }
    if (item.depth >= maxDepth) continue;

    for (var j = 0; j < entries.length; j++){
      var entry = entries[j];
      if (!entry.isDirectory()) continue;
      if (entry.name.charAt(0) === '.') continue;
      if (IGNORE_DIRS.indexOf(entry.name) !== -1) continue;
      queue.push({ dir: path.join(item.dir, entry.name), depth: item.depth + 1 });
    }
  }
  return null;
}

function checkSections(content){
  return SECTIONS.map(function(section){
    return { key: section.key, label: section.label, found: section.pattern.test(content) };
  });
}

function formatReport(designMdPath, content){
  var results = checkSections(content);
  var lines = [];
  lines.push('[visual-ai-editor] DESIGN.md encontrado em: ' + designMdPath);
  lines.push('');
  results.forEach(function(r){
    lines.push((r.found ? '  ✓ ' : '  ✗ ') + r.label);
  });
  var missing = results.filter(function(r){ return !r.found; });
  lines.push('');
  if (missing.length === 0){
    lines.push('Cobertura completa — todas as 11 seções recomendadas foram encontradas.');
  } else {
    lines.push(missing.length + ' de 11 seções não foram encontradas (checagem heurística — pode haver falso negativo).');
    lines.push('Rode "npx visual-ai-editor design:init" para gerar um prompt guiado e completar as seções faltantes.');
  }
  return lines.join('\n');
}

module.exports = {
  SECTIONS: SECTIONS,
  findDesignMd: findDesignMd,
  checkSections: checkSections,
  formatReport: formatReport
};
