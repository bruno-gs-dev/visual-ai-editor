# Roadmap — visual-ai-editor

This file tracks in-progress and planned work across AI sessions. If you're an
AI agent picking this up, read this whole file before touching code — it
tells you what's shipped, what's mid-flight, and why decisions were made.

## Status snapshot (last updated: session ending 2026-07-17, third pass)

- **Published on npm: 1.5.0** (commit `8d2ad5f`, pushed to `origin/main`).
  Local working tree is at **1.6.0** — zero-config start (`npx
  visual-ai-editor start`, auto-generated `.env`, client auto-injection via
  the server's `inject` option, stable `/__ai-editor/` bundle path). Tested
  (51-test suite green + real E2E in a fresh empty project: pack → install →
  first run creates `.env` → second run serves with the toolbar injected).
  Publishing 1.6.0 is the next step — check `npm view visual-ai-editor
  version` and `git log -1` before redoing anything.
- Full spec for the 1.6.0 feature: `.specs/features/zero-config-start/spec.md`.
  Brownfield codebase docs (stack, architecture, conventions, testing,
  concerns): `.specs/codebase/`.
- **Context**: this package started as a personal project (`smartvia` is the
  real-world test bed, a separate local project at `../smartvia`, consuming
  this package from npm — not a monorepo link). A full review identified it
  as "prototype-grade" and this roadmap is the work to make it production-
  usable for arbitrary frontends, not just static-HTML demos.
- **1.4.0 shipped** (committed `e9415e7`, pushed to `origin/main`, published
  to npm): surgical `/api/save` patching (exact + whitespace-tolerant match)
  with automatic pre-save backups, multi-page resolution, `/api/handoff` for
  framework (React/Vue) pages, provider-agnostic AI backend (any OpenAI-
  compatible endpoint via `ai.endpoint/model/apiKey` or `AI_ENDPOINT`/
  `AI_MODEL`/`AI_API_KEY` env vars, Groq remains the default), structured
  JSON responses from the model, deterministic server-side color-palette
  enforcement (`lib/design-tokens.js`) independent of the model's own
  judgment, `design:lint` CLI command, client-side redo, CSS-context
  collection sent to the model, size guards (client `maxHtmlSize` / server
  `maxHtmlBytes`), `onAfterApply`/`onAfterUndo` hooks, English/Portuguese
  (pt-BR) UI on both client and server, TypeScript types for both entry
  points, and a 30-test suite (`node:test`, `npm test`).
- Verified live against smartvia (real project at `../smartvia`): surgical
  save on the real `index.html` (1-line diff, confirmed via `diff` against
  the auto-backup, then restored), `/api/edit` happy path + off-palette
  warning + force-apply against the real Groq API, `/api/handoff` manifest
  write, clean `npm install` from the real registry into smartvia.
- **1.5.0 done in this session, not yet released** (see "Shipped this
  session, pending release" below): `marked` bundled directly (no separate
  install), first-class Ollama/LM Studio support with a real bug fix, plus
  a real pre-existing minifier bug caught and fixed along the way.

## Shipped this session, pending release (local tree, not yet in a commit)

### 1. Bundled `marked` — no separate install step

Done. `marked`'s browser UMD bundle
(`node_modules/marked/lib/marked.umd.js`, v18.0.6, ~43KB) is now embedded as
an independent top-level statement, prepended to `dist/ai-editor.esm.js`,
`dist/ai-editor.js`, and `dist/ai-editor.min.js` in `scripts/build.js`. It's
a self-executing UMD IIFE that, in a browser (no `module`/`exports`/AMD
`define`), falls through to `globalThis.marked = f()` — exactly what
`typeof marked !== 'undefined'` in `src/actions.js` already checked for, so
no client code changes were needed. `marked` moved from
`peerDependencies`/`peerDependenciesMeta` (removed) to `devDependencies` —
it's build-time only now.

**Verified**: ran each of the three dist files in a sandboxed VM context
with no `module`/`exports`/AMD globals (simulating a real `<script>` tag) via
`node:vm`, confirmed `typeof marked === 'object'` and `marked.parse(...)`
produces correct HTML in all three, and confirmed `AIEditor.init` still
works alongside it in the same file. Also confirmed via ESM dynamic
`import()` that the ESM bundle sets the same global. Regression-tested in
`test/build.test.js` (4 new tests) so a future "let's clean up build.js"
pass can't silently drop the embedding again.

**Bug found and fixed along the way** (unrelated to marked, but caught
while stress-testing the minified bundle for the first time): the crude
regex minifier's line-comment stripper (`.replace(/\/\/[^\n]*/g, '')`) was
treating the `//` inside string literals like `SVG_NS:
'http://www.w3.org/2000/svg'` as a comment start, corrupting
`dist/ai-editor.min.js` — this predates this session and affected every
previously-published version's minified bundle (nobody had runtime-tested
`ai-editor.min.js` specifically before; `ai-editor.js` and `.esm.js` were
fine). Fixed with a negative lookbehind excluding `//` immediately preceded
by `:` (real line comments in this codebase are never written that way).
`test/build.test.js` asserts `SVG_NS` survives minification intact.

