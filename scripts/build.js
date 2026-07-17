/**
 * visual-ai-editor build script
 * Zero external dependencies — uses only Node.js stdlib
 *
 * Generates:
 *   dist/ai-editor.esm.js   (ES modules)
 *   dist/ai-editor.js       (UMD — window.AIEditor)
 *   dist/ai-editor.min.js   (minified UMD)
 *   dist/ai-editor.css      (copied from styles/)
 */

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..');
var SRC = path.join(ROOT, 'src');
var DIST = path.join(ROOT, 'dist');
var STYLES = path.join(ROOT, 'styles');

if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });

// --- 1. Generate ESM bundle ---

var ESM_ORDER = ['core.js', 'tools.js', 'selection.js', 'actions.js', 'ui.js'];

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

esmParts.push('// --- index.js ---');
esmParts.push('export default AI;');
esmParts.push('export var init = AI.init;');
esmParts.push('export var destroy = AI.destroy;');
esmParts.push('export var setTool = AI.setTool;');
esmParts.push('export var selectElements = AI.selectElements;');
esmParts.push('');

var esmCode = esmParts.join('\n');
fs.writeFileSync(path.join(DIST, 'ai-editor.esm.js'), esmCode, 'utf8');
console.log('[build] dist/ai-editor.esm.js (' + esmCode.length + ' bytes)');

// --- 2. Generate UMD bundle ---

function stripImports(code){
  return code
    .replace(/^import\s+\{[^}]*\}\s+from\s+['"][^'"]*['"];\s*$/gm, '')
    .replace(/^import\s+\w+\s+from\s+['"][^'"]*['"];\s*$/gm, '');
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

umdParts.push('return AI;');
umdParts.push('}));');

var umdCode = umdParts.join('\n');

fs.writeFileSync(path.join(DIST, 'ai-editor.js'), umdCode, 'utf8');
console.log('[build] dist/ai-editor.js (' + umdCode.length + ' bytes)');

// --- 3. Copy CSS ---

var cssSrc = path.join(STYLES, 'ai-editor.css');
var cssDist = path.join(DIST, 'ai-editor.css');
if (fs.existsSync(cssSrc)){
  fs.copyFileSync(cssSrc, cssDist);
  console.log('[build] dist/ai-editor.css');
} else {
  console.warn('[build] styles/ai-editor.css not found, skipping CSS copy');
}

// --- 4. Minify (basic) ---

function basicMinify(code){
  return code
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}();,=:+\-<>!&|?])\s*/g, '$1')
    .trim();
}

var minCode = basicMinify(umdCode);
fs.writeFileSync(path.join(DIST, 'ai-editor.min.js'), minCode, 'utf8');
console.log('[build] dist/ai-editor.min.js (' + minCode.length + ' bytes)');

console.log('[build] Done!');
