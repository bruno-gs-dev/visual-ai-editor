/**
 * visual-ai-editor — programmatic server entry
 *
 * Exports startServer(options) / buildApp(options). Options:
 *
 *   port                 number   port to listen on (default: PORT env or 3000)
 *   envPath              string   .env file to load (AI_API_KEY / GROQ_API_KEY, ...)
 *   designMdPath         string   default <cwd>/DESIGN.md
 *   indexHtmlPath        string   fallback save target, default <cwd>/index.html
 *   staticDir            string   directory served as static files, default cwd
 *   apiToken             string   shared secret for /api/edit, /api/save, /api/handoff
 *   allowUnsafeProduction boolean bypass the NODE_ENV=production safety check
 *   silent               boolean  build the app but don't listen / don't log
 *   locale               string   'en' (default) or 'pt-BR' — user-facing messages
 *   backup               boolean  write a backup before each save (default: true)
 *   maxHtmlBytes         number   reject /api/edit selections larger than this (default 200000)
 *   inject               boolean  auto-inject the editor client into served .html
 *                                 pages (default: false — the CLI `start` command
 *                                 turns it on; programmatic consumers opt in)
 *   ai                   object   { endpoint, model, apiKey, jsonMode, temperature }
 *                                 any OpenAI-compatible chat-completions API works
 *                                 (Groq, OpenAI, OpenRouter, Ollama, LM Studio, ...)
 *
 * Environment fallbacks for the provider:
 *   AI_ENDPOINT / AI_MODEL / AI_API_KEY   (preferred, provider-agnostic)
 *   GROQ_MODEL / GROQ_API_KEY             (legacy, still honored)
 *
 * SECURITY NOTE: this is a development/staging tool by default — it serves
 * your project directory over HTTP and its write endpoints are unauthenticated
 * unless you set `apiToken`. See "Security & production" in README.md.
 */

var path = require('path');
var fs = require('fs');
var express = require('express');
var tokens = require('../lib/design-tokens.js');
var patchLib = require('../lib/patch.js');
var serverMessages = require('../lib/server-messages.js');
var isLocalEndpoint = require('../lib/env-init.js').isLocalEndpoint;

var DEFAULT_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
var DEFAULT_MODEL = 'llama-3.3-70b-versatile';
var MAX_CSS_CONTEXT = 10000;
var MAX_HISTORY_FILES = 100;

// Blocked regardless of staticDir — defense-in-depth against the most common
// secret-leak vectors (dotfiles like .env are already blocked by express.static's
// default `dotfiles: 'ignore'`, but node_modules/ and lockfiles are not).
// `.ai-editor/` holds save backups + agent handoff manifests — never serve it.
var SENSITIVE_PATH_RE = /(^|[\\/])(\.git|\.svn|\.hg|\.ai-editor|node_modules|\.env(\..*)?|\.npmrc|\.npmignore|package(-lock)?\.json|yarn\.lock|pnpm-lock\.yaml|\.ssh|\.aws)([\\/]|$)/i;

// Explicit exception: this package's own public dist/ assets live under
// node_modules/visual-ai-editor/dist — the editor's own bundle/CSS must stay
// reachable, even though node_modules/ is blocked above.
var OWN_DIST_ALLOW_RE = /(^|[\\/])node_modules[\\/]visual-ai-editor[\\/]dist[\\/]/i;

function tryLoadDotenv(envPath){
  try {
    var dotenv = require('dotenv');
    dotenv.config({ path: envPath });
  } catch (e) {
    // dotenv not installed — assume env vars are set by the OS
  }
}

function stripCodeFence(text){
  var trimmed = String(text || '').trim();
  var fence = trimmed.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
  return fence ? fence[1].trim() : trimmed;
}

function requireApiToken(token, t){
  return function (req, res, next){
    if (!token) return next();
    var header = req.get('authorization') || '';
    var bearer = header.replace(/^Bearer\s+/i, '');
    var provided = bearer || req.get('x-ai-editor-token') || '';
    if (provided !== token){
      return res.status(401).json({ error: t('auth.invalid') });
    }
    next();
  };
}

