# Changelog

## Unreleased

### Fixed (documentation)
Closes the remaining gaps found by the same audit that produced 1.6.1 — all of
these describe behavior that has shipped for several versions but had lost its
documentation in a README rewrite.

- **"Saving Edits" restored.** Save behaves in two fundamentally different ways
  and neither was explained: static pages get surgical `{ before, after }`
  patches (with a documented fallback to a full-file write when the `before`
  text can't be located), while React/Vue pages write **nothing** to source and
  export a manifest to `.ai-editor/pending-changes.md` instead. Without this,
  clicking Save on a React page and finding the JSX unchanged reads as a bug.
- **Event-listener caveat restored.** Applying an edit uses
  `el.replaceWith(newEl)`, which drops listeners bound with `addEventListener`
  — silently, with no console error. Documents `onAfterApply`/`onAfterUndo` as
  the re-binding hook, with an example.
- **"AI Providers" restored.** The `provider: 'ollama' | 'lmstudio'` presets,
  `requiresApiKey`, the `AI_ENDPOINT`/`AI_MODEL` env vars, the note on model
  capability, and the still-honored legacy `GROQ_API_KEY`/`GROQ_MODEL`
  fallback.
- **CSS variables restored** — `--font`, `--warning` and `--lg` are read by
  `styles/ai-editor.css` and were undocumented.
- Endpoint table now states the real response shapes (`/api/edit` can return
  `{ warn, violations, html }`); added the agent handoff to the feature table
  and Providers/Saving/Security to the header nav.

## 1.6.1

### Added
- **`demo/` — a real, runnable demo.** A self-contained landing page plus a
  matching `DESIGN.md` whose palette closes exactly over the colors the page
  uses, so the deterministic off-palette check has something real to reject.
  `cd demo && npx visual-ai-editor start` boots it; `design:lint` reports zero
  violations and `design:check` reports 11/11 sections. Shipped in the npm
  tarball (`files` now includes `demo/`).

### Changed
- README's Demo section replaced the three "GIF placeholder" blocks with the
  actual commands, real CLI output, and the three scenarios to walk through.
- `.gitignore` now covers `.ai-editor/` (save backups and handoff manifests).

### Fixed (documentation)
- Restored two security notes that describe real behavior and had been dropped
  from the README: the server **refuses to start** under `NODE_ENV=production`
  without an `apiToken` (and `allowUnsafeProduction` is the deliberate opt-out),
  and the client toolbar has **no visibility gate** — shipping `init()` in a
  production bundle exposes the editor UI to every visitor.
- Documented `agents:init` and the `AGENTS.md` that postinstall delivers to the
  consumer's project root; neither was mentioned in the README, despite the
  install writing to the user's repo.
- Restored option rows that exist in code and types but had no documentation:
  `cssUrl` (client), `allowUnsafeProduction`, `silent`, `maxHtmlBytes` (server).

## 1.6.0

### Added
- **Zero-config start: `npx visual-ai-editor start`** (bare
  `npx visual-ai-editor` does the same). First run creates a `.env` from a
  commented template (paste your key into `AI_API_KEY=` — the only manual
  step) and makes sure `.gitignore` covers it; the next run boots the server
  and opens the browser. Flags: `--port <n>`, `--no-inject`, `--no-open`.
  Local endpoints (Ollama/LM Studio via `AI_ENDPOINT`) skip the key
  requirement, matching the server's existing behavior.
- **Client auto-injection (`inject` server option).** With `inject: true`,
  every `.html` page served from `staticDir` gets the editor's module script
  injected before `</body>` — no manual `<script>` wiring. Pages that
  already load the editor, or carry `data-ai-editor="off"`, are skipped
  deterministically; when the server has an `apiToken`, it's passed through
  to `init()`. **Default is `false`** for programmatic
  `startServer()`/`buildApp()` — only the CLI `start` path turns it on — so
  existing setups keep their exact behavior.
- **Stable bundle path `/__ai-editor/`.** The server now always serves this
  package's own `dist/` at `/__ai-editor/` (e.g.
  `/__ai-editor/ai-editor.esm.js`), independent of where the package
  physically lives (local `node_modules`, npx cache, pnpm store). The old
  `node_modules/visual-ai-editor/dist/` path still works.
- `lib/env-init.js` + `templates/env.template`: reusable `.env`
  bootstrap/validation logic (also the new single source of truth for the
  "localhost endpoints don't need an API key" rule, previously private to
  `server/index.js`).

### Changed
- Bare `npx visual-ai-editor` (no command) now runs `start` instead of
  printing usage; `help`/`--help`/`-h` print usage explicitly.
- `postinstall` now points at `npx visual-ai-editor start` as the next step.
- `server/.env.example` updated to the provider-agnostic `AI_*` variables
  (the legacy `GROQ_*` ones are still honored and still documented).
- README's "Plug & play" section replaced by "Zero-config start"; the
  start-script + script-tag flow moved to "Manual wiring" (still fully
  supported, and required for framework pages).

## 1.5.0

### Added
- **Bundled `marked`.** The DESIGN.md viewer's markdown rendering no longer
  requires a separate `npm install marked` — `marked`'s browser bundle is
  embedded directly into `dist/ai-editor.esm.js` and `dist/ai-editor.js` at
  build time (as a global, the same way the client already checked for it).
  `marked` moved from an optional peerDependency to a build-time-only
  devDependency; consumers never need to install or import it themselves.
- **First-class local-provider support (Ollama, LM Studio).** New `ai:
  { provider: 'ollama' | 'lmstudio', model }` shorthand resolves to the
  right localhost endpoint automatically. An explicit `ai.endpoint` still
  overrides the preset — this is sugar on top of the existing generic
  contract, not a replacement for it.
- New `ai.requiresApiKey` option (auto-detected: `false` for
  `localhost`/`127.0.0.1` endpoints, `true` otherwise) to override either
  direction explicitly.

### Fixed
- **`/api/edit` no longer hard-requires an API key for local endpoints.**
  Previously any missing `apiKey` returned a 500, which made Ollama/LM
  Studio unusable without fabricating a dummy key. Remote providers
  (Groq, OpenAI, ...) still correctly require one.
- **The build's minifier no longer corrupts string literals containing
  `"://"`** (e.g. `SVG_NS: 'http://www.w3.org/2000/svg'`) — its line-comment
  stripping regex was treating the `//` inside the URL as a comment start.
  Caught while adding a build-output regression test
  (`test/build.test.js`) for the bundled-marked work above; this bug
  predates this release and affected every previously-published
  `dist/ai-editor.min.js`.
- **`startServer()`/`buildApp()`'s default `indexHtmlPath` now derives from
  `staticDir`** instead of `process.cwd()`. Previously, passing a custom
  `staticDir` without also passing `indexHtmlPath` meant `/api/save`
  silently wrote to `<cwd>/index.html` — usually outside the directory
  actually being served, and not reachable through the running server.
  Caught because it was actively polluting this very repo's root directory
  during `npm test` runs (any save-endpoint test using a custom `staticDir`
  without overriding `indexHtmlPath` was writing next to `package.json`
  instead of into its temp directory). No change for the common case
  (default `staticDir` = `process.cwd()`, so the default `indexHtmlPath` is
  unchanged there too) — only customized-`staticDir` setups without an
  explicit `indexHtmlPath` behave differently now, and correctly so.

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
