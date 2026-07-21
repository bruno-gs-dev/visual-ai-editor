/**
 * visual-ai-editor — .env bootstrap for the `start` CLI command
 *
 * The zero-config flow: `npx visual-ai-editor start` in a project with no
 * .env creates one from templates/env.template (API key blank, everything
 * else commented with defaults), makes sure .gitignore covers it, and tells
 * the user to paste a key and run again. This module holds that logic so it
 * can be tested without spawning the CLI.
 *
 * Used by:
 *   - bin/cli.js `start`
 *   - server/index.js (isLocalEndpoint — single source of truth for the
 *     "localhost providers don't need an API key" rule)
 */

var fs = require('fs');
var path = require('path');

var DEFAULT_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

// Values that mean "the user hasn't actually set a key yet".
var PLACEHOLDER_KEYS = ['', 'your_key_here', 'your_groq_api_key_here', 'sk-...', 'paste_your_key_here'];

/** Local/loopback endpoints (Ollama, LM Studio, ...) don't need an API key. */
function isLocalEndpoint(endpoint){
  try {
    var host = new URL(endpoint).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0';
  } catch (e) {
    return false;
  }
}

/**
 * Create <root>/.env from the template if it doesn't exist.
 * Never overwrites. Returns { action: 'created' | 'exists', path }.
 */
function ensureEnvFile(root){
  var envPath = path.join(root, '.env');
  if (fs.existsSync(envPath)){
    return { action: 'exists', path: envPath };
  }
  var templatePath = path.join(__dirname, '..', 'templates', 'env.template');
  fs.copyFileSync(templatePath, envPath);
  return { action: 'created', path: envPath };
}

/**
 * Make sure <root>/.gitignore covers the given entries.
 * Creates the file if missing, appends missing entries, touches nothing otherwise.
 * entries defaults to ['.env'] for backward compatibility.
 * Returns { action: 'created' | 'appended' | 'unchanged', path, added }.
 */
function ensureGitignore(root, entries){
  entries = entries || ['.env'];
  var giPath = path.join(root, '.gitignore');

  // Build a set of regex patterns to detect existing coverage
  var coveragePatterns = {
    '.env': /^\.env[\s*]?$|^\*\.env$|^\.env\.\*?$/,
    '.ai-editor': /^\.ai-editor[\s/\\]?$|^\.ai-editor$/
  };

  if (!fs.existsSync(giPath)){
    fs.writeFileSync(giPath, entries.join('\n') + '\n', 'utf8');
    return { action: 'created', path: giPath, added: entries.slice() };
  }

  var content = fs.readFileSync(giPath, 'utf8');
  var lines = content.split(/\r?\n/);
  var missing = [];

  entries.forEach(function(entry){
    var pattern = coveragePatterns[entry];
    if (pattern){
      var covered = lines.some(function(line){
        return pattern.test(line.trim());
      });
      if (!covered) missing.push(entry);
    } else {
      // Generic check: line equals the entry
      var covered = lines.some(function(line){
        return line.trim() === entry;
      });
      if (!covered) missing.push(entry);
    }
  });

  if (missing.length === 0) return { action: 'unchanged', path: giPath, added: [] };

  var sep = content.length && !/\n$/.test(content) ? '\n' : '';
  fs.appendFileSync(giPath, sep + missing.join('\n') + '\n', 'utf8');
  return { action: 'appended', path: giPath, added: missing };
}

/**
 * Decide whether the environment is ready to start the server.
 * `env` is a process.env-like object (already merged with the .env file).
 *
 * Returns { ok, reason, endpoint }:
 *   ok=true               — key present, or endpoint is local (no key needed)
 *   reason='missing-key'  — remote endpoint and no usable key
 */
function checkApiKey(env){
  var endpoint = env.AI_ENDPOINT || DEFAULT_ENDPOINT;
  if (isLocalEndpoint(endpoint)){
    return { ok: true, endpoint: endpoint };
  }
  var key = String(env.AI_API_KEY || env.GROQ_API_KEY || '').trim();
  if (PLACEHOLDER_KEYS.indexOf(key) !== -1){
    return { ok: false, reason: 'missing-key', endpoint: endpoint };
  }
  return { ok: true, endpoint: endpoint };
}

module.exports = {
  isLocalEndpoint: isLocalEndpoint,
  ensureEnvFile: ensureEnvFile,
  ensureGitignore: ensureGitignore,
  checkApiKey: checkApiKey
};