function assertProductionSafe(options, t){
  if (process.env.NODE_ENV !== 'production') return;
  if (options.apiToken) return;
  if (options.allowUnsafeProduction === true) return;
  throw new Error(t('production.refuse'));
}

// Convenience presets so common local providers don't require typing out an
// endpoint URL. An explicit `ai.endpoint` always wins over the preset — this
// is sugar on top of the fully-generic ai.endpoint/model/apiKey contract, not
// a replacement for it.
var PROVIDER_PRESETS = {
  ollama: { endpoint: 'http://localhost:11434/v1/chat/completions' },
  lmstudio: { endpoint: 'http://localhost:1234/v1/chat/completions' }
};

/** Provider config resolved lazily so envPath-loaded vars are honored. */
function resolveProvider(options){
  var ai = options.ai || {};
  var preset = (ai.provider && PROVIDER_PRESETS[ai.provider]) || {};
  var endpoint = ai.endpoint || preset.endpoint || process.env.AI_ENDPOINT || DEFAULT_ENDPOINT;
  return {
    endpoint: endpoint,
    model: ai.model || process.env.AI_MODEL || process.env.GROQ_MODEL || DEFAULT_MODEL,
    apiKey: ai.apiKey || process.env.AI_API_KEY || process.env.GROQ_API_KEY || '',
    // A local endpoint (or an explicit override) doesn't require a key —
    // there's nothing to authenticate against on localhost.
    requiresApiKey: ai.requiresApiKey !== undefined ? ai.requiresApiKey : !isLocalEndpoint(endpoint),
    jsonMode: ai.jsonMode !== false,
    temperature: typeof ai.temperature === 'number' ? ai.temperature : 0.2
  };
}

/** DESIGN.md reader with mtime-based cache — edits to the file are picked up live. */
function designMdReader(designMdPath){
  var cache = { mtime: 0, md: '', exists: false, palette: new Set() };
  return function read(){
    try {
      var stat = fs.statSync(designMdPath);
      if (stat.mtimeMs !== cache.mtime){
        cache.md = fs.readFileSync(designMdPath, 'utf8');
        cache.mtime = stat.mtimeMs;
        cache.exists = true;
        cache.palette = tokens.extractPalette(cache.md);
      }
    } catch (e) {
      cache.md = '';
      cache.exists = false;
      cache.palette = new Set();
    }
    return cache;
  };
}

/**
 * Resolve the browser pathname of the page being edited to a writable file
 * inside staticDir. Rejects traversal and dot-segments; returns null when the
 * path is invalid, or `fallback` when no page was provided / no file matches.
 */
function resolvePageFile(staticDir, page, fallback){
  if (!page || typeof page !== 'string') return fallback;
  var p = page.split('?')[0].split('#')[0];
  try { p = decodeURIComponent(p); } catch (e) { return null; }
  p = p.replace(/\\/g, '/');
  if (p.indexOf('\0') !== -1) return null;

  var segs = p.split('/').filter(Boolean);
  for (var i = 0; i < segs.length; i++){
    if (segs[i] === '..' || segs[i].charAt(0) === '.') return null;
  }

  var rel = segs.join('/');
  var candidates;
  if (!rel){
    candidates = ['index.html'];
  } else if (/\.html?$/i.test(rel)){
    candidates = [rel];
  } else {
    candidates = [rel + '.html', rel + '/index.html'];
  }

  var rootResolved = path.resolve(staticDir);
  for (var j = 0; j < candidates.length; j++){
    var full = path.resolve(staticDir, candidates[j]);
    if (full !== rootResolved && full.indexOf(rootResolved + path.sep) !== 0) return null;
    if (fs.existsSync(full)) return full;
  }
  return fallback;
}

