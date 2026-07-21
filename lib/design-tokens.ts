/**
 * visual-ai-editor — deterministic design-token validation
 *
 * The LLM-side DESIGN.md enforcement is probabilistic (the model may or may
 * not notice an off-palette color). This module makes the color part of that
 * enforcement deterministic:
 *
 *   - extractColors(text)   → Set of normalized colors found in any text
 *   - extractPalette(md)    → Set of allowed colors (every color mentioned
 *                             anywhere in DESIGN.md counts as allowed)
 *   - findViolations(outputHtml, inputHtml, palette)
 *                           → colors introduced by the AI that are neither in
 *                             the palette nor already present in the input
 *
 * Used by:
 *   - server/index.js (post-check on /api/edit responses)
 *   - bin/cli.js (`design:lint`)
 */

var HEX_RE = /#([0-9a-fA-F]{3,8})\b/g;
var RGB_RE = /rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*(?:[,/]\s*([\d.]+%?)\s*)?\)/g;
var HSL_RE = /hsla?\(\s*[\d.]+(?:deg)?\s*[, ]\s*[\d.]+%\s*[, ]\s*[\d.]+%\s*(?:[,/]\s*[\d.]+%?\s*)?\)/g;

function toHexPair(n){
  var h = Math.max(0, Math.min(255, n)).toString(16);
  return h.length === 1 ? '0' + h : h;
}

/**
 * Normalize a single color token to a canonical form:
 *   #abc → #aabbcc, #abcd → #aabbccdd, hex lowercased,
 *   rgb(255, 0, 0) → #ff0000, rgba(...) with alpha 1 → 6-digit hex,
 *   hsl(...) → lowercased/whitespace-collapsed string (kept as-is).
 * Returns null for tokens it can't understand.
 */
function normalizeColor(raw){
  if (!raw) return null;
  var s = String(raw).trim().toLowerCase();

  var hex = s.match(/^#([0-9a-f]{3,8})$/);
  if (hex){
    var d = hex[1];
    if (d.length === 3 || d.length === 4){
      var expanded = '';
      for (var i = 0; i < d.length; i++) expanded += d[i] + d[i];
      d = expanded;
    }
    if (d.length !== 6 && d.length !== 8) return null;
    // Drop a fully-opaque alpha channel so #ffffffff === #ffffff
    if (d.length === 8 && d.slice(6) === 'ff') d = d.slice(0, 6);
    return '#' + d;
  }

  var rgb = s.match(/^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/);
  if (rgb){
    var out = '#' + toHexPair(+rgb[1]) + toHexPair(+rgb[2]) + toHexPair(+rgb[3]);
    if (rgb[4] !== undefined){
      var a = rgb[4].indexOf('%') !== -1 ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4]);
      if (!(a >= 1)) out += toHexPair(Math.round(a * 255));
    }
    return out;
  }

  if (/^hsla?\(/.test(s)){
    return s.replace(/\s+/g, ' ');
  }

  return null;
}

/**
 * Extract every color token (hex, rgb/rgba, hsl/hsla) from a text blob.
 * Returns a Set of normalized colors.
 */
function extractColors(text){
  var found = new Set();
  if (!text) return found;
  var m;

  HEX_RE.lastIndex = 0;
  while ((m = HEX_RE.exec(text))){
    var n = normalizeColor('#' + m[1]);
    if (n) found.add(n);
  }

  RGB_RE.lastIndex = 0;
  while ((m = RGB_RE.exec(text))){
    var n2 = normalizeColor(m[0]);
    if (n2) found.add(n2);
  }

  HSL_RE.lastIndex = 0;
  while ((m = HSL_RE.exec(text))){
    var n3 = normalizeColor(m[0]);
    if (n3) found.add(n3);
  }

  return found;
}

/**
 * The allowed palette is every color mentioned anywhere in DESIGN.md —
 * frontmatter tokens, prose, code fences. This is intentionally permissive:
 * if the design doc mentions it, it's fair game.
 */
function extractPalette(designMd){
  return extractColors(designMd);
}

/**
 * Which colors did the AI introduce that are neither in the palette nor
 * already present in the HTML it was given?
 * Returns an array of normalized color strings (empty = clean).
 */
function findViolations(outputHtml, inputHtml, palette){
  if (!palette || palette.size === 0) return [];
  var input = extractColors(inputHtml);
  var output = extractColors(outputHtml);
  var violations = [];
  output.forEach(function(color){
    if (!palette.has(color) && !input.has(color)) violations.push(color);
  });
  return violations;
}

/**
 * Lint arbitrary file content against a palette.
 * Returns [{ line, color }] for every off-palette color occurrence.
 */
function lintContent(content, palette){
  if (!palette || palette.size === 0) return [];
  var results = [];
  var lines = String(content).split(/\r?\n/);
  for (var i = 0; i < lines.length; i++){
    var colors = extractColors(lines[i]);
    colors.forEach(function(color){
      if (!palette.has(color)) results.push({ line: i + 1, color: color });
    });
  }
  return results;
}

module.exports = {
  normalizeColor: normalizeColor,
  extractColors: extractColors,
  extractPalette: extractPalette,
  findViolations: findViolations,
  lintContent: lintContent
};
