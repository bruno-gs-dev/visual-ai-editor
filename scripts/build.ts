import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const STYLES = path.join(ROOT, 'styles');

if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });

// 1. CSS
const cssPath = path.join(STYLES, 'ai-editor.css');
const cssContent = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
if (cssContent) fs.copyFileSync(cssPath, path.join(DIST, 'ai-editor.css'));
const cssDefine: Record<string, string> = { __EMBEDDED_CSS__: JSON.stringify(cssContent) };

// 2. Embed marked (UMD bundle, sets globalThis.marked)
const markedPath = path.join(ROOT, 'node_modules', 'marked', 'lib', 'marked.umd.js');
let markedSrc = '';
if (fs.existsSync(markedPath)) {
  const markedPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', 'marked', 'package.json'), 'utf8'));
  markedSrc = `// --- marked v${markedPkg.version} (bundled, MIT license) ---\n${fs.readFileSync(markedPath, 'utf8')}\n`;
}

const sharedOptions: esbuild.BuildOptions = {
  entryPoints: [path.join(SRC, 'index.ts')],
  bundle: true,
  define: cssDefine,
  banner: { js: markedSrc },
  logLevel: 'info',
};

// 3. ESM
esbuild.buildSync({
  ...sharedOptions,
  format: 'esm',
  outfile: path.join(DIST, 'ai-editor.esm.js'),
});

// 4. UMD (IIFE)
esbuild.buildSync({
  ...sharedOptions,
  format: 'iife',
  globalName: 'AIEditor',
  outfile: path.join(DIST, 'ai-editor.js'),
});

// 5. Minified UMD
esbuild.buildSync({
  ...sharedOptions,
  format: 'iife',
  globalName: 'AIEditor',
  outfile: path.join(DIST, 'ai-editor.min.js'),
  minify: true,
});

// 6. CSS standalone modules
fs.writeFileSync(path.join(DIST, 'ai-editor.css.js'), `export default ${JSON.stringify(cssContent)};\n`);
fs.writeFileSync(path.join(DIST, 'ai-editor.css.umd.js'), `(function(root){if(root.AIEditor)root.AIEditor.css=${JSON.stringify(cssContent)};})(typeof self!=="undefined"?self:this);\n`);
