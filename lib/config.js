/**
 * visual-ai-editor — config.json loader
 *
 * Resolution order for provider settings:
 *   1. CLI flags (options.ai.*)
 *   2. Local config  (.ai-editor/config.json)
 *   3. Global config  (~/.config/visual-ai-editor/config.json)
 *   4. .env / environment variables
 *   5. Built-in defaults (Groq)
 *
 * Config file format:
 *   {
 *     "provider": "anthropic",
 *     "endpoint": "https://api.anthropic.com/v1/messages",
 *     "model": "claude-sonnet-4-20250514",
 *     "apiKey": "sk-ant-..."
 *   }
 *
 * Used by:
 *   - server/index.js (resolveProvider)
 *   - bin/cli.js (config command, start command)
 */

var fs = require('fs');
var path = require('path');
var os = require('os');

var CONFIG_FILENAME = 'config.json';

/** Provider presets shown in the interactive CLI. */
var PROVIDER_PRESETS = [
  {
    id: 'groq',
    name: 'Groq (gratuito, rápido)',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    models: ['llama-3.3-70b-versatile', 'llama-3-70b-versatile', 'mixtral-8x7b-32768'],
    defaultModel: 'llama-3.3-70b-versatile',
    needsKey: true
  },
  {
    id: 'openai',
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    defaultModel: 'gpt-4o',
    needsKey: true
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    endpoint: 'https://api.anthropic.com/v1/messages',
    models: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250514', 'claude-3-5-sonnet-20241022'],
    defaultModel: 'claude-sonnet-4-20250514',
    needsKey: true
  },
  {
    id: 'ollama',
    name: 'Ollama (local)',
    endpoint: 'http://localhost:11434/v1/chat/completions',
    models: [],
    defaultModel: '',
    needsKey: false
  },
  {
    id: 'lmstudio',
    name: 'LM Studio (local)',
    endpoint: 'http://localhost:1234/v1/chat/completions',
    models: [],
    defaultModel: '',
    needsKey: false
  },
  {
    id: 'custom',
    name: 'Custom (endpoint manual)',
    endpoint: '',
    models: [],
    defaultModel: '',
    needsKey: true
  }
];

function localConfigPath(root) {
  return path.join(root, '.ai-editor', CONFIG_FILENAME);
}

function globalConfigPath() {
  var dir;
  if (process.platform === 'win32') {
    dir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  } else if (process.platform === 'darwin') {
    dir = path.join(os.homedir(), 'Library', 'Preferences');
  } else {
    dir = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  }
  return path.join(dir, 'visual-ai-editor', CONFIG_FILENAME);
}

function readJson(filePath) {
  try {
    var raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function writeJson(filePath, data) {
  var dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/**
 * Load config with priority: local > global.
 * Returns { provider, endpoint, model, apiKey } or empty object.
 */
function loadConfig(root) {
  var local = readJson(localConfigPath(root));
  var global_ = readJson(globalConfigPath());
  var merged = Object.assign({}, global_ || {}, local || {});
  return {
    provider: merged.provider || '',
    endpoint: merged.endpoint || '',
    model: merged.model || '',
    apiKey: merged.apiKey || ''
  };
}

/**
 * Save config. scope='local' writes to .ai-editor/config.json,
 * scope='global' writes to ~/.config/visual-ai-editor/config.json.
 */
function saveConfig(root, scope, data) {
  var target = scope === 'global' ? globalConfigPath() : localConfigPath(root);
  writeJson(target, data);
  return target;
}

/**
 * Resolve provider config with full priority chain.
 * Used by server/index.js resolveProvider().
 */
function resolveConfig(root, options) {
  var ai = (options && options.ai) || {};
  var fileConfig = loadConfig(root);

  var endpoint = ai.endpoint || fileConfig.endpoint || '';
  var model = ai.model || fileConfig.model || '';
  var apiKey = ai.apiKey || fileConfig.apiKey || '';

  return {
    provider: fileConfig.provider || '',
    endpoint: endpoint,
    model: model,
    apiKey: apiKey
  };
}

module.exports = {
  PROVIDER_PRESETS: PROVIDER_PRESETS,
  localConfigPath: localConfigPath,
  globalConfigPath: globalConfigPath,
  loadConfig: loadConfig,
  saveConfig: saveConfig,
  resolveConfig: resolveConfig
};
