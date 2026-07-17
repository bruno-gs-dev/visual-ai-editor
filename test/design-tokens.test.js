var test = require('node:test');
var assert = require('node:assert/strict');
var tokens = require('../lib/design-tokens.js');

test('normalizeColor: expands short hex', function(){
  assert.equal(tokens.normalizeColor('#abc'), '#aabbcc');
  assert.equal(tokens.normalizeColor('#ABCD'), '#aabbccdd');
});

test('normalizeColor: rgb/rgba to hex, drops opaque alpha', function(){
  assert.equal(tokens.normalizeColor('rgb(255, 0, 0)'), '#ff0000');
  assert.equal(tokens.normalizeColor('rgba(255, 0, 0, 1)'), '#ff0000');
  assert.equal(tokens.normalizeColor('rgba(0, 0, 0, 0.5)'), '#000000' + '80');
});

test('normalizeColor: rejects garbage', function(){
  assert.equal(tokens.normalizeColor('not-a-color'), null);
  assert.equal(tokens.normalizeColor('#12'), null);
});

test('extractColors: finds hex and rgb tokens in mixed text', function(){
  var text = 'color:#4f46e5; background: rgb(255,255,255); border:1px solid #FFF';
  var found = tokens.extractColors(text);
  assert.ok(found.has('#4f46e5'));
  assert.ok(found.has('#ffffff'));
});

test('extractPalette: reads colors from DESIGN.md frontmatter + prose', function(){
  var md = '---\ncolors:\n  primary: "#4f46e5"\n---\n\nUse #4f46e5 for primary actions.';
  var palette = tokens.extractPalette(md);
  assert.ok(palette.has('#4f46e5'));
});

test('findViolations: flags colors not in palette and not in the original input', function(){
  var palette = new Set(['#4f46e5', '#ffffff']);
  var input = '<div style="color:#4f46e5">hi</div>';
  var output = '<div style="color:#ff0000">hi</div>';
  var violations = tokens.findViolations(output, input, palette);
  assert.deepEqual(violations, ['#ff0000']);
});

test('findViolations: does not flag colors already present in the input (pre-existing)', function(){
  var palette = new Set(['#4f46e5']);
  var input = '<div style="color:#ff0000">hi</div>';
  var output = '<div style="color:#ff0000; font-weight:bold">hi</div>';
  var violations = tokens.findViolations(output, input, palette);
  assert.deepEqual(violations, []);
});

test('findViolations: empty palette means no enforcement', function(){
  var violations = tokens.findViolations('<div style="color:#ff0000">x</div>', '', new Set());
  assert.deepEqual(violations, []);
});

test('lintContent: reports line numbers for off-palette colors', function(){
  var palette = new Set(['#4f46e5']);
  var content = 'a{color:#4f46e5}\nb{color:#ff0000}\nc{border:1px solid #ff0000}';
  var results = tokens.lintContent(content, palette);
  assert.equal(results.length, 2);
  assert.equal(results[0].line, 2);
  assert.equal(results[0].color, '#ff0000');
  assert.equal(results[1].line, 3);
});
