var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var os = require('os');
var path = require('path');
var http = require('http');

var serverLib = require('../server/index.js');

var FAKE_AI_URL = 'http://fake-ai-provider.test/v1/chat/completions';
var FAKE_OLLAMA_URL = 'http://localhost:11434/v1/chat/completions';

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

/** Stub global.fetch so calls to `matchUrl` (default FAKE_AI_URL) return `reply`; everything else uses the real fetch. */
function stubAiProvider(reply, matchUrl){
  var target = matchUrl || FAKE_AI_URL;
  var realFetch = global.fetch;
  global.fetch = function (url, opts){
    if (String(url) === target){
      return Promise.resolve({
        ok: reply.ok !== false,
        status: reply.status || 200,
        headers: new Map(),
        json: function(){ return Promise.resolve(reply.body); }
      });
    }
    return realFetch(url, opts);
  };
  global.fetch.headers = undefined;
  return function restore(){ global.fetch = realFetch; };
}

test('GET /api/design reports exists=false when there is no DESIGN.md', async function(){
  await withTempDir(async function(dir){
    var app = serverLib.buildApp({ staticDir: dir, designMdPath: path.join(dir, 'DESIGN.md'), silent: true });
    var server = await listen(app);
    try {
      var res = await fetch(baseUrl(server) + '/api/design');
      var data = await res.json();
      assert.equal(data.exists, false);
      assert.deepEqual(data.palette, []);
    } finally { server.close(); }
  });
});

test('GET /api/design reports palette extracted from DESIGN.md', async function(){
  await withTempDir(async function(dir){
    var designPath = path.join(dir, 'DESIGN.md');
    fs.writeFileSync(designPath, '---\ncolors:\n  primary: "#4f46e5"\n---\n\nUse #4f46e5.');
    var app = serverLib.buildApp({ staticDir: dir, designMdPath: designPath, silent: true });
    var server = await listen(app);
    try {
      var res = await fetch(baseUrl(server) + '/api/design');
      var data = await res.json();
      assert.equal(data.exists, true);
      assert.ok(data.palette.indexOf('#4f46e5') !== -1);
    } finally { server.close(); }
  });
});

test('POST /api/edit requires html and instruction', async function(){
  await withTempDir(async function(dir){
    var app = serverLib.buildApp({ staticDir: dir, ai: { apiKey: 'x' }, silent: true });
    var server = await listen(app);
    try {
      var res = await fetch(baseUrl(server) + '/api/edit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({})
      });
      assert.equal(res.status, 400);
    } finally { server.close(); }
  });
});

test('POST /api/edit returns 500 without an API key configured', async function(){
  await withTempDir(async function(dir){
    var app = serverLib.buildApp({ staticDir: dir, ai: { apiKey: '' }, silent: true });
    var server = await listen(app);
    try {
      var res = await fetch(baseUrl(server) + '/api/edit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: '<p>hi</p>', instruction: 'make it bold' })
      });
      assert.equal(res.status, 500);
    } finally { server.close(); }
  });
});

test('POST /api/edit rejects oversized selections without calling the provider', async function(){
  await withTempDir(async function(dir){
    var app = serverLib.buildApp({ staticDir: dir, ai: { apiKey: 'x' }, maxHtmlBytes: 10, silent: true });
    var server = await listen(app);
    try {
      var res = await fetch(baseUrl(server) + '/api/edit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: '<p>this is definitely more than ten bytes</p>', instruction: 'x' })
      });
      assert.equal(res.status, 413);
    } finally { server.close(); }
  });
});

test('POST /api/edit happy path returns html from a stubbed provider', async function(){
  await withTempDir(async function(dir){
    var app = serverLib.buildApp({
      staticDir: dir,
      ai: { apiKey: 'x', endpoint: FAKE_AI_URL },
      silent: true
    });
    var server = await listen(app);
    var restore = stubAiProvider({
      body: { choices: [{ message: { content: JSON.stringify({ html: '<p>bold text</p>' }) } }] }
    });
    try {
      var res = await fetch(baseUrl(server) + '/api/edit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: '<p>text</p>', instruction: 'make it bold' })
      });
      var data = await res.json();
      assert.equal(res.status, 200);
      assert.equal(data.html, '<p>bold text</p>');
    } finally { restore(); server.close(); }
  });
});

