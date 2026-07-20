#!/usr/bin/env node
/**
 * Records the README demo GIFs by driving the real editor against demo/.
 *
 * Nothing here is faked: it boots the actual server, loads the actual demo page
 * with the client auto-injected, and performs real selections, real typing and
 * real /api/edit round-trips. The only synthetic element is the cursor arrow,
 * which is drawn as an overlay because the OS pointer isn't captured in a
 * browser recording.
 *
 * Requirements (dev-only — none of this reaches anyone who installs the package):
 *   playwright is a devDependency, but the browser binary is a separate download:
 *     npx playwright install chromium
 *   ffmpeg on PATH
 *   An API key in demo/.env or ./.env — a fast, capable model. Groq's free tier
 *   is what these GIFs were recorded with; a small local model is too slow and
 *   too unreliable to produce a representative recording (see README, "A note
 *   on model capability").
 *
 * Usage:
 *   node scripts/record-demo.js            # both scenes
 *   node scripts/record-demo.js edit       # just the successful-edit scene
 *   node scripts/record-demo.js warning    # just the palette-guard scene
 *
 * Output: docs/gifs/*.gif (excluded from the npm tarball; the README links to
 * them by absolute raw.githubusercontent.com URL so npm renders them too).
 *
 * The recording never clicks Save, so demo/index.html is left untouched.
 */

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DEMO = path.join(ROOT, 'demo');
const OUT = path.join(ROOT, 'docs', 'gifs');
const TMP = path.join(ROOT, '.ai-editor', 'recording');

const VIEWPORT = { width: 1180, height: 700 };
const PORT = 3210;

// A localhost endpoint needs no key — same rule the server itself applies.
// Useful for rehearsing the choreography without spending tokens; not for the
// committed GIFs, which need a model fast and capable enough to look real.
function localEndpoint() {
  const ep = process.env.AI_ENDPOINT || '';
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(ep) ? ep : null;
}

