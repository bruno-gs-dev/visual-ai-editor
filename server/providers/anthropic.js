/**
 * visual-ai-editor — Anthropic (Claude) provider adapter
 *
 * Handles the Anthropic Messages API, which differs from OpenAI:
 *   - Auth header: x-api-key (not Bearer)
 *   - System prompt: separate field (not inside messages)
 *   - max_tokens: required
 *   - Response: content[0].text (not choices[0].message.content)
 *   - No native JSON mode
 */

var ANTHROPIC_VERSION = '2023-06-01';
var DEFAULT_MAX_TOKENS = 4096;

module.exports = {
  name: 'anthropic',

  isCompatible: function (endpoint) {
    return /anthropic\.ai|api\.anthropic\.com/i.test(endpoint);
  },

  buildRequest: function (provider, prompts, useJsonMode) {
    var headers = {
      'Content-Type': 'application/json',
      'x-api-key': provider.apiKey,
      'anthropic-version': ANTHROPIC_VERSION
    };

    var body = {
      model: provider.model,
      max_tokens: provider.maxTokens || DEFAULT_MAX_TOKENS,
      system: prompts.system,
      messages: [
        { role: 'user', content: prompts.user }
      ]
    };

    return {
      url: provider.endpoint,
      headers: headers,
      body: body
    };
  },

  parseResponse: function (data) {
    return (data.content && data.content[0] && data.content[0].text) || '';
  },

  mapError: function (res, data) {
    if (res.status === 429) {
      var retryAfterHeader = parseFloat(res.headers && res.headers.get && res.headers.get('retry-after'));
      return { retryAfter: retryAfterHeader || 10 };
    }
    return null;
  },

  retryWithoutJsonMode: false
};