/** Copy targetFile into <staticDir>/.ai-editor/history/ before overwriting. */
function backupFile(staticDir, targetFile){
  if (!fs.existsSync(targetFile)) return null;
  var historyDir = path.join(staticDir, '.ai-editor', 'history');
  fs.mkdirSync(historyDir, { recursive: true });

  var stamp = new Date().toISOString().replace(/[:.]/g, '-');
  var backupPath = path.join(historyDir, path.basename(targetFile) + '.' + stamp + '.bak.html');
  fs.copyFileSync(targetFile, backupPath);

  // Keep history bounded — drop the oldest files beyond MAX_HISTORY_FILES.
  try {
    var entries = fs.readdirSync(historyDir).sort();
    while (entries.length > MAX_HISTORY_FILES){
      fs.unlinkSync(path.join(historyDir, entries.shift()));
    }
  } catch (e) { /* best effort */ }

  return backupPath;
}

// ---------------------------------------------------------------------------
// Client auto-injection (zero-config mode)
// ---------------------------------------------------------------------------

// A page that already wires the editor by hand must not get a second copy.
// Also honors an explicit opt-out attribute anywhere in the page.
var INJECT_SKIP_RE = /ai-editor(\.esm)?(\.min)?\.js|AIEditor|__ai-editor\/|data-ai-editor="off"/;

/**
 * Inject the editor's module script before the closing </body> tag (or append
 * to the end when there isn't one — fragment pages). Returns the HTML
 * unchanged when the page already loads the editor or opted out.
 */
function injectClient(html, apiToken){
  if (INJECT_SKIP_RE.test(html)) return html;
  var initOpts = "{ apiBase: '/api'" + (apiToken ? ", apiToken: " + JSON.stringify(apiToken) : '') + " }";
  var snippet = '<script type="module" data-ai-editor-injected>\n' +
    "import { init } from '/__ai-editor/ai-editor.esm.js';\n" +
    'init(' + initOpts + ');\n' +
    '</script>\n';
  var m = /<\/body\s*>/i.exec(html);
  if (m) return html.slice(0, m.index) + snippet + html.slice(m.index);
  return html + '\n' + snippet;
}

function buildEditPrompts(params){
  var designSection = params.designMd
    ? '\n\nREFERENCE DESIGN SYSTEM (follow it strictly):\n' + params.designMd
    : '';

  var cssSection = params.css
    ? '\n\nRELEVANT CSS RULES currently applying to the selection (so you know what existing classes do):\n' + params.css
    : '';

  var warnLanguage = serverMessages.resolveLocale(params.locale) === 'pt-BR'
    ? 'Brazilian Portuguese'
    : 'English';

  var systemPrompt =
    'You are an HTML editor that strictly follows the design system provided below.' +
    designSection + cssSection + '\n\n' +
    'RULES:\n' +
    '- You receive an HTML fragment and a user instruction to edit it.\n' +
    '- Respond ONLY with a single JSON object, no markdown fences, in one of these two shapes:\n' +
    '    {"html": "<the updated HTML fragment>"}\n' +
    '    {"warn": "<short explanation of why the request conflicts with the design system>"}\n' +
    '- Keep the same root tag and outer structure of the fragment.\n' +
    '- Reuse existing CSS classes whenever it makes sense. Do not invent new classes unless truly necessary.\n' +
    '- Use ONLY colors, spacing and typography defined in the design system when one is provided.\n' +
    '- Return {"warn": ...} when the user request clearly contradicts the design system ' +
    '(e.g. off-palette colors, a border-radius that breaks the documented scale, broken type hierarchy) ' +
    'AND force mode is not active. Write the warn message in ' + warnLanguage + '.\n' +
    '- When force mode is active, apply the change regardless of design-system conflicts and return {"html": ...}.';

  var userPrompt =
    (params.force ? '[FORCE MODE] The user wants this change applied even if it conflicts with the design system.\n\n' : '') +
    'Approximate selector of the element: ' + params.selector + '\n\n' +
    'INSTRUCTION: ' + params.instruction + '\n\n' +
    'ORIGINAL HTML FRAGMENT:\n' + params.html;

  return { system: systemPrompt, user: userPrompt };
}