test('POST /api/edit flags off-palette colors deterministically even if the model does not warn', async function(){
  await withTempDir(async function(dir){
    var designPath = path.join(dir, 'DESIGN.md');
    fs.writeFileSync(designPath, '---\ncolors:\n  primary: "#4f46e5"\n---\n');
    var app = serverLib.buildApp({
      staticDir: dir,
      designMdPath: designPath,
      ai: { apiKey: 'x', endpoint: FAKE_AI_URL },
      silent: true
    });
    var server = await listen(app);
    var restore = stubAiProvider({
      body: { choices: [{ message: { content: JSON.stringify({ html: '<p style="color:#ff0000">text</p>' }) } }] }
    });
    try {
      var res = await fetch(baseUrl(server) + '/api/edit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: '<p>text</p>', instruction: 'make it red' })
      });
      var data = await res.json();
      assert.ok(data.warn);
      assert.ok(data.violations.indexOf('#ff0000') !== -1);
      assert.equal(data.html, '<p style="color:#ff0000">text</p>'); // available for zero-token force-apply
    } finally { restore(); server.close(); }
  });
});

test('POST /api/edit force=true skips palette enforcement', async function(){
  await withTempDir(async function(dir){
    var designPath = path.join(dir, 'DESIGN.md');
    fs.writeFileSync(designPath, '---\ncolors:\n  primary: "#4f46e5"\n---\n');
    var app = serverLib.buildApp({
      staticDir: dir,
      designMdPath: designPath,
      ai: { apiKey: 'x', endpoint: FAKE_AI_URL },
      silent: true
    });
    var server = await listen(app);
    var restore = stubAiProvider({
      body: { choices: [{ message: { content: JSON.stringify({ html: '<p style="color:#ff0000">text</p>' }) } }] }
    });
    try {
      var res = await fetch(baseUrl(server) + '/api/edit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: '<p>text</p>', instruction: 'make it red', force: true })
      });
      var data = await res.json();
      assert.equal(data.warn, undefined);
      assert.equal(data.html, '<p style="color:#ff0000">text</p>');
    } finally { restore(); server.close(); }
  });
});

test('POST /api/edit with ai.provider "ollama" does not require an apiKey', async function(){
  await withTempDir(async function(dir){
    var app = serverLib.buildApp({
      staticDir: dir,
      ai: { provider: 'ollama', model: 'llama3.2' }, // no apiKey
      silent: true
    });
    var server = await listen(app);
    var restore = stubAiProvider({
      body: { choices: [{ message: { content: JSON.stringify({ html: '<p>hi</p>' }) } }] }
    }, FAKE_OLLAMA_URL);
    try {
      var res = await fetch(baseUrl(server) + '/api/edit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: '<p>x</p>', instruction: 'say hi' })
      });
      var data = await res.json();
      assert.equal(res.status, 200);
      assert.equal(data.html, '<p>hi</p>');
    } finally { restore(); server.close(); }
  });
});

test('POST /api/edit with an explicit local endpoint (no provider preset) also skips the apiKey requirement', async function(){
  await withTempDir(async function(dir){
    var app = serverLib.buildApp({
      staticDir: dir,
      ai: { endpoint: 'http://127.0.0.1:1234/v1/chat/completions', model: 'x' },
      silent: true
    });
    var server = await listen(app);
    var restore = stubAiProvider({
      body: { choices: [{ message: { content: JSON.stringify({ html: '<p>ok</p>' }) } }] }
    }, 'http://127.0.0.1:1234/v1/chat/completions');
    try {
      var res = await fetch(baseUrl(server) + '/api/edit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: '<p>x</p>', instruction: 'say ok' })
      });
      assert.equal(res.status, 200);
    } finally { restore(); server.close(); }
  });
});

test('POST /api/edit still requires an apiKey for a remote endpoint even with ai.provider unset', async function(){
  await withTempDir(async function(dir){
    var app = serverLib.buildApp({ staticDir: dir, ai: { endpoint: FAKE_AI_URL }, silent: true });
    var server = await listen(app);
    try {
      var res = await fetch(baseUrl(server) + '/api/edit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: '<p>x</p>', instruction: 'say ok' })
      });
      assert.equal(res.status, 500);
    } finally { server.close(); }
  });
});

