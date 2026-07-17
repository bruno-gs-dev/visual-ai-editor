var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var os = require('os');
var path = require('path');

var envInit = require('../lib/env-init.js');
var serverLib = require('../server/index.js');

async function withTempDir(fn){
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-editor-test-'));
  try { return await fn(dir); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function listen(app){
  return new Promise(function(resolve){
    var server = app.listen(0, function(){ resolve(server); });
  });
}

function baseUrl(server){
  return 'http://127.0.0.1:' + server.address().port;
}

// ---------------------------------------------------------------------------
// lib/env-init.js
// ---------------------------------------------------------------------------

test('ensureEnvFile creates .env from the template and never overwrites', async function(){
  await withTempDir(async function(dir){
    var first = envInit.ensureEnvFile(dir);
    assert.equal(first.action, 'created');
    var content = fs.readFileSync(first.path, 'utf8');
    assert.match(content, /^AI_API_KEY=$/m);
    assert.match(content, /#AI_ENDPOINT=http:\/\/localhost:11434/);

    fs.writeFileSync(first.path, 'AI_API_KEY=my-real-key\n', 'utf8');
    var second = envInit.ensureEnvFile(dir);
    assert.equal(second.action, 'exists');
    assert.equal(fs.readFileSync(first.path, 'utf8'), 'AI_API_KEY=my-real-key\n');
  });
});

test('ensureGitignore creates, appends, and leaves covered files alone', async function(){
  await withTempDir(async function(dir){
    assert.equal(envInit.ensureGitignore(dir).action, 'created');
    assert.equal(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), '.env\n');
    assert.equal(envInit.ensureGitignore(dir).action, 'unchanged');

    fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules');
    assert.equal(envInit.ensureGitignore(dir).action, 'appended');
    assert.equal(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), 'node_modules\n.env\n');

    fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules\n.env*\n');
    assert.equal(envInit.ensureGitignore(dir).action, 'unchanged');
  });
});

test('checkApiKey: placeholder keys fail, real keys pass, local endpoints skip the check', function(){
  assert.equal(envInit.checkApiKey({}).ok, false);
  assert.equal(envInit.checkApiKey({ AI_API_KEY: '' }).ok, false);
  assert.equal(envInit.checkApiKey({ AI_API_KEY: 'your_key_here' }).ok, false);
  assert.equal(envInit.checkApiKey({ AI_API_KEY: 'gsk_real' }).ok, true);
  assert.equal(envInit.checkApiKey({ GROQ_API_KEY: 'gsk_legacy' }).ok, true);
  assert.equal(envInit.checkApiKey({ AI_ENDPOINT: 'http://localhost:11434/v1/chat/completions' }).ok, true);
  assert.equal(envInit.checkApiKey({ AI_ENDPOINT: 'https://api.openai.com/v1/chat/completions' }).ok, false);
});

// ---------------------------------------------------------------------------
// Client auto-injection (server inject option)
// ---------------------------------------------------------------------------

var PAGE = '<!doctype html><html><head><title>t</title></head><body><h1>hi</h1></body></html>';

function buildInjectingApp(dir, extra){
  var opts = { staticDir: dir, silent: true, inject: true };
  if (extra) Object.keys(extra).forEach(function(k){ opts[k] = extra[k]; });
  return serverLib.buildApp(opts);
}

test('inject:true injects the editor module script before </body>', async function(){
  await withTempDir(async function(dir){
    fs.writeFileSync(path.join(dir, 'index.html'), PAGE, 'utf8');
    var server = await listen(buildInjectingApp(dir));
    try {
      var html = await (await fetch(baseUrl(server) + '/')).text();
      assert.match(html, /data-ai-editor-injected/);
      assert.match(html, /\/__ai-editor\/ai-editor\.esm\.js/);
      assert.ok(html.indexOf('</body>') > html.indexOf('data-ai-editor-injected'), 'script goes before </body>');
      assert.ok(!/apiToken/.test(html), 'no apiToken in init when server has none');
    } finally { server.close(); }
  });
});

test('injection resolves extensionless paths and named pages', async function(){
  await withTempDir(async function(dir){
    fs.writeFileSync(path.join(dir, 'about.html'), PAGE, 'utf8');
    var server = await listen(buildInjectingApp(dir));
    try {
      var htmlByName = await (await fetch(baseUrl(server) + '/about.html')).text();
      var htmlNoExt = await (await fetch(baseUrl(server) + '/about')).text();
      assert.match(htmlByName, /data-ai-editor-injected/);
      assert.match(htmlNoExt, /data-ai-editor-injected/);
    } finally { server.close(); }
  });
});

test('injection appends to fragment pages without </body>', async function(){
  await withTempDir(async function(dir){
    fs.writeFileSync(path.join(dir, 'index.html'), '<h1>fragment only</h1>', 'utf8');
    var server = await listen(buildInjectingApp(dir));
    try {
      var html = await (await fetch(baseUrl(server) + '/')).text();
      assert.match(html, /<h1>fragment only<\/h1>[\s\S]*data-ai-editor-injected/);
    } finally { server.close(); }
  });
});

test('injection skips pages that already wire the editor or opted out', async function(){
  var manual = '<html><body><script type="module">import { init } from "./node_modules/visual-ai-editor/dist/ai-editor.esm.js"; init();</script></body></html>';
  var optOut = '<html><body data-ai-editor="off"><h1>no</h1></body></html>';
  await withTempDir(async function(dir){
    fs.writeFileSync(path.join(dir, 'manual.html'), manual, 'utf8');
    fs.writeFileSync(path.join(dir, 'optout.html'), optOut, 'utf8');
    var server = await listen(buildInjectingApp(dir));
    try {
      var htmlManual = await (await fetch(baseUrl(server) + '/manual.html')).text();
      var htmlOptOut = await (await fetch(baseUrl(server) + '/optout.html')).text();
      assert.ok(!/data-ai-editor-injected/.test(htmlManual), 'manual wiring not double-injected');
      assert.ok(!/data-ai-editor-injected/.test(htmlOptOut), 'opt-out attribute honored');
    } finally { server.close(); }
  });
});

test('injection passes the apiToken through to init() when the server has one', async function(){
  await withTempDir(async function(dir){
    fs.writeFileSync(path.join(dir, 'index.html'), PAGE, 'utf8');
    var server = await listen(buildInjectingApp(dir, { apiToken: 's3cret' }));
    try {
      var html = await (await fetch(baseUrl(server) + '/')).text();
      assert.match(html, /apiToken: "s3cret"/);
    } finally { server.close(); }
  });
});

test('inject defaults to OFF for programmatic buildApp/startServer', async function(){
  await withTempDir(async function(dir){
    fs.writeFileSync(path.join(dir, 'index.html'), PAGE, 'utf8');
    var app = serverLib.buildApp({ staticDir: dir, silent: true });
    var server = await listen(app);
    try {
      var html = await (await fetch(baseUrl(server) + '/')).text();
      assert.ok(!/data-ai-editor-injected/.test(html), 'no injection unless inject:true');
    } finally { server.close(); }
  });
});

test('the /__ai-editor virtual path serves this package\'s own dist bundle', async function(){
  await withTempDir(async function(dir){
    var app = serverLib.buildApp({ staticDir: dir, silent: true });
    var server = await listen(app);
    try {
      var res = await fetch(baseUrl(server) + '/__ai-editor/ai-editor.esm.js');
      assert.equal(res.status, 200);
      var js = await res.text();
      assert.match(js, /AIEditor|export/);
    } finally { server.close(); }
  });
});

test('injection does not interfere with non-HTML static files', async function(){
  await withTempDir(async function(dir){
    fs.writeFileSync(path.join(dir, 'app.css'), 'body { color: red; }', 'utf8');
    var server = await listen(buildInjectingApp(dir));
    try {
      var css = await (await fetch(baseUrl(server) + '/app.css')).text();
      assert.equal(css, 'body { color: red; }');
    } finally { server.close(); }
  });
});
