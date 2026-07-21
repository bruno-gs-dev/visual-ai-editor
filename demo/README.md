# visual-ai-editor — demo

A self-contained landing page for a fictional product (Nimbus Analytics) plus the
`DESIGN.md` that describes it. No build step, no external requests, no images.

```bash
cd demo
npx visual-ai-editor start
```

First run opens the editor — configure your AI provider in **Settings**.

Working from a clone of this repo instead of the published package:

```bash
cd demo
node ../bin/cli.js start
```

## What to try

| Try | Expected |
|-----|----------|
| Click a feature card → `add a warning badge saying Beta` | Reuses the `.badge.highlight` class documented in `DESIGN.md` |
| Any element → `change the background to pink` | Blocked as off-palette, with an **Apply anyway** button that costs no extra tokens |
| Drag **Area selection** over the four metric tiles → `make these use the secondary button style` | All four rewritten in one request |
| `Ctrl+Z` | Instant undo, no API call |
| **Save** | Patches `index.html` in place; the original is copied to `.ai-editor/history/` first |

## Why the palette guard fires

Every color in `index.html` comes from the table in section 3 of `DESIGN.md`, so the two
files agree exactly:

```bash
npx visual-ai-editor design:lint    # → no off-palette colors
npx visual-ai-editor design:check   # → all 11 sections present
```

Because the palette is complete and closed, any color the model invents is provably new,
and the server rejects it without having to ask a second model whether it looks right.

## Resetting

Edits you save are written straight into `index.html`. To get back to the original:

```bash
git checkout demo/index.html
```

Backups of every save live in `demo/.ai-editor/history/` (gitignored).
