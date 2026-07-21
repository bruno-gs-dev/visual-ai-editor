/**
 * visual-ai-editor — AGENTS.md installer
 *
 * Delivers docs/AGENTS.md into the consumer project's root so any AI agent
 * (Claude Code, Cursor, etc.) reading that file learns how this tool works.
 *
 * Behavior:
 *   - No AGENTS.md in the project yet → copy ours in as-is.
 *   - AGENTS.md already exists, but doesn't contain our block yet → append our
 *     delimited block (<!-- visual-ai-editor:start/end -->) to the end.
 *   - AGENTS.md already contains our block → replace just that block in place
 *     (so version upgrades refresh the content without touching anything the
 *     user wrote around it).
 *
 * Used by:
 *   - scripts/postinstall.js (silent, best-effort, on `npm install`)
 *   - bin/cli.js `agents:init` (explicit, for --ignore-scripts / manual runs)
 */

var fs = require('fs');
var path = require('path');
var envInit = require('./env-init');

var START_MARKER = '<!-- visual-ai-editor:start -->';
var END_MARKER = '<!-- visual-ai-editor:end -->';

function ourBlock(){
  var templatePath = path.join(__dirname, '..', 'docs', 'AGENTS.md');
  return fs.readFileSync(templatePath, 'utf8').trim();
}

function installAgentsMd(projectRoot){
  var dir = path.join(projectRoot, '.ai-editor');
  fs.mkdirSync(dir, { recursive: true });
  envInit.ensureGitignore(projectRoot, ['.ai-editor/']);
  var outPath = path.join(dir, 'AGENTS.md');
  var block = ourBlock();

  if (!fs.existsSync(outPath)){
    fs.writeFileSync(outPath, block + '\n', 'utf8');
    return { path: outPath, action: 'created' };
  }

  var existing = fs.readFileSync(outPath, 'utf8');
  var startIdx = existing.indexOf(START_MARKER);
  var endIdx = existing.indexOf(END_MARKER);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx){
    var before = existing.slice(0, startIdx);
    var after = existing.slice(endIdx + END_MARKER.length);
    var updated = before + block + after;
    if (updated === existing){
      return { path: outPath, action: 'unchanged' };
    }
    fs.writeFileSync(outPath, updated, 'utf8');
    return { path: outPath, action: 'updated' };
  }

  // AGENTS.md exists but has no visual-ai-editor block yet — append it.
  var separator = existing.endsWith('\n') ? '\n' : '\n\n';
  fs.writeFileSync(outPath, existing + separator + block + '\n', 'utf8');
  return { path: outPath, action: 'appended' };
}

module.exports = { installAgentsMd: installAgentsMd, START_MARKER: START_MARKER, END_MARKER: END_MARKER };
