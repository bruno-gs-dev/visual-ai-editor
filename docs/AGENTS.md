<!-- visual-ai-editor:start -->
## visual-ai-editor

This project has [visual-ai-editor](https://www.npmjs.com/package/visual-ai-editor)
installed — an AI-powered visual HTML editor. A human selects an element on the
live page, describes a change in natural language, and a backend LLM (any
OpenAI-compatible provider — Groq by default) rewrites that element's HTML.
This section explains how it works so you (an AI agent) can use it correctly,
debug it, or extend it without re-deriving its architecture from scratch.

### What it is, concretely

- **Zero-config CLI** (`npx visual-ai-editor start`, or just
  `npx visual-ai-editor`): the default way to run it. First run creates a
  `.env` at the project root (the user pastes an API key there — the only
  manual step) and ensures `.gitignore` covers it; subsequent runs boot the
  server with the client **auto-injected into every served `.html` page** —
  no start script, no HTML edits. Flags: `--port <n>`, `--no-inject`,
  `--no-open`. Auto-injection is skipped for pages that already wire the
  editor manually or carry `data-ai-editor="off"`; the injected script loads
  the bundle from the server's stable virtual path
  `/__ai-editor/ai-editor.esm.js`.
- **Client** (`visual-ai-editor`, imported in the page): injects a floating
  toolbar + selection tools (click, area-drag, lasso) into the DOM. Selecting
  one or more elements opens a panel where the user types an instruction.
  `init({ apiBase, apiToken, cssInject, cssUrl, locale, maxHtmlSize,
  onAfterApply, onAfterUndo })` boots it; `destroy()` tears it down (call on
  component unmount in React/Vue/Angular). With the zero-config CLI this
  import happens automatically; manual wiring is only needed for framework
  (React/Vue/Angular) pages or custom setups.
- **Server** (`visual-ai-editor/server`, `require('visual-ai-editor/server')`):
  an Express app exposing four endpoints. `startServer({ port, envPath,
  designMdPath, indexHtmlPath, staticDir, apiToken, allowUnsafeProduction,
  locale, backup, maxHtmlBytes, inject, ai })` boots it in-process — either
  via the CLI above (which sets `inject: true`) or from a small `start-*.js`
  script (see `start-ai-editor.js` at this project's root, if present).
  Programmatic `startServer()` defaults to `inject: false` so existing
  setups keep their exact behavior.

### The API contract

| Method | Endpoint | Request | Response |
|---|---|---|---|
| `POST` | `/api/edit` | `{ html, instruction, selector, css, force }` | `{ html }` on success; `{ warn }` or `{ warn, violations, html }` if the request conflicts with `DESIGN.md` and `force` wasn't set (the attached `html` lets the client force-apply locally with zero extra AI calls); `{ error }` on failure |
| `GET` | `/api/design` | — | `{ md, exists, palette }` — `md` is the raw `DESIGN.md` content, `palette` is every color extracted from it |
| `POST` | `/api/save` | `{ html?, page?, patches? }` | `{ ok, path, mode, backup, applied? }` — `patches` (`[{ before, after }]`) are applied surgically against the source file; `html` is the fallback/full-snapshot path; `mode` is `'patch'` or `'full'` |
| `POST` | `/api/handoff` | `{ changes: [{ source, selector, instruction, before, after }] }` | `{ ok, path, count }` — appends to `.ai-editor/pending-changes.md`, for pages where the DOM can't be written straight back to source (see below) |

All three write endpoints (`/api/edit`, `/api/save`, `/api/handoff`) require an
`Authorization: Bearer <token>` header **if and only if** the server was
started with an `apiToken` option. If you're debugging a 401, check whether
the client was initialized with the matching `apiToken` — see `README.md`'s
"Security & production" section for why this exists (it's a shared-secret
check, not real auth).

### DESIGN.md — the thing that keeps edits on-brand

If `DESIGN.md` exists at the project root, its full content is injected into
the system prompt sent to the LLM on every `/api/edit` call, with the
instruction to follow it strictly (the file is re-read whenever its mtime
changes — no server restart needed after editing it). This is the mechanism
that stops the AI editor from inventing colors, spacing, or components
outside the project's design system — reinforced by a **deterministic**
server-side check: every color mentioned anywhere in `DESIGN.md` is extracted
into a palette, and any `/api/edit` response introducing a color outside that
palette (and not already present in the input) is downgraded to a warning
automatically, even if the model itself didn't notice the conflict.

**If asked to "improve", "fix", or "clean up" this editor's behavior, check for
`DESIGN.md` first** (`cat DESIGN.md` or `GET /api/design`). If it's missing or
thin, the highest-leverage fix is usually creating/completing it, not tweaking
prompt logic in `server/index.js`. Run:

```bash
npx visual-ai-editor design:check   # reports which of 11 recommended sections exist
npx visual-ai-editor design:init    # writes DESIGN.prompt.md — a guided interview + template
npx visual-ai-editor design:lint    # scans the project for off-palette colors right now
```

`design:init`'s output (`DESIGN.prompt.md`) is meant to be fed to you (or
another agent) directly — it contains the full interview questions, the
11-section structure, and a validation checklist, sourced from
https://camaraux.com.br/como-criar-aplicar-design-md-ia/. If a human asks you
to "set up the design system" for this project, that file is the playbook —
follow it rather than improvising your own structure. `design:lint` is useful
if asked to audit existing CSS/HTML/JS for drift from the documented palette.

### force mode

When the LLM detects the user's instruction conflicts with `DESIGN.md` (e.g.
asking for a color outside the palette, or a border-radius that breaks the
documented scale), it responds with `{"warn": "..."}` instead of applying the
change (the server requires this as a single structured JSON response — see
`parseModelResponse` in `server/index.js` if you're debugging a model that
isn't following the contract). The deterministic palette check can also
produce a warning even when the model itself applied the edit — in that case
the server attaches the already-computed `html` to the response. The client
shows the warning with an "apply anyway" button: if `html` was attached, force
applies it directly (no second AI call); otherwise it re-sends the request
with `force: true`, which is passed into the LLM's user prompt instructing it
to apply the change regardless of the conflict, and skips the deterministic
palette check server-side.

### Saving: surgical patches vs. AI-agent handoff

`saveToFile()` on the client behaves differently depending on what it detects:

- **No framework source detected** on any recorded edit → sends `patches`
  (`[{ before, after }]`, the literal HTML that changed) plus a full-page
  `html` snapshot as fallback to `/api/save`. The server tries an exact
  substring match first, then a whitespace-tolerant regex match (handles
  reformatted/prettified source), and only writes the full snapshot if a
  patch's `before` text can't be located at all. A timestamped backup goes to
  `.ai-editor/history/` before every write.
  - **Note for Angular without the plugin**: Angular has no built-in source
    metadata (no fiber, no `__file`), so every Angular project falls here by
    default. Install `@ai-editor/angular-plugin` to fix it (see below).
- **Framework source detected** (React `_debugSource` fiber data, Vue 3
  `__file` component metadata, Angular via `@ai-editor/angular-plugin`'s
  `data-ai-source` injection, or an explicit `data-ai-source="file:line"`
  attribute) on any recorded edit → posts to `/api/handoff` instead, appending
  a change manifest to `.ai-editor/pending-changes.md`. **If asked to "apply
  the visual edits" on a React/Vue/Angular project, read that file** — it lists
  each edit's detected source location, instruction, and before/after HTML;
  apply each to the real JSX/template source, adapting the markup to the
  framework, then delete the entry.

### Troubleshooting

- **Toolbar doesn't appear**: check the browser console for 404s on the
  editor's own bundle (`dist/ai-editor.esm.js` or `.js`). If the page imports it
  from `node_modules/visual-ai-editor/dist/...` and the server's static
  middleware blocks `node_modules/` (it does, by design — see below), confirm
  you're running a `visual-ai-editor@>=1.2.1` server, which explicitly
  allowlists its own `dist/` path.
- **`/api/edit` returns 500 "no AI API key configured"**: the server process
  doesn't have an API key in its environment. Check `envPath` was passed to
  `startServer()` and points at a `.env` file with `AI_API_KEY` (or the
  legacy `GROQ_API_KEY`) set.
- **Static files served include the whole project except a short blocklist**:
  `.git`, `node_modules` (except this package's own `dist/`), `.env*`,
  lockfiles, `.ssh`, `.aws`, and `.ai-editor` (backups + handoff manifests) are
  blocked by the server regardless of `staticDir`. Everything else under
  `staticDir` (default: `process.cwd()`) is served — this is intentional (the
  editor's own HTML/CSS/JS needs to be reachable) but means you should not
  point `staticDir` at a directory containing anything sensitive that isn't in
  that blocklist.
- **Editing multiple selected elements returns a count mismatch error**: the
  LLM is expected to return exactly as many top-level elements as were
  selected, wrapped in a `<div data-ai-multi>` container. If the model drops or
  merges elements, that's a prompting/model issue, not a client bug — the
  client's count check (`src/actions.js`, `_swapElements`) is intentionally
  strict to avoid silently corrupting the DOM.
- **A save via `/api/save` returns `mode: 'full'` when you expected `'patch'`**:
  one or more patches' `before` text couldn't be located in the current source
  — most likely the file was hand-edited since the last visual edit. Not a
  bug; the fallback is intentional so the edit isn't lost.
- **Elements stop responding to clicks after an AI edit**: `replaceWith`
  drops any listeners attached directly to the replaced element. Pass
  `onAfterApply` to `init()` to re-bind them — see `README.md`'s "Event
  listeners on edited elements" section.
- **Angular app with no save target**: if Save produces a full-page HTML
  snapshot instead of targeted patches, the editor detected no framework
  source. Angular does not emit source metadata natively. Install
  `@ai-editor/angular-plugin` and configure it in `angular.json` to
  auto-inject `data-ai-source` attributes during `ng serve` — see
  README.md's Angular section.

### This is a dev/staging tool by default

Don't wire `init()` into a public production bundle without reading this
project's `node_modules/visual-ai-editor/README.md` "Security & production"
section first — the editor UI has no visibility gate of its own, and the
backend's `apiToken` is a shared secret (visible in served client code), not
real authentication.
<!-- visual-ai-editor:end -->
