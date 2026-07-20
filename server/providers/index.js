/**
 * visual-ai-editor — provider registry
 *
 * Auto-detects which adapter to use based on the endpoint URL.
 * Adapters are checked in order; first match wins.
 * The OpenAI adapter is the fallback (always compatible).
 */

var anthropicAdapter = require('./anthropic');
var opencodeAdapter = require('./opencode');
var openaiAdapter = require('./openai');

var adapters = [anthropicAdapter, opencodeAdapter, openaiAdapter];

/**
 * Resolve the adapter for a given endpoint.
 * @param {string} endpoint
 * @returns {object} adapter
 */
function resolve(endpoint) {
  for (var i = 0; i < adapters.length; i++) {
    if (adapters[i].isCompatible(endpoint)) return adapters[i];
  }
  return openaiAdapter;
}

/**
 * List all registered adapter names.
 * @returns {string[]}
 */
function list() {
  return adapters.map(function (a) { return a.name; });
}

module.exports = {
  resolve: resolve,
  list: list
};
