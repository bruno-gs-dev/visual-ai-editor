/**
 * visual-ai-editor — surgical source patching
 *
 * Instead of serializing the whole live DOM and overwriting the source file
 * (which destroys formatting, comments and produces giant git diffs), the
 * client records each AI edit as { before, after } and the server applies
 * those as targeted replacements in the original file.
 *
 * Matching strategy per patch, in order:
 *   1. Exact substring match (must be unique in the file).
 *   2. Whitespace-tolerant match: the `before` HTML with every whitespace run
 *      treated as \s+ (the DOM normalizes attribute/text whitespace, so the
 *      serialized outerHTML rarely matches the source byte-for-byte).
 *
 * A patch that matches zero or more than one location is reported as failed —
 * the caller decides whether to fall back to a full-file write.
 */

function escapeRegExp(s){
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a whitespace-tolerant regex source string from literal HTML.
 *
 * The `before` string always comes from a live DOM's outerHTML — attribute
 * whitespace normalized to single spaces, no line breaks inside tags. The
 * actual source file may be formatted differently (prettier-style attribute
 * wrapping, extra indentation), so two kinds of tolerance are needed:
 *   1. Every whitespace run already in `before` becomes \s+ (matches runs of
 *      any length/kind in the source).
 *   2. Every tag-structural boundary (< > =) additionally gets \s* on both
 *      sides, since formatters insert *new* whitespace right at those points
 *      (e.g. a line break before the closing ">") that isn't present at all
 *      in the serialized `before` string.
 * Text content itself is left untouched beyond (1) — browsers preserve it
 * verbatim, so no extra tolerance is applied there.
 */
function fuzzyPattern(html){
  return escapeRegExp(html)
    .replace(/\s+/g, '\\s+')
    .replace(/([<>=])/g, '\\s*$1\\s*');
}

function countMatches(re, text){
  var count = 0, m, last = -1;
  re.lastIndex = 0;
  while ((m = re.exec(text))){
    if (m.index === last) break; // safety against zero-width loops
    last = m.index;
    count++;
    if (count > 1) break;
  }
  return count;
}

/**
 * Apply one patch to `source`. Returns { ok, source, mode } where mode is
 * 'exact' | 'fuzzy', or { ok: false, reason: 'not-found' | 'ambiguous' }.
 */
function applyPatch(source, before, after){
  if (!before) return { ok: false, reason: 'not-found' };

  // 1. Exact match
  var first = source.indexOf(before);
  if (first !== -1){
    var second = source.indexOf(before, first + 1);
    if (second !== -1) return { ok: false, reason: 'ambiguous' };
    return {
      ok: true,
      mode: 'exact',
      source: source.slice(0, first) + after + source.slice(first + before.length)
    };
  }

  // 2. Whitespace-tolerant match
  var pattern;
  try {
    pattern = new RegExp(fuzzyPattern(before), 'g');
  } catch (e) {
    return { ok: false, reason: 'not-found' };
  }
  var count = countMatches(pattern, source);
  if (count === 0) return { ok: false, reason: 'not-found' };
  if (count > 1) return { ok: false, reason: 'ambiguous' };

  pattern.lastIndex = 0;
  var match = pattern.exec(source);
  return {
    ok: true,
    mode: 'fuzzy',
    source: source.slice(0, match.index) + after + source.slice(match.index + match[0].length)
  };
}

/**
 * Apply a list of patches sequentially.
 * Returns { source, applied, failed: [{ index, reason }] }.
 */
function applyPatches(source, patches){
  var applied = 0;
  var failed = [];
  var current = source;

  (patches || []).forEach(function(patch, i){
    var before = patch && patch.before;
    var after = (patch && patch.after) || '';
    var result = applyPatch(current, before, after);
    if (result.ok){
      current = result.source;
      applied++;
    } else {
      failed.push({ index: i, reason: result.reason });
    }
  });

  return { source: current, applied: applied, failed: failed };
}

module.exports = {
  applyPatch: applyPatch,
  applyPatches: applyPatches,
  fuzzyPattern: fuzzyPattern
};