/** Parse the model response into { html } or { warn } with legacy fallbacks. */
function parseModelResponse(content){
  var text = stripCodeFence(content);
  try {
    var parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object'){
      if (typeof parsed.warn === 'string') return { warn: parsed.warn };
      if (typeof parsed.html === 'string') return { html: parsed.html.trim() };
    }
  } catch (e) { /* not JSON — legacy plain-HTML response */ }

  if (text.charAt(0) === '{'){
    // Looks like JSON but didn't parse / didn't match — try a warn extraction
    var m = text.match(/"warn"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (m) return { warn: m[1].replace(/\\"/g, '"') };
  }
  return { html: text };
}

async function callProvider(provider, prompts, useJsonMode){
  var body = {
    model: provider.model,
    temperature: provider.temperature,
    messages: [
      { role: 'system', content: prompts.system },
      { role: 'user', content: prompts.user }
    ]
  };
  if (useJsonMode) body.response_format = { type: 'json_object' };

  var headers = { 'Content-Type': 'application/json' };
  if (provider.apiKey) headers['Authorization'] = 'Bearer ' + provider.apiKey;

  var apiRes = await fetch(provider.endpoint, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body)
  });
  var data = await apiRes.json().catch(function(){ return {}; });
  return { res: apiRes, data: data };
}

