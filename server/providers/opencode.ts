/**
 * visual-ai-editor — OpenCode provider adapter
 *
 * Handles OpenCode's Zen and Go endpoints which expose models
 * through an OpenAI-compatible Chat Completions API.
 *
 * Free tier (Zen):  https://opencode.ai/zen/v1/chat/completions
 * Paid tier (Go):   https://opencode.ai/zen/go/v1/chat/completions
 *
 * Requires a Bearer token from https://opencode.ai
 */

var FREE_MODELS = [
  'deepseek-v4-flash-free',
  'big-pickle',
  'mimo-v2.5-free',
  'north-mini-code-free',
  'nemotron-3-ultra-free'
];

var PAID_MODELS = [
  'gpt-5.1', 'gpt-5.1-codex', 'gpt-5.1-codex-mini', 'gpt-5.1-codex-max',
  'gpt-5.2', 'gpt-5.2-codex',
  'gpt-5.3-codex', 'gpt-5.3-codex-spark',
  'gpt-5.4', 'gpt-5.4-pro', 'gpt-5.4-mini', 'gpt-5.4-nano',
  'gpt-5.5', 'gpt-5.5-pro',
  'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna',
  'gpt-5', 'gpt-5-codex', 'gpt-5-nano',
  'claude-sonnet-5', 'claude-sonnet-4-6', 'claude-sonnet-4-5', 'claude-sonnet-4',
  'claude-opus-4-8', 'claude-opus-4-7', 'claude-opus-4-6', 'claude-opus-4-5', 'claude-opus-4-1',
  'claude-haiku-4-5', 'claude-fable-5',
  'gemini-3.5-flash', 'gemini-3.1-pro', 'gemini-3-flash',
  'deepseek-v4-pro', 'deepseek-v4-flash',
  'glm-5.2', 'glm-5.1', 'glm-5',
  'minimax-m3', 'minimax-m2.7', 'minimax-m2.5',
  'kimi-k2.7-code', 'kimi-k2.6', 'kimi-k2.5',
  'qwen3.6-plus', 'qwen3.5-plus',
  'grok-4.5', 'grok-build-0.1'
];

var GO_MODELS = [
  'grok-4.5',
  'kimi-k3', 'kimi-k2.7-code', 'kimi-k2.6', 'kimi-k2.5',
  'glm-5.2', 'glm-5.1', 'glm-5',
  'deepseek-v4-pro', 'deepseek-v4-flash',
  'qwen3.7-max', 'qwen3.7-plus', 'qwen3.6-plus', 'qwen3.5-plus',
  'mimo-v2-pro', 'mimo-v2-omni', 'mimo-v2.5-pro', 'mimo-v2.5',
  'minimax-m3', 'minimax-m2.7', 'minimax-m2.5',
  'hy3-preview'
];

module.exports = {
  name: 'opencode',

  isCompatible: function (endpoint) {
    return /opencode\.ai/i.test(endpoint);
  },

  buildRequest: function (provider, prompts, useJsonMode) {
    var body = {
      model: provider.model,
      temperature: provider.temperature,
      messages: [
        { role: 'system', content: prompts.system },
        { role: 'user', content: prompts.user }
      ]
    };
    if (useJsonMode) (body as any).response_format = { type: 'json_object' };

    var headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (provider.apiKey) headers['Authorization'] = 'Bearer ' + provider.apiKey;

    return {
      url: provider.endpoint,
      headers: headers,
      body: body
    };
  },

  parseResponse: function (data) {
    return (data.choices && data.choices[0] &&
      data.choices[0].message && data.choices[0].message.content) || '';
  },

  mapError: function (res, data) {
    if (res.status === 429) {
      var msg = (data.error && data.error.message) || '';
      var match = msg.match(/try again in ([\d.]+)s/);
      var retryAfterHeader = parseFloat(res.headers && res.headers.get && res.headers.get('retry-after'));
      return { retryAfter: match ? parseFloat(match[1]) : (retryAfterHeader || 10) };
    }
    return null;
  },

  retryWithoutJsonMode: true,

  freeModels: FREE_MODELS,
  paidModels: PAID_MODELS,
  goModels: GO_MODELS
};