test('POST /api/edit honors an explicit requiresApiKey:true override for a local endpoint', async function(){
  await withTempDir(async function(dir){
    var app = serverLib.buildApp({
      staticDir: dir,
      ai: { provider: 'ollama', model: 'x', requiresApiKey: true },
      silent: true
    });
    var server = await listen(app);
    try {
      var res = await fetch(baseUrl(server) + '/api/edit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: '<p>x</p>', instruction: 'say ok' })
      });
      assert.equal(res.status, 500);
    } finally { server.close(); }
  });
});

test('POST /api/edit honors an explicit requiresApiKey:false override for a remote endpoint', async function(){
  await withTempDir(async function(dir){
    var app = serverLib.buildApp({
      staticDir: dir,
      ai: { endpoint: FAKE_AI_URL, requiresApiKey: false },
      silent: true
    });
    var server = await listen(app);
    var restore = stubAiProvider({
      body: { choices: [{ message: { content: JSON.stringify({ html: '<p>ok</p>' }) } }] }
    });
    try {
      var res = await fetch(baseUrl(server) + '/api/edit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: '<p>x</p>', instruction: 'say ok' })
      });
      assert.equal(res.status, 200);
    } finally { restore(); server.close(); }
  });
});

test('POST /api/save with patches applies a surgical replacement and writes a backup', async function(){
  await withTempDir(async function(dir){
    var indexPath = path.join(dir, 'index.html');
    fs.writeFileSync(indexPath, '<html><body><h1>Old</h1></body></html>');
    var app = serverLib.buildApp({ staticDir: dir, indexHtmlPath: indexPath, silent: true });
    var server = await listen(app);
    try {
      var res = await fetch(baseUrl(server) + '/api/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patches: [{ before: '<h1>Old</h1>', after: '<h1>New</h1>' }] })
      });
      var data = await res.json();
      assert.equal(res.status, 200);
      assert.equal(data.mode, 'patch');
      assert.equal(data.applied, 1);
      assert.ok(data.backup && fs.existsSync(data.backup));
      var written = fs.readFileSync(indexPath, 'utf8');
      assert.ok(written.indexOf('<h1>New</h1>') !== -1);
      assert.ok(written.indexOf('Old') === -1);
    } finally { server.close(); }
  });
});

test('POST /api/save falls back to full HTML when a patch cannot be located', async function(){
  await withTempDir(async function(dir){
    var indexPath = path.join(dir, 'index.html');
    fs.writeFileSync(indexPath, '<html><body><h1>Old</h1></body></html>');
    var app = serverLib.buildApp({ staticDir: dir, indexHtmlPath: indexPath, silent: true });
    var server = await listen(app);
    try {
      var res = await fetch(baseUrl(server) + '/api/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: '<html><body><h1>Fallback</h1></body></html>',
          patches: [{ before: '<h1>Nonexistent</h1>', after: '<h1>New</h1>' }]
        })
      });
      var data = await res.json();
      assert.equal(res.status, 200);
      assert.equal(data.mode, 'full');
      var written = fs.readFileSync(indexPath, 'utf8');
      assert.ok(written.indexOf('Fallback') !== -1);
    } finally { server.close(); }
  });
});

test('POST /api/save rejects path traversal in "page"', async function(){
  await withTempDir(async function(dir){
    fs.writeFileSync(path.join(dir, 'index.html'), '<html></html>');
    var app = serverLib.buildApp({ staticDir: dir, silent: true });
    var server = await listen(app);
    try {
      var res = await fetch(baseUrl(server) + '/api/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: '<html></html>', page: '../../etc/passwd' })
      });
      assert.equal(res.status, 400);
    } finally { server.close(); }
  });
});

