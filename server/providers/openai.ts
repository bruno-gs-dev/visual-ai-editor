/**
 * visual-ai-editor — OpenAI-compatible provider adapter
 *
 * Handles: Groq, OpenAI, OpenRouter, Together, Fireworks, vLLM,
 *          Ollama, LM Studio, and any endpoint speaking the
 *          OpenAI Chat Completions protocol.
 *
 * This is the default/fallback adapter — if no other adapter
 * matches the endpoint, this one handles it.
 */

module.exports = {
  name: 'openai',

  /** Always compatible — this is the fallback adapter. */
  isCompatible: function () {
    return true;
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

  retryWithoutJsonMode: true
};
