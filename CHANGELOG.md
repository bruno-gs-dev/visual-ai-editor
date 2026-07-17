# Changelog

## 1.4.0

### Added
- **Surgical saves.** `/api/save` now accepts `patches: [{ before, after }]`
  and applies them as targeted replacements in the source file (exact match,
  then a whitespace-tolerant fallback for reformatted source), instead of
  always overwriting the whole file with a serialized DOM snapshot. Falls back
  to a full-file write only when a patch can't be located.
- **Automatic backups.** Every `/api/save` write is preceded by a timestamped
  copy to `.ai-editor/history/` (capped at the 100 most recent per file).
  New `backup` option (`startServer`) to disable.
- **Multi-page support.** `/api/save` accepts a `page` field (the browser's
  `location.pathname`) and resolves it to a file inside `staticDir`, safely
  rejecting path traversal.
- **AI-agent handoff for frameworks.** New `POST /api/handoff` endpoint —
  framework pages (React/Vue, detected via fiber/`__file` metadata or an
  explicit `data-ai-source` attribute) export a change manifest to
  `.ai-editor/pending-changes.md` instead of corrupting rendered output on
  save. An AI coding agent applies the listed changes to real source files.
- **Deterministic palette enforcement.** New `lib/design-tokens.js` extracts
  every color mentioned in `DESIGN.md` and flags any color a `/api/edit`
  response introduces that isn't in that set — independent of whether the
  model itself noticed the conflict. The response includes the computed
  `html` so "apply anyway" (force mode) costs zero extra AI calls.
- **`design:lint` CLI command.** Scans a project's CSS/HTML/JS for colors not
  present in `DESIGN.md`'s palette.
- **Provider-agnostic AI backend.** New `ai: { endpoint, model, apiKey,
  jsonMode, temperature }` server option (and `AI_ENDPOINT`/`AI_MODEL`/
  `AI_API_KEY` env vars) — any OpenAI-compatible chat-completions API works
  (OpenAI, OpenRouter, Ollama, LM Studio, ...), not just Groq. Legacy
  `GROQ_API_KEY`/`GROQ_MODEL` still work as a fallback.
- **Structured JSON responses from the model** (`response_format:
  json_object`, with automatic fallback if a provider rejects it), replacing
  fragile "does the response start with `{`" parsing.
- **Redo.** Ctrl+Y (or Ctrl+Shift+Z) redoes an undone edit; new toolbar button.
- **CSS context in AI prompts.** The client collects same-origin CSS rules
  matching the selection (and a sample of descendants) and sends them as
  `css`, so the model knows what existing classes actually do.
- **Size guards.** `maxHtmlSize` (client, default 60000 chars) and
  `maxHtmlBytes` (server, default 200000) reject oversized selections before
  spending a request/AI call.
- **`onAfterApply` / `onAfterUndo` hooks.** `init()` options to re-bind event
  listeners on elements after a DOM replacement — needed for plain
  `addEventListener` wiring that isn't part of a framework's own reactivity.
- **English / Portuguese (pt-BR) UI**, both client and server messages.
  Auto-detected from `<html lang>` (client) or explicit `locale` option
  (client and server).
- **TypeScript types** for both entry points (`visual-ai-editor`,
  `visual-ai-editor/server`) — no `@types/*` package needed.
- **Test suite** (`npm test`, `node:test`) covering token extraction, patch
  matching, and every server endpoint.

### Changed
- `GET /api/design` now also returns `palette` (array of colors extracted
  from `DESIGN.md`).
- `.ai-editor/` (backups + handoff manifests) is now blocked by the static
  file server's sensitive-path check, alongside `.git`, `node_modules`, etc.

### Fixed
- N/A (first changelog entry — prior versions were not tracked here).

## Prior versions
See git history / npm package versions before 1.4.0 for earlier changes.