test('POST /api/save resolves a multi-page "page" path inside staticDir', async function(){
  await withTempDir(async function(dir){
    var aboutPath = path.join(dir, 'about.html');
    fs.writeFileSync(aboutPath, '<h1>About Old</h1>');
    var app = serverLib.buildApp({ staticDir: dir, silent: true });
    var server = await listen(app);
    try {
      var res = await fetch(baseUrl(server) + '/api/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: '/about', patches: [{ before: '<h1>About Old</h1>', after: '<h1>About New</h1>' }] })
      });
      var data = await res.json();
      assert.equal(res.status, 200);
      assert.equal(path.resolve(data.path), path.resolve(aboutPath));
      assert.ok(fs.readFileSync(aboutPath, 'utf8').indexOf('About New') !== -1);
    } finally { server.close(); }
  });
});

test('POST /api/handoff writes a pending-changes manifest', async function(){
  await withTempDir(async function(dir){
    var app = serverLib.buildApp({ staticDir: dir, silent: true });
    var server = await listen(app);
    try {
      var res = await fetch(baseUrl(server) + '/api/handoff', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes: [{ source: 'src/App.jsx:10', selector: 'button.cta', instruction: 'make it green', before: '<button>Go</button>', after: '<button class="green">Go</button>' }] })
      });
      var data = await res.json();
      assert.equal(res.status, 200);
      assert.equal(data.count, 1);
      var manifest = fs.readFileSync(data.path, 'utf8');
      assert.ok(manifest.indexOf('src/App.jsx:10') !== -1);
      assert.ok(manifest.indexOf('make it green') !== -1);
    } finally { server.close(); }
  });
});

test('apiToken protects write endpoints but not GET /api/design', async function(){
  await withTempDir(async function(dir){
    fs.writeFileSync(path.join(dir, 'index.html'), '<html></html>');
    var app = serverLib.buildApp({ staticDir: dir, apiToken: 'secret', silent: true });
    var server = await listen(app);
    try {
      var unauthorized = await fetch(baseUrl(server) + '/api/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: '<html></html>' })
      });
      assert.equal(unauthorized.status, 401);

      var authorized = await fetch(baseUrl(server) + '/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer secret' },
        body: JSON.stringify({ html: '<html>ok</html>' })
      });
      assert.equal(authorized.status, 200);

      var designRes = await fetch(baseUrl(server) + '/api/design');
      assert.equal(designRes.status, 200);
    } finally { server.close(); }
  });
});

test('sensitive paths are blocked by static middleware', async function(){
  await withTempDir(async function(dir){
    fs.mkdirSync(path.join(dir, 'node_modules'));
    fs.writeFileSync(path.join(dir, 'node_modules', 'secret.js'), 'module.exports = 1;');
    fs.writeFileSync(path.join(dir, '.env'), 'SECRET=1');
    var app = serverLib.buildApp({ staticDir: dir, silent: true });
    var server = await listen(app);
    try {
      var res1 = await fetch(baseUrl(server) + '/node_modules/secret.js');
      assert.equal(res1.status, 404);
      var res2 = await fetch(baseUrl(server) + '/.env');
      assert.equal(res2.status, 404);
    } finally { server.close(); }
  });
});

test('default indexHtmlPath is derived from a custom staticDir, not process.cwd()', async function(){
  await withTempDir(async function(dir){
    fs.writeFileSync(path.join(dir, 'index.html'), '<html>original</html>');
    var cwdBefore = process.cwd();
    var app = serverLib.buildApp({ staticDir: dir, silent: true }); // no indexHtmlPath override
    var server = await listen(app);
    try {
      var res = await fetch(baseUrl(server) + '/api/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: '<html>saved</html>' })
      });
      var data = await res.json();
      assert.equal(res.status, 200);
      assert.equal(path.resolve(data.path), path.resolve(path.join(dir, 'index.html')));
      assert.equal(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), '<html>saved</html>');
      // Must NOT have written next to process.cwd() instead.
      assert.equal(fs.existsSync(path.join(cwdBefore, 'index.html')) &&
        fs.readFileSync(path.join(cwdBefore, 'index.html'), 'utf8') === '<html>saved</html>', false);
    } finally { server.close(); }
  });
});

test('buildApp throws in production without apiToken or allowUnsafeProduction', function(){
  var originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    assert.throws(function(){ serverLib.buildApp({ silent: true }); });
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});