### 2. First-class local-provider support (Ollama, LM Studio)

Done. `server/index.js` (`resolveProvider`):
- New `ai.provider: 'ollama' | 'lmstudio'` preset — resolves `endpoint` to
  `http://localhost:11434/v1/chat/completions` or
  `http://localhost:1234/v1/chat/completions` respectively. An explicit
  `ai.endpoint` still overrides the preset.
- **Fixed the real bug**: `/api/edit` previously did `if
  (!provider.apiKey){ return 500 }` unconditionally — this made Ollama/LM
  Studio unusable without a fake key. Now gated behind
  `provider.requiresApiKey`, which auto-detects `false` for a
  `localhost`/`127.0.0.1`/`::1`/`0.0.0.0` endpoint host and `true`
  otherwise; `ai.requiresApiKey: true|false` overrides the auto-detection
  explicitly in either direction. Remote providers (Groq, OpenAI, ...)
  still correctly require a key — this was verified to NOT regress (see
  tests below).

**Verified live** against a real, already-running local Ollama instance on
this machine (`ollama --version` → 0.31.2):
- Confirmed the no-apiKey request path actually reaches Ollama's
  OpenAI-compat endpoint (no auth-related 500) — a 9B model (`ornith:9b`)
  hit an out-of-memory error from `llama-server` itself (this machine had
  very little free RAM at the time — `wmic OS get FreePhysicalMemory`
  showed ~556MB free out of ~24GB total, likely other processes hogging
  it), which our error handling surfaced correctly as a 500 with the raw
  llama-server error message — proving the integration path itself works,
  independent of the OOM.
- Switched to a smaller model (`llama3.2:3b`, 2GB) that fit in available
  memory. A short, simple prompt (no DESIGN.md, no force-mode rules) round-
  tripped perfectly. Our **actual** full system prompt (DESIGN.md section +
  force-mode + the `{html}`/`{warn}` JSON contract) caused this specific 3B
  model to produce truncated/malformed JSON (`finish_reason: "stop"`, not a
  token-limit cutoff — the model itself decided it was done after
  producing broken output). Diagnosed by hitting Ollama directly with curl/
  fetch, bypassing our server, to isolate "is this our parsing or the
  model's output" — confirmed it's the model's raw output that's broken,
  not a parsing bug on our end. **Deliberately did not add compensating
  code** for this (e.g., a "simple mode" prompt for weak local models) —
  that's scope creep past what was asked; documented it honestly in
  README's "Choosing an AI provider" section instead ("a note on model
  capability"). If a future session wants to actually improve small-model
  reliability, that's a legitimate next step, but treat it as new,
  deliberately-scoped work, not a bug fix.
- Added 6 new tests in `test/server.test.js` covering: `provider: 'ollama'`
  skips the apiKey requirement (via a stubbed fetch, not the real network
  call, for speed/determinism), an explicit local `endpoint` (no preset)
  also skips it, a remote endpoint still requires it, and both directions
  of the `requiresApiKey` override.

**Not done / consciously deferred**: an ergonomic default `model` per
preset (e.g. auto-fill `llama3.2` for `provider: 'ollama'`) — deliberately
left unset since guessing a model name the user hasn't pulled would just
produce a different, more confusing error. `model` stays required either
way, same as the fully-generic form.

### 3. Bonus bug found while wiring up the release: `indexHtmlPath` default

