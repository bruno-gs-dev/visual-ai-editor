/**
 * Legacy shim — for backward compatibility with users who did:
 *   node node_modules/visual-ai-editor/server/server.js
 *
 * The real implementation now lives in ./index.js (programmatic API).
 */
const { startServer } = require('./index.js');
startServer();
