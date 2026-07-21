var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var DIST = path.join(__dirname, '..', 'dist');

/** Run a dist file in a sandbox with no module/exports/AMD define — simulates a <script> tag in a browser. */
function runInBrowserSandbox(file){
  var sandbox = { console: console };
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  var code = fs.readFileSync(path.join(DIST, file), 'utf8');
  vm.runInContext(code, sandbox);
  return sandbox;
}

['ai-editor.js', 'ai-editor.min.js'].forEach(function(file){
  test('dist/' + file + ' embeds a working `marked` global alongside AIEditor', function(){
    var sandbox = runInBrowserSandbox(file);
    assert.equal(typeof sandbox.marked, 'object');
    assert.equal(typeof sandbox.marked.parse, 'function');
    assert.match(sandbox.marked.parse('# Title\n\nSome **bold** text.'), /<h1>Title<\/h1>/);
    assert.equal(typeof sandbox.AIEditor, 'object');
    assert.equal(typeof sandbox.AIEditor.init, 'function');
  });
});

test('dist/ai-editor.esm.js contains marked source (sets a global when evaluated)', function(){
  var esm = fs.readFileSync(path.join(DIST, 'ai-editor.esm.js'), 'utf8');
  assert.match(esm, /marked v[\d.]+ \(bundled/);
  assert.match(esm, /export \{/);
});

test('dist/ai-editor.min.js did not corrupt string literals containing "://"', function(){
  var min = fs.readFileSync(path.join(DIST, 'ai-editor.min.js'), 'utf8');
  assert.match(min, /SVG_NS:["']http:\/\/www\.w3\.org\/2000\/svg["']/);
});