While staging the commit for this release, discovered `index.html` had been
appearing, untracked, in this repo's own root — turned out `npm test` itself
was writing it there. Root cause: `buildApp()`'s default `indexHtmlPath` was
`path.join(process.cwd(), 'index.html')`, computed **independently** of
`staticDir` rather than derived from it. Any test (or real consumer) passing
a custom `staticDir` without also passing `indexHtmlPath` silently saved
outside the served directory — in this repo's case, straight into the repo
root every time the "apiToken protects write endpoints" test ran a save.
Fixed: `indexHtmlPath` now defaults to `path.join(staticDir, 'index.html')`.
No behavior change for the common case (default `staticDir` = cwd, so the
default `indexHtmlPath` is the same either way) — only affects
customized-`staticDir` setups that didn't also set `indexHtmlPath`, and only
in the direction of "now saves somewhere the server can actually reach,"
which is unambiguously the fix. Added a regression test
(`test/server.test.js`, "default indexHtmlPath is derived from a custom
staticDir"). Removed the stray `index.html` from this repo before committing
— check `git status` before your own commit if you're a future session
touching save-path logic, in case something regresses this again.

### Remaining steps before this is actually released

Everything above is implemented, tested (`npm test` — 40 tests passing
locally as of this writing, see below), and documented. What's **not** done
yet as of this file being written:
1. `npm test` full clean run (last known state: passing, 39/39 — re-verify
   if you're picking this up later and anything changed).
2. Sync `../smartvia/node_modules/visual-ai-editor` with the local build (or
   just re-`npm install` after publishing) and re-run the live smoke test
   (`/api/edit`, `/api/save`, `/api/design` modal rendering with real
   marked output — open it in an actual browser this time, not just
   `node:vm`, if you have the means to).
3. `git add -A && git commit` (this repo — `visual-ai-editor`, not
   `smartvia`, which isn't a git repo) with a clear message covering both
   the marked-bundling and Ollama work, `git push origin main`.
4. `npm publish` (needs the user's explicit go-ahead in this conversation
   the first time an auto-mode session hits it — it was blocked by the
   permission classifier during the 1.4.0 release and required the user to
   explicitly say "pode publicar"; expect the same gate for 1.5.0).
5. Re-verify the published version resolves on the registry
   (`npm view visual-ai-editor version` can lag a few seconds after
   publish — retry once if it still shows the old version immediately
   after).

## Not started (ideas from the original review, still open)

- **Source-mapping for framework saves via a build plugin.** The
  `/api/handoff` manifest (1.4.0) is the pragmatic stopgap — it hands a
  change list to an AI coding agent instead of writing to source directly.
  The bigger, harder win noted in the original review: a Vite/Babel plugin
  that tags each JSX element with `data-ai-source="file:line"` in dev mode
  (Onlook-style), so `/api/save` could eventually apply patches to real
  source files in React/Vue projects too, not just hand off a manifest.
  Biggest lift, biggest reward — not attempted yet.
- **Live browser E2E test.** Everything so far has been tested via
  `node:test` (unit/integration, no real DOM) plus manual `curl`/Node
  `fetch` calls against a running server. No test has driven the actual
  browser toolbar UI (click-select → type instruction → apply → save) via
  something like Playwright. Worth adding once the API surface stabilizes.
- **Demo site / GIF in README.** Noted in the original review as important
  for adoption ("a visual tool without a visual demo doesn't convert") —
  not done.

## Where things live (quick orientation for a fresh agent)

- `visual-ai-editor/` — the package itself. Own git repo, remote
  `github.com/bruno-gs-dev/visual-ai-editor`, published to npm as
  `visual-ai-editor`. This is where you make changes.
- `smartvia/` (sibling directory, `../smartvia` from here) — a real project
  that consumes `visual-ai-editor` from the public npm registry (not a
  local link). Used as the live test bed. It has its own `.env` with a real
  `GROQ_API_KEY` already configured. When testing changes here, the
  practical loop is: bump version locally → `npm publish` (or manually sync
  `node_modules/visual-ai-editor` there for a faster inner loop before
  publishing) → `cd ../smartvia && npm install` → run
  `node start-ai-editor.js` on a **non-3000 port** (the user often has their
  own instance on 3000 — check with `netstat -ano | grep :3000` before
  picking a port) → exercise the real endpoints → restore any test edits
  from the auto-backup in `.ai-editor/history/` → clean up `.ai-editor/`
  before finishing.
- `lib/design-tokens.js` / `lib/patch.js` — the two most-tested, most
  load-bearing new modules from 1.4.0. Read their doc comments before
  touching palette logic or save patching.
