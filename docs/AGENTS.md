<!-- visual-ai-editor:start -->
## visual-ai-editor

This project has [visual-ai-editor](https://www.npmjs.com/package/visual-ai-editor)
installed — an AI-powered visual HTML editor. A human selects an element on the
live page, describes a change in natural language, and a backend LLM (Groq)
rewrites that element's HTML. This section explains how it works so you (an AI
agent) can use it correctly, debug it, or extend it without re-deriving its
architecture from scratch.

### What it is, concretely

- **Client** (`visual-ai-editor`, imported in the page): injects a floating
  toolbar + selection tools (click, area-drag, lasso) into the DOM. Selecting
  one or more elements opens a panel where the user types an instruction.
  `init({ apiBase, apiToken, cssInject, cssUrl })` boots it;
  `destroy()` tears it down (call on component unmount in React/Vue/Angular).
- **Server** (`visual-ai-editor/server`, `require('visual-ai-editor/server')`):
  an Express app exposing three endpoints. `startServer({ port, envPath,
  designMdPath, indexHtmlPath, staticDir, apiToken, allowUnsafeProduction })`
  boots it in-process — most projects run this from a small `start-*.js` script
  (see `start-ai-editor.js` at this project's root, if present).

### The API contract

| Method | Endpoint | Request | Response |
|---|---|---|---|
| `POST` | `/api/edit` | `{ html, instruction, selector, force }` | `{ html }` on success, `{ warn }` if the request conflicts with `DESIGN.md` and `force` wasn't set, `{ error }` on failure |
| `GET` | `/api/design` | — | `{ md, exists }` — `md` is the raw `DESIGN.md` content (empty string if absent), `exists` is a boolean |
| `POST` | `/api/save` | `{ html }` | `{ ok, path }` — writes the full page HTML to `indexHtmlPath` (default `<cwd>/index.html`) |

`/api/edit` and `/api/save` require an `Authorization: Bearer <token>` header
**if and only if** the server was started with an `apiToken` option. If you're
debugging a 401 from either endpoint, check whether the client was initialized
with the matching `apiToken` — see `README.md`'s "Security & production"
section for why this exists (it's a shared-secret check, not real auth).

### DESIGN.md — the thing that keeps edits on-brand

If `DESIGN.md` exists at the project root, its full content is injected into
the system prompt sent to the LLM on every `/api/edit` call, with the
instruction to follow it strictly. This is the mechanism that stops the AI
editor from inventing colors, spacing, or components outside the project's
design system.

**If asked to "improve", "fix", or "clean up" this editor's behavior, check for
`DESIGN.md` first** (`cat DESIGN.md` or `GET /api/design`). If it's missing or
thin, the highest-leverage fix is usually creating/completing it, not tweaking
prompt logic in `server/index.js`. Run:

```bash
npx visual-ai-editor design:check   # reports which of 11 recommended sections exist
npx visual-ai-editor design:init    # writes DESIGN.prompt.md — a guided interview + template
```

`design:init`'s output (`DESIGN.prompt.md`) is meant to be fed to you (or
another agent) directly — it contains the full interview questions, the
11-section structure, and a validation checklist, sourced from
https://camaraux.com.br/como-criar-aplicar-design-md-ia/. If a human asks you
to "set up the design system" for this project, that file is the playbook —
follow it rather than improvising your own structure.

### force mode

When the LLM detects the user's instruction conflicts with `DESIGN.md` (e.g.
asking for a color outside the palette, or a border-radius that breaks the
documented scale), it responds with `{ warn: "..." }` instead of applying the
change. The client shows this warning with an "apply anyway" button, which
re-sends the same request with `force: true` — that flag is passed straight
into the LLM's user prompt, instructing it to apply the change regardless of
the conflict. There's no other server-side gate; force mode is purely a
client-side re-request with a different flag.

### Troubleshooting

- **Toolbar doesn't appear**: check the browser console for 404s on the
  editor's own bundle (`dist/ai-editor.esm.js` or `.js`). If the page imports it
  from `node_modules/visual-ai-editor/dist/...` and the server's static
  middleware blocks `node_modules/` (it does, by design — see below), confirm
  you're running a `visual-ai-editor@>=1.2.1` server, which explicitly
  allowlists its own `dist/` path.
- **`/api/edit` returns 500 "Servidor sem GROQ_API_KEY configurada"**: the
  server process doesn't have `GROQ_API_KEY` in its environment. Check
  `envPath` was passed to `startServer()` and points at a `.env` file that
  actually has the key.
- **Static files served include the whole project except a short blocklist**:
  `.git`, `node_modules` (except this package's own `dist/`), `.env*`,
  lockfiles, `.ssh`, `.aws` are blocked by the server regardless of
  `staticDir`. Everything else under `staticDir` (default: `process.cwd()`) is
  served — this is intentional (the editor's own HTML/CSS/JS needs to be
  reachable) but means you should not point `staticDir` at a directory
  containing anything sensitive that isn't in that blocklist.
- **Editing multiple selected elements returns a count mismatch error**: the
  LLM is expected to return exactly as many top-level elements as were
  selected, wrapped in a `<div data-ai-multi>` container. If the model drops or
  merges elements, that's a prompting/model issue, not a client bug — the
  client's count check (`src/actions.js`, `applyWithAI`) is intentionally
  strict to avoid silently corrupting the DOM.

### This is a dev/staging tool by default

Don't wire `init()` into a public production bundle without reading this
project's `node_modules/visual-ai-editor/README.md` "Security & production"
section first — the editor UI has no visibility gate of its own, and the
backend's `apiToken` is a shared secret (visible in served client code), not
real authentication.
<!-- visual-ai-editor:end -->
