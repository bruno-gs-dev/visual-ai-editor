/**
 * visual-ai-editor build script
 * Zero external dependencies — uses only Node.js stdlib
 *
 * Generates:
 *   dist/ai-editor.esm.js     (ES modules — import)
 *   dist/ai-editor.js         (UMD — window.AIEditor)
 *   dist/ai-editor.min.js     (minified UMD)
 *   dist/ai-editor.css        (plain CSS — link fallback)
 *   dist/ai-editor.css.js     (ESM — embedded CSS string, auto-injected)
 *   dist/ai-editor.css.umd.js (UMD — assigns AIEditor.css for <script> users)
 */

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..');
var SRC = path.join(ROOT, 'src');
var DIST = path.join(ROOT, 'dist');
var STYLES = path.join(ROOT, 'styles');

if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });

// --- -1. Read marked's UMD bundle (embedded so consumers don't need their own
// install for the DESIGN.md viewer to render real markdown — see ROADMAP.md).
// It's a self-contained, self-executing UMD file: in a browser (script tag or
// ESM import) it has no `module`/`exports`/AMD `define` to detect, so it falls
// through to `globalThis.marked = f()` — a true global, which is exactly what
// `typeof marked !== 'undefined'` in src/actions.js already checks for. Embed
// it completely verbatim (no stripImports* — it's not our module syntax).

var markedUmdPath = path.join(ROOT, 'node_modules', 'marked', 'lib', 'marked.umd.js');
var markedSrc = '';
if (fs.existsSync(markedUmdPath)){
  var markedPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', 'marked', 'package.json'), 'utf8'));
  markedSrc = '// --- marked v' + markedPkg.version + ' (bundled, MIT license — https://github.com/markedjs/marked) ---\n' +
    fs.readFileSync(markedUmdPath, 'utf8') + '\n';
  console.log('[build] embedding marked v' + markedPkg.version + ' (' + markedSrc.length + ' bytes)');
} else {
  console.warn('[build] node_modules/marked not found — run `npm install` (devDependency).');
  console.warn('[build] Building WITHOUT bundled marked — the DESIGN.md viewer will fall back to a <pre> dump.');
}

// --- 0. Read source CSS (needed by both ESM and UMD bundles) ---

var cssSrc = path.join(STYLES, 'ai-editor.css');
var cssDist = path.join(DIST, 'ai-editor.css');
var cssContent = '';
if (fs.existsSync(cssSrc)){
  cssContent = fs.readFileSync(cssSrc, 'utf8');
  fs.copyFileSync(cssSrc, cssDist);
  console.log('[build] dist/ai-editor.css');
} else {
  console.warn('[build] styles/ai-editor.css not found, skipping CSS copy');
}

function escapeForTemplateLiteral(s){
  return s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

var injectedCssTemplate = 'var __EMBEDDED_CSS__ = `' + escapeForTemplateLiteral(cssContent) + '`;';

// --- 1. Generate ESM bundle ---

var ESM_ORDER = ['core.js', 'i18n.js', 'tools.js', 'selection.js', 'actions.js', 'ui.js'];

var esmParts = [];
esmParts.push('// visual-ai-editor — ESM bundle');
esmParts.push('// https://github.com/bruno/visual-ai-editor');
esmParts.push('');

ESM_ORDER.forEach(function(file){
  var content = fs.readFileSync(path.join(SRC, file), 'utf8');
  esmParts.push('// --- ' + file + ' ---');
  esmParts.push(stripImports(content));
  esmParts.push('');
});

var indexSrc = fs.readFileSync(path.join(SRC, 'index.js'), 'utf8');
indexSrc = stripImports(indexSrc).replace('// __INJECT_CSS__', injectedCssTemplate);

esmParts.push('// --- index.js ---');
esmParts.push(indexSrc);
esmParts.push('');

// marked is prepended as an independent top-level statement (not nested inside
// our own code) — it's a self-invoking IIFE that sets a global on its own;
// keeping it outside our own bundle's string also means it's easy to exclude
// from the crude regex-based minifier below (running that over marked's
// already-minified, regex-heavy source would corrupt it).
var esmCode = (markedSrc ? markedSrc + '\n' : '') + esmParts.join('\n');
fs.writeFileSync(path.join(DIST, 'ai-editor.esm.js'), esmCode, 'utf8');
console.log('[build] dist/ai-editor.esm.js (' + esmCode.length + ' bytes)');

// --- 2. Generate UMD bundle ---

function stripImports(code){
  return code
    .replace(/^import\s+\{[^}]*\}\s+from\s+['"][^'"]*['"];\s*$/gm, '')
    .replace(/^import\s+\w+\s+from\s+['"][^'"]*['"];\s*$/gm, '')
    .replace(/^import\s+['"][^'"]*['"];\s*$/gm, '');
}

