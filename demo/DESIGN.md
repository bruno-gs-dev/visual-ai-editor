# DESIGN.md — Nimbus Analytics

Design system for the `visual-ai-editor` demo page. The editor injects this file
into the LLM's system prompt on every edit, and the server checks every response
against the color palette below.

---

## 1. Overview

Nimbus Analytics is a dark-first analytics product page. The visual language is
calm and dense: a near-black canvas, one indigo accent that carries every primary
action, and cyan reserved for data highlights. Nothing else competes for attention.

Audience: engineering and data teams evaluating the product in under a minute.

---

## 2. Design Principles

1. **One accent, used sparingly.** Indigo (`#6366f1`) marks the primary action on a
   screen. If two things are indigo, one of them is wrong.
2. **Contrast comes from surface, not from borders.** Stack `#0b0f19` → `#131a2a` →
   `#1c2438` to build depth. Borders are a hairline, never a frame.
3. **Text has exactly two weights of meaning.** `#e6ebf5` for content, `#98a3b8` for
   support. There is no third gray.
4. **Motion is a confirmation, not decoration.** 150ms, ease-out, on hover and focus only.

---

## 3. Color Palette

Every color used anywhere in the product must appear in this list.

### Surfaces

| Token | Hex | Use |
|-------|-----|-----|
| `--bg` | `#0b0f19` | Page canvas |
| `--surface` | `#131a2a` | Cards, panels, footer |
| `--surface-2` | `#1c2438` | Nested surfaces, badges, code blocks |
| `--border` | `#263149` | Hairline dividers and card borders |

### Text

| Token | Hex | Use |
|-------|-----|-----|
| `--text` | `#e6ebf5` | Headings and body copy |
| `--muted` | `#98a3b8` | Secondary copy, labels, captions |
| `--on-primary` | `#ffffff` | Text on indigo fills |

### Accents

| Token | Hex | Use |
|-------|-----|-----|
| `--primary` | `#6366f1` | Primary buttons, active states, focus rings |
| `--primary-hover` | `#818cf8` | Hover state of primary elements only |
| `--accent` | `#22d3ee` | Data highlights, metric values, links |
| `--success` | `#34d399` | Positive deltas, "included" checkmarks |
| `--warning` | `#fbbf24` | Attention badges, soft alerts |
| `--danger` | `#f87171` | Negative deltas, destructive actions |

### Translucent tokens

Used for glows and overlays. These are the only allowed alpha values:
`#6366f133`, `#22d3ee1f`, `#0b0f1980`, `#00000066`.

**Anything outside this list is off-palette** — no pink, no orange, no pure-black
text, no hard-coded grays.

---

## 4. Typography

System stack, no web fonts: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`.
Monospace: `ui-monospace, "SF Mono", "Cascadia Code", Consolas, monospace`.

| Role | Size | Weight | Line height | Letter spacing |
|------|------|--------|-------------|----------------|
| Display (h1) | 52px | 700 | 1.1 | -0.02em |
| Section title (h2) | 30px | 650 | 1.2 | -0.01em |
| Card title (h3) | 18px | 600 | 1.3 | normal |
| Body | 16px | 400 | 1.6 | normal |
| Small / caption | 14px | 400 | 1.5 | normal |
| Eyebrow / label | 12px | 600 | 1.4 | 0.08em, uppercase |
| Metric value | 34px | 700 | 1.1 | -0.01em |

Rules: one `h1` per page. Never skip a level. Body copy is capped at ~65 characters
per line.

---

## 5. Spacing

4px base scale: `4, 8, 12, 16, 24, 32, 48, 64, 96`. No value outside the scale.

- Inside a card: `24px` padding, `12px` between stacked elements.
- Between cards in a grid: `24px`.
- Between page sections: `96px` (desktop), `64px` (mobile).
- Page gutter: `24px`, content capped at `1120px`.

---

## 6. Borders, Radii and Shadows

| Token | Value |
|-------|-------|
| Radius — small (badge, input) | `8px` |
| Radius — medium (button, card) | `12px` |
| Radius — large (panel, banner) | `16px` |
| Radius — pill | `999px` |
| Border width | `1px`, always `#263149` |
| Shadow — card | `0 1px 2px #00000066` |
| Shadow — raised | `0 12px 32px #0b0f1980` |
| Glow — primary | `0 0 0 3px #6366f133` (focus ring) |

Nothing is fully square and nothing is fully round except pills and avatars.

---

## 7. Layout and Grid

- Max content width: `1120px`, centered.
- Desktop grid: 3 columns, `24px` gap.
- Breakpoints: `< 900px` → 2 columns; `< 640px` → 1 column, sections drop to `64px`.
- The hero is single-column and centered at every width.

---

## 8. Components

**Button — primary:** `#6366f1` fill, `#ffffff` text, `12px` radius, `12px 20px` padding,
600 weight. Hover: `#818cf8`. Focus: `0 0 0 3px #6366f133`.

**Button — secondary:** transparent fill, `1px` `#263149` border, `#e6ebf5` text.
Hover: background `#1c2438`.

**Card:** `#131a2a` background, `1px` `#263149` border, `12px` radius, `24px` padding.
Hover on interactive cards: border becomes `#6366f1`.

**Metric tile:** eyebrow label in `#98a3b8`, value in `#22d3ee` at 34px, delta line in
`#34d399` (positive) or `#f87171` (negative).

**Badge:** pill, `#1c2438` background, `12px` uppercase label. Highlight variant uses
`#fbbf24` text.

**Pricing card:** standard card. The recommended plan gets a `#6366f1` border plus the
`0 12px 32px #0b0f1980` raised shadow — one per pricing row, never two.

---

## 9. Accessibility

- Body and heading text hold at least 4.5:1 against their surface; `#98a3b8` on
  `#131a2a` is only used at 14px+ and never for essential-only information.
- Every interactive element has a visible focus ring (`0 0 0 3px #6366f133`) — never
  `outline: none` without a replacement.
- Hit targets are at least 44×44px.
- Color never carries meaning alone: deltas pair their color with `▲` / `▼`.
- Section landmarks use real elements (`header`, `main`, `section`, `footer`).

---

## 10. Rules for AI

When editing this page:

1. **Only use hexes listed in section 3.** If the instruction requires a color that
   isn't there, return a `warn` instead of inventing one.
2. **Reuse existing classes** (`.card`, `.btn`, `.btn-secondary`, `.metric`, `.badge`)
   rather than adding new ones or inline styles.
3. **Keep the root tag and structure** of the fragment you receive — change content and
   classes, not the element's identity.
4. **Snap every size to the 4px scale** in section 5 and the radii in section 6.
5. **Don't introduce web fonts, images, or external requests** — the page is offline-safe.
6. **Don't add a second primary button** to a section that already has one.

---

## 11. Example Prompts

Prompts that should succeed:

- "make this card the recommended plan"
- "turn this metric delta negative"
- "shorten this paragraph to one sentence"
- "add a warning badge to this card"
- "make these three cards use the secondary button style"

Prompts that should trigger a design-system warning:

- "change the background to pink" → off-palette
- "make the corners fully square" → breaks the radius scale
- "use Comic Sans for the heading" → outside the type stack