function buildApp(options){
  options = options || {};
  var t = serverMessages.msg(options.locale);
  assertProductionSafe(options, t);

  var designMdPath = options.designMdPath || path.join(process.cwd(), 'DESIGN.md');
  var staticDir = options.staticDir || process.cwd();
  // Derived from staticDir (not process.cwd()) so a customized staticDir without
  // an explicit indexHtmlPath still saves somewhere the server actually serves
  // from, instead of silently writing outside it.
  var indexHtmlPath = options.indexHtmlPath || path.join(staticDir, 'index.html');
  var maxHtmlBytes = typeof options.maxHtmlBytes === 'number' ? options.maxHtmlBytes : 200000;
  var readDesign = designMdReader(designMdPath);

  var initial = readDesign();
  if (!options.silent){
    if (initial.exists){
      console.log(t('log.design-loaded', { chars: initial.md.length, palette: initial.palette.size }));
    } else {
      console.warn(t('log.design-missing', { path: designMdPath }));
      console.warn(t('log.design-hint'));
    }
    if (!options.apiToken){
      console.warn(t('log.no-token'));
      console.warn(t('log.no-token-hint'));
    }
  }

  var app = express();
  app.use(express.json({ limit: '4mb' }));

  // Block sensitive paths regardless of where staticDir points (defense in depth),
  // except this package's own public dist/ assets.
  app.use(function (req, res, next){
    if (OWN_DIST_ALLOW_RE.test(req.path)) return next();
    if (SENSITIVE_PATH_RE.test(req.path)) return res.status(404).end();
    next();
  });

  // The editor's own bundle at a stable virtual path, independent of where
  // this package physically lives (local node_modules, npx cache, pnpm store).
  // The node_modules/visual-ai-editor/dist path keeps working for manual
  // wiring, but injected pages and new docs use this one.
  app.use('/__ai-editor', express.static(path.join(__dirname, '..', 'dist')));

  if (options.inject === true){
    app.use(function (req, res, next){
      if (req.method !== 'GET') return next();
      var file = resolvePageFile(staticDir, req.path, null);
      if (!file) return next();
      fs.readFile(file, 'utf8', function (err, html){
        if (err) return next();
        res.type('html').send(injectClient(html, options.apiToken));
      });
    });
  }

  app.use(express.static(staticDir));

  var apiAuth = requireApiToken(options.apiToken, t);

  app.post('/api/edit', apiAuth, async function (req, res){
    var body = req.body || {};
    var html = body.html;
    var instruction = body.instruction;
    var selector = body.selector || '';
    var force = !!body.force;
    var css = typeof body.css === 'string' ? body.css.slice(0, MAX_CSS_CONTEXT) : '';

    if (!html || !instruction){
      return res.status(400).json({ error: t('edit.missing-fields') });
    }
    if (html.length > maxHtmlBytes){
      return res.status(413).json({ error: t('edit.too-large', { size: html.length, limit: maxHtmlBytes }) });
    }

    var provider = resolveProvider(options);
    if (provider.requiresApiKey && !provider.apiKey){
      return res.status(500).json({ error: t('edit.no-api-key') });
    }

    var design = readDesign();
    var prompts = buildEditPrompts({
      designMd: design.md,
      css: css,
      selector: selector,
      instruction: instruction,
      html: html,
      force: force,
      locale: options.locale
    });

    try {
      var attempt = await callProvider(provider, prompts, provider.jsonMode);

      // Some OpenAI-compatible servers reject response_format — retry without it.
      if (!attempt.res.ok && attempt.res.status === 400 && provider.jsonMode){
        var errMsg = (attempt.data.error && attempt.data.error.message) || '';
        if (/response_format|json_object/i.test(errMsg)){
          attempt = await callProvider(provider, prompts, false);
        }
      }

      if (!attempt.res.ok){
        if (attempt.res.status === 429){
          var msg429 = (attempt.data.error && attempt.data.error.message) || '';
          var match = msg429.match(/try again in ([\d.]+)s/);
          var retryAfterHeader = parseFloat(attempt.res.headers.get('retry-after'));
          var retryAfter = match ? parseFloat(match[1]) : (retryAfterHeader || 10);
          return res.status(429).json({ error: t('edit.rate-limit'), retryAfter: retryAfter });
        }
        throw new Error((attempt.data.error && attempt.data.error.message) || t('edit.api-error'));
      }

      var content = attempt.data.choices && attempt.data.choices[0] &&
        attempt.data.choices[0].message && attempt.data.choices[0].message.content || '';
      var result = parseModelResponse(content);

      if (result.warn) return res.json({ warn: result.warn });

      // Deterministic palette enforcement — don't just trust the model.
      if (!force && design.palette.size > 0){
        var violations = tokens.findViolations(result.html, html, design.palette);
        if (violations.length){
          return res.json({
            warn: t('edit.off-palette', { colors: violations.join(', ') }),
            violations: violations,
            html: result.html // client can apply this directly on "force" — zero extra tokens
          });
        }
      }

      res.json({ html: result.html });
    } catch (err) {
      console.error('[ai-editor] /api/edit error:', err);
      res.status(500).json({ error: err.message || t('edit.api-error') });
    }
  });

  app.get('/api/design', function (req, res){
    var design = readDesign();
    res.json({
      md: design.md,
      exists: design.exists,
      palette: Array.from(design.palette)
    });
  });

  /**
   * POST /api/save
   * Body: { html?, page?, patches? }
   *   - patches: [{ before, after }] — surgical replacements against the
   *     source file (preserves formatting; small git diffs).
   *   - html: full serialized page — used when there are no patches, or as a
   *     fallback when a patch can't be located in the source.
   *   - page: browser pathname of the page being edited (multi-page support);
   *     resolved safely inside staticDir. Defaults to indexHtmlPath.
   */
  app.post('/api/save', apiAuth, function (req, res){
    var body = req.body || {};
    var html = body.html;
    var patches = Array.isArray(body.patches) ? body.patches : [];

    if (!html && !patches.length){
      return res.status(400).json({ error: t('save.missing-body') });
    }

    var target = resolvePageFile(staticDir, body.page, indexHtmlPath);
    if (!target){
      return res.status(400).json({ error: t('save.invalid-page') });
    }

    var backupPath = null;
    if (options.backup !== false){
      try { backupPath = backupFile(staticDir, target); }
      catch (e) { console.warn('[ai-editor] backup failed (non-critical):', e.message); }
    }

    function respondWrite(content, mode, extra){
      fs.writeFile(target, content, 'utf8', function (err){
        if (err){
          console.error('[ai-editor] save error:', err);
          return res.status(500).json({ error: t('save.write-error', { error: err.message }) });
        }
        var payload = { ok: true, path: target, mode: mode, backup: backupPath };
        if (extra) Object.keys(extra).forEach(function(k){ payload[k] = extra[k]; });
        res.json(payload);
      });
    }

    if (patches.length){
      var source;
      try { source = fs.readFileSync(target, 'utf8'); }
      catch (e) { source = null; }

      if (source !== null){
        var result = patchLib.applyPatches(source, patches);
        if (result.failed.length === 0){
          return respondWrite(result.source, 'patch', { applied: result.applied });
        }
        if (html){
          // Some patches couldn't be located — fall back to the full snapshot.
          return respondWrite(html, 'full', { applied: 0, failedPatches: result.failed });
        }
        return res.status(409).json({
          error: t('save.patch-failed', { count: result.failed.length, path: target }),
          failedPatches: result.failed
        });
      }
    }

    respondWrite(html, 'full');
  });

  /**
   * POST /api/handoff
   * For framework pages (React/Vue/...) the live DOM edit can't be written
   * back to a static file — instead we export a change manifest that an AI
   * coding agent (Claude Code, Cursor, ...) applies to the real source.
   * Body: { changes: [{ source, selector, instruction, before, after }] }
   * Writes/appends <staticDir>/.ai-editor/pending-changes.md
   */
  app.post('/api/handoff', apiAuth, function (req, res){
    var changes = req.body && req.body.changes;
    if (!Array.isArray(changes) || !changes.length){
      return res.status(400).json({ error: t('handoff.missing-changes') });
    }

    var dir = path.join(staticDir, '.ai-editor');
    var file = path.join(dir, 'pending-changes.md');
    try {
      fs.mkdirSync(dir, { recursive: true });
      var isNew = !fs.existsSync(file);
      var out = [];
      if (isNew){
        out.push('# visual-ai-editor — pending changes');
        out.push('');
        out.push('Edits made visually in the browser that need to be applied to the real');
        out.push('source files. Each entry lists the source location (when detected), the');
        out.push('user instruction, and the before/after HTML of the rendered element.');
        out.push('An AI coding agent should apply each change to the source (JSX/template/');
        out.push('HTML), adapting the markup to the framework, then delete the entry.');
        out.push('');
      }
      changes.forEach(function(change){
        out.push('---');
        out.push('');
        out.push('## ' + new Date().toISOString() + ' — ' + (change.selector || 'element'));
        out.push('');
        out.push('- **Source**: ' + (change.source || '(not detected — locate by selector/markup)'));
        out.push('- **Selector**: `' + (change.selector || '') + '`');
        out.push('- **Instruction**: ' + (change.instruction || ''));
        out.push('');
        out.push('**Before (rendered):**');
        out.push('```html');
        out.push(change.before || '');
        out.push('```');
        out.push('');
        out.push('**After (rendered):**');
        out.push('```html');
        out.push(change.after || '');
        out.push('```');
        out.push('');
      });
      fs.appendFileSync(file, out.join('\n'), 'utf8');
      res.json({ ok: true, path: file, count: changes.length });
    } catch (err) {
      res.status(500).json({ error: t('save.write-error', { error: err.message }) });
    }
  });

  return app;
}

function startServer(options){
  options = options || {};
  if (options.envPath) tryLoadDotenv(options.envPath);

  var t = serverMessages.msg(options.locale);
  var port = typeof options.port === 'number' ? options.port : (parseInt(process.env.PORT, 10) || 3000);
  var app = buildApp(options); // buildApp() also runs the production safety check

  if (options.silent) return { app: app, port: port };

  var server = app.listen(port, function (){
    console.log(t('log.listening', { port: port }));
  });
  return { app: app, server: server, port: port };
}

module.exports = { startServer: startServer, buildApp: buildApp };