function stripImportsExports(code){
  return stripImports(code)
    .replace(/^export\s+default\s+/gm, '')
    .replace(/^export\s+var\s+/gm, 'var ')
    .replace(/^export\s+function\s+/gm, 'function ')
    .replace(/^export\s+const\s+/gm, 'const ');
}

var umdParts = [];
umdParts.push('// visual-ai-editor — UMD bundle');
umdParts.push('(function(root, factory){');
umdParts.push('  if(typeof define==="function"&&define.amd){define([],factory)}');
umdParts.push('  else if(typeof module==="object"&&module.exports){module.exports=factory()}');
umdParts.push('  else{root.AIEditor=factory()}');
umdParts.push('}(typeof self!=="undefined"?self:this,function(){');
umdParts.push('');

ESM_ORDER.forEach(function(file){
  var content = fs.readFileSync(path.join(SRC, file), 'utf8');
  umdParts.push('// --- ' + file + ' ---');
  umdParts.push(stripImportsExports(content));
  umdParts.push('');
});

var umdIndexSrc = fs.readFileSync(path.join(SRC, 'index.js'), 'utf8');
umdIndexSrc = stripImportsExports(umdIndexSrc).replace('// __INJECT_CSS__', injectedCssTemplate);
umdParts.push('// --- index.js ---');
umdParts.push(umdIndexSrc);
umdParts.push('');

umdParts.push('return AI;');
umdParts.push('}));');

// marked prepended as an independent top-level statement — see the comment
// on esmCode above for why (also keeps it out of the minifier's way below).
var ownUmdCode = umdParts.join('\n');
var umdCode = (markedSrc ? markedSrc + '\n' : '') + ownUmdCode;

fs.writeFileSync(path.join(DIST, 'ai-editor.js'), umdCode, 'utf8');
console.log('[build] dist/ai-editor.js (' + umdCode.length + ' bytes)');

// --- 3. Standalone ESM/UMD CSS modules (for `<script src=...>` users who want separate CSS file) ---

var cssEsm = '// visual-ai-editor — embedded CSS (standalone ESM)\n' +
  'export default `' + escapeForTemplateLiteral(cssContent) + '`;\n';

var cssUmdStandalone = '// visual-ai-editor — embedded CSS (standalone UMD)\n' +
  '(function(root){\n' +
  '  if (root.AIEditor) root.AIEditor.css = ' + JSON.stringify(cssContent) + ';\n' +
  '})(typeof self!=="undefined"?self:this);\n';

fs.writeFileSync(path.join(DIST, 'ai-editor.css.js'), cssEsm, 'utf8');
fs.writeFileSync(path.join(DIST, 'ai-editor.css.umd.js'), cssUmdStandalone, 'utf8');
console.log('[build] dist/ai-editor.css.js + dist/ai-editor.css.umd.js');

// --- 4. Minify (basic) ---

function basicMinify(code){
  return code
    // Strip line comments, but not "//" inside a string literal like a URL
    // scheme ("http://...") — those are always immediately preceded by ":",
    // which a real line comment marker never is in our own hand-formatted code.
    .replace(/(?<!:)\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}();,=:+\-<>!&|?])\s*/g, '$1')
    .trim();
}

// Only our own code goes through the crude regex minifier — marked ships
// already minified, and this minifier doesn't understand JS syntax (strings,
// regex literals) well enough to run over dense third-party code safely.
var minCode = (markedSrc ? markedSrc + '\n' : '') + basicMinify(ownUmdCode);
fs.writeFileSync(path.join(DIST, 'ai-editor.min.js'), minCode, 'utf8');
console.log('[build] dist/ai-editor.min.js (' + minCode.length + ' bytes)');

console.log('[build] Done!');