function loadKey() {
  for (const envPath of [path.join(DEMO, '.env'), path.join(ROOT, '.env')]) {
    if (!fs.existsSync(envPath)) continue;
    const m = fs.readFileSync(envPath, 'utf8').match(/^\s*(?:AI_API_KEY|GROQ_API_KEY)\s*=\s*(.+)\s*$/m);
    const key = m && m[1].trim().replace(/^["']|["']$/g, '');
    if (key && !/^your_|^gsk_your|^sk-your/.test(key)) return { key, envPath };
  }
  return null;
}

// The cursor the viewer sees. Moves with an eased transition; the real
// Playwright pointer is moved in lockstep so hover and click states are genuine.
const CURSOR_SETUP = `
  const c = document.createElement('div');
  c.id = '__rec_cursor';
  c.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none">' +
    '<path d="M5 2l14 9-6.2 1.2L10 19 5 2z" fill="#ffffff" stroke="#0b0f19" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  Object.assign(c.style, {
    position: 'fixed', left: '0', top: '0', zIndex: '2147483647',
    pointerEvents: 'none', transform: 'translate(-100px,-100px)',
    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.5))'
  });
  document.body.appendChild(c);

  const ring = document.createElement('div');
  ring.id = '__rec_ring';
  Object.assign(ring.style, {
    position: 'fixed', left: '0', top: '0', width: '34px', height: '34px',
    marginLeft: '-17px', marginTop: '-17px', borderRadius: '999px',
    border: '2px solid #6366f1', opacity: '0', zIndex: '2147483646',
    pointerEvents: 'none', transform: 'translate(-100px,-100px) scale(.4)'
  });
  document.body.appendChild(ring);

  window.__recMove = (x, y, ms) => {
    c.style.transition = ms ? 'transform ' + ms + 'ms cubic-bezier(.4,0,.2,1)' : 'none';
    c.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  };
  window.__recClick = (x, y) => {
    ring.style.transition = 'none';
    ring.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(.4)';
    ring.style.opacity = '.9';
    requestAnimationFrame(() => {
      ring.style.transition = 'transform 420ms ease-out, opacity 420ms ease-out';
      ring.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(1.5)';
      ring.style.opacity = '0';
    });
  };
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function moveTo(page, x, y, ms = 700) {
  await page.evaluate(([x, y, ms]) => window.__recMove(x, y, ms), [x, y, ms]);
  await page.mouse.move(x, y, { steps: Math.max(8, Math.round(ms / 25)) });
  await sleep(ms * 0.35);
}

async function clickAt(page, x, y) {
  await page.evaluate(([x, y]) => window.__recClick(x, y), [x, y]);
  await page.mouse.click(x, y);
  await sleep(320);
}

async function centerOf(page, selector, nth = 0) {
  const box = await page.locator(selector).nth(nth).boundingBox();
  if (!box) throw new Error('element not visible: ' + selector);
  return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
}

async function scene(browser, name, steps) {
  const dir = path.join(TMP, name);
  fs.mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir, size: VIEWPORT },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();
  await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'networkidle' });
  await page.waitForSelector('#ai-toolbar', { timeout: 15000 });
  await page.addStyleTag({ content: '*{scroll-behavior:auto !important}' });
  await page.evaluate(CURSOR_SETUP);
  await sleep(600);

  await steps(page);

  await sleep(1200);

  // saveAs() resolves only once the video is fully flushed. Reading the directory
  // straight after close() can hand ffmpeg a half-written file, and ffmpeg has no
  // way to tell that apart from a short clip — it silently emits a GIF truncated
  // to whatever had landed on disk.
  const video = page.video();
  await context.close();
  const webm = path.join(dir, name + '.webm');
  await video.saveAs(webm);
  return webm;
}

function toGif(webm, outFile, fps = 13, width = 900) {
  fs.mkdirSync(OUT, { recursive: true });
  const palette = webm.replace(/\.webm$/, '-palette.png');
  const filters = `fps=${fps},scale=${width}:-1:flags=lanczos`;
  execFileSync('ffmpeg', ['-y', '-i', webm, '-vf', `${filters},palettegen=stats_mode=diff`, palette], { stdio: 'ignore' });
  execFileSync('ffmpeg', ['-y', '-i', webm, '-i', palette, '-lavfi',
    `${filters}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`, outFile], { stdio: 'ignore' });
  return fs.statSync(outFile).size;
}

async function main() {
  const which = process.argv[2] || 'all';
  const local = localEndpoint();
  const found = local ? { key: '', envPath: 'AI_ENDPOINT=' + local } : loadKey();
  if (!found) {
    console.error('\n[record-demo] No usable API key found.\n');
    console.error('Put one in demo/.env (gitignored) and run again:');
    console.error('    AI_API_KEY=gsk_...\n');
    console.error('The recording performs real AI edits, so it needs a real provider.');
    console.error('Groq\'s free tier is what the committed GIFs were recorded with:');
    console.error('    https://console.groq.com\n');
    process.exit(1);
  }
  console.log('[record-demo] provider:', local ? found.envPath : 'key from ' + path.relative(ROOT, found.envPath));

  const { chromium } = require('playwright');
  const { startServer } = require(path.join(ROOT, 'server', 'index.js'));

  const { server } = startServer({
    port: PORT,
    staticDir: DEMO,
    designMdPath: path.join(DEMO, 'DESIGN.md'),
    indexHtmlPath: path.join(DEMO, 'index.html'),
    inject: true,
    ai: { apiKey: found.key }
  });

  const browser = await chromium.launch();

  if (which === 'all' || which === 'edit') {
    console.log('[record-demo] scene 1/2 — successful edit');
    const webm = await scene(browser, 'edit', async (page) => {
      await page.evaluate(() => document.querySelector('#features').scrollIntoView({ block: 'start' }));
      await sleep(900);

      // The editor boots inactive — picking a tool is what arms it.
      const tool = await centerOf(page, '#ai-toolbar [data-tool="cursor"]');
      await moveTo(page, tool.x, tool.y, 800);
      await clickAt(page, tool.x, tool.y);
      await sleep(500);

      const card = await centerOf(page, '#features .card', 1);
      await moveTo(page, card.x, card.y, 900);
      await sleep(400);
      await clickAt(page, card.x, card.y);
      await page.waitForSelector('#ai-editor-panel', { state: 'visible' });
      await sleep(600);

      const box = await centerOf(page, '#ai-editor-instruction');
      await moveTo(page, box.x, box.y, 600);
      await clickAt(page, box.x, box.y);
      await page.type('#ai-editor-instruction', 'add a warning badge saying Beta', { delay: 55 });
      await sleep(500);

      const apply = await centerOf(page, '#ai-editor-apply');
      await moveTo(page, apply.x, apply.y, 500);
      await clickAt(page, apply.x, apply.y);

      await page.waitForFunction(
        () => /✓|Changed|Alterado/.test(document.querySelector('#ai-editor-status').textContent),
        { timeout: 60000 }
      );
      await moveTo(page, card.x, card.y - 40, 700);
      await sleep(1600);
    });
    const size = toGif(webm, path.join(OUT, 'basic-edit.gif'));
    console.log('[record-demo] docs/gifs/basic-edit.gif —', (size / 1024 / 1024).toFixed(2), 'MB');
  }

  if (which === 'all' || which === 'warning') {
    console.log('[record-demo] scene 2/2 — palette guard');
    const webm = await scene(browser, 'warning', async (page) => {
      await page.evaluate(() => document.querySelector('#features').scrollIntoView({ block: 'start' }));
      await sleep(900);

      // The editor boots inactive — picking a tool is what arms it.
      const tool = await centerOf(page, '#ai-toolbar [data-tool="cursor"]');
      await moveTo(page, tool.x, tool.y, 800);
      await clickAt(page, tool.x, tool.y);
      await sleep(500);

      const card = await centerOf(page, '#features .card', 0);
      await moveTo(page, card.x, card.y, 900);
      await clickAt(page, card.x, card.y);
      await page.waitForSelector('#ai-editor-panel', { state: 'visible' });
      await sleep(500);

      const box = await centerOf(page, '#ai-editor-instruction');
      await moveTo(page, box.x, box.y, 600);
      await clickAt(page, box.x, box.y);
      await page.type('#ai-editor-instruction', 'change the background to pink', { delay: 55 });
      await sleep(500);

      const apply = await centerOf(page, '#ai-editor-apply');
      await moveTo(page, apply.x, apply.y, 500);
      await clickAt(page, apply.x, apply.y);

      await page.waitForSelector('#ai-editor-force', { timeout: 60000 });
      await sleep(1400);

      const force = await centerOf(page, '#ai-editor-force');
      await moveTo(page, force.x, force.y, 700);
      await clickAt(page, force.x, force.y);
      await sleep(2000);
    });
    const size = toGif(webm, path.join(OUT, 'design-warning.gif'));
    console.log('[record-demo] docs/gifs/design-warning.gif —', (size / 1024 / 1024).toFixed(2), 'MB');
  }

  await browser.close();
  server.close();
  if (!process.env.KEEP_RECORDING) fs.rmSync(TMP, { recursive: true, force: true });
  console.log('[record-demo] done — demo/index.html untouched (Save is never clicked)');
}

main().catch((e) => { console.error(e); process.exit(1); });
