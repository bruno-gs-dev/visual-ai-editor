var test = require('node:test');
var assert = require('node:assert/strict');
var patchLib = require('../dist-node/lib/patch.js');

test('applyPatch: exact match replaces the substring', function(){
  var source = '<div><h1>Old title</h1></div>';
  var result = patchLib.applyPatch(source, '<h1>Old title</h1>', '<h1>New title</h1>');
  assert.equal(result.ok, true);
  assert.equal(result.mode, 'exact');
  assert.equal(result.source, '<div><h1>New title</h1></div>');
});

test('applyPatch: whitespace-tolerant fallback matches source reformatted by a linter/formatter', function(){
  // A formatter may wrap long attribute lists onto their own lines; the DOM's
  // serialized outerHTML (what the client sends as `before`) always collapses
  // that back to single spaces. Text content itself is preserved verbatim by
  // browsers, so only the tag-internal whitespace should need to be fuzzy.
  var source = '<div>\n  <h1\n    class="a b"\n  >Old title</h1>\n</div>';
  var before = '<h1 class="a b">Old title</h1>'; // serialized outerHTML
  var result = patchLib.applyPatch(source, before, '<h1 class="a b">New title</h1>');
  assert.equal(result.ok, true);
  assert.equal(result.mode, 'fuzzy');
  assert.ok(result.source.indexOf('New title') !== -1);
  assert.ok(result.source.indexOf('Old title') === -1);
});

test('applyPatch: ambiguous match (appears twice) fails', function(){
  var source = '<p>same</p><p>same</p>';
  var result = patchLib.applyPatch(source, '<p>same</p>', '<p>changed</p>');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'ambiguous');
});

test('applyPatch: not found fails', function(){
  var source = '<div>hello</div>';
  var result = patchLib.applyPatch(source, '<span>nope</span>', '<span>x</span>');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'not-found');
});

test('applyPatches: applies multiple patches sequentially, reports failures', function(){
  var source = '<div><h1>A</h1><h2>B</h2></div>';
  var result = patchLib.applyPatches(source, [
    { before: '<h1>A</h1>', after: '<h1>A2</h1>' },
    { before: '<h2>B</h2>', after: '<h2>B2</h2>' },
    { before: '<h3>missing</h3>', after: '<h3>x</h3>' }
  ]);
  assert.equal(result.applied, 2);
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].index, 2);
  assert.equal(result.source, '<div><h1>A2</h1><h2>B2</h2></div>');
});
