// Type definitions for visual-ai-editor/server
//
// `app`/`server` below are intentionally typed as `any` rather than importing
// express's types — this package depends on express, but requiring consumers
// to also have @types/express installed just to use startServer() would be
// an unnecessary friction point. Cast to `import('express').Express` yourself
// if you need the full type.

export interface AIProviderOptions {
  /** OpenAI-compatible chat-completions endpoint. Default: Groq's endpoint. */
  endpoint?: string;
  /** Model name understood by the endpoint. */
  model?: string;
  /** API key for the provider. Falls back to AI_API_KEY / GROQ_API_KEY env vars. */
  apiKey?: string;
  /** Request structured JSON output (response_format: json_object). Default: true. Falls back automatically if the provider rejects it. */
  jsonMode?: boolean;
  /** Sampling temperature. Default: 0.2 */
  temperature?: number;
}

export interface ServerOptions {
  /** Port to listen on. Default: process.env.PORT or 3000 */
  port?: number;
  /** Path to a .env file to load. */
  envPath?: string;
  /** Where to read the design system reference from. Default: <cwd>/DESIGN.md */
  designMdPath?: string;
  /** Fallback save target when no "page" is specified in /api/save. Default: <cwd>/index.html */
  indexHtmlPath?: string;
  /** Directory served as static files. Default: process.cwd() */
  staticDir?: string;
  /** Shared secret required (as a Bearer token) on /api/edit, /api/save, /api/handoff. */
  apiToken?: string;
  /** Bypass the NODE_ENV=production safety check. Only if auth is handled at another layer. */
  allowUnsafeProduction?: boolean;
  /** Build the Express app without calling .listen(). Also suppresses startup logs. */
  silent?: boolean;
  /** User-facing message language. 'en' (default) or 'pt-BR'. */
  locale?: 'en' | 'pt-BR' | string;
  /** Write a timestamped backup to .ai-editor/history/ before each save. Default: true */
  backup?: boolean;
  /** Reject /api/edit selections whose HTML exceeds this many bytes. Default: 200000 */
  maxHtmlBytes?: number;
  /** LLM provider configuration. Any OpenAI-compatible chat-completions API works. */
  ai?: AIProviderOptions;
}

export interface StartServerResult {
  app: any;
  server?: any;
  port: number;
}

export function startServer(options?: ServerOptions): StartServerResult;
export function buildApp(options?: ServerOptions): any;
