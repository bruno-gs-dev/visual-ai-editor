/**
 * visual-ai-editor — CLI UI utilities
 *
 * Shared module for branded terminal output: banner, spinner, success/error
 * messages, and color helpers. Used by the config command and potentially
 * other CLI commands in the future.
 *
 * Dependencies: chalk@4 (CJS, Node 10 compatible)
 */

var path = require('path');
var chalk = require('chalk');
var pkg = require(path.join(__dirname, '..', '..', 'package.json'));

var BANNER = [
  '',
  chalk.cyan('  ╔═══════════════════════════════════════════════════════╗'),
  chalk.cyan('  ║') + '                                                       ' + chalk.cyan('║'),
  chalk.cyan('  ║') + '   ' + chalk.bold.white('██╗   ██╗███████╗██╗    ██╗ █████╗') + '                 ' + chalk.cyan('║'),
  chalk.cyan('  ║') + '   ' + chalk.bold.white('██║   ██║██╔════╝██║    ██║██╔══██╗') + '                ' + chalk.cyan('║'),
  chalk.cyan('  ║') + '   ' + chalk.bold.white('██║   ██║█████╗  ██║ █╗ ██║███████║') + '                ' + chalk.cyan('║'),
  chalk.cyan('  ║') + '   ' + chalk.bold.white('╚██╗ ██╔╝██╔══╝  ██║███╗██║██╔══██║') + '                ' + chalk.cyan('║'),
  chalk.cyan('  ║') + '   ' + chalk.bold.white(' ╚████╔╝ ███████╗╚███╔███╔╝██║  ██║') + '                ' + chalk.cyan('║'),
  chalk.cyan('  ║') + '   ' + chalk.bold.white('  ╚═══╝  ╚══════╝ ╚══╝╚══╝ ╚═╝  ╚═╝') + '                ' + chalk.cyan('║'),
  chalk.cyan('  ║') + '                                                       ' + chalk.cyan('║'),
  chalk.cyan('  ║') + '          ' + chalk.gray('AI-Powered Visual HTML Editor') + '                ' + chalk.cyan('║'),
  chalk.cyan('  ║') + '          ' + chalk.gray('v' + pkg.version) + '                                   ' + chalk.cyan('║'),
  chalk.cyan('  ║') + '                                                       ' + chalk.cyan('║'),
  chalk.cyan('  ╚═══════════════════════════════════════════════════════╝'),
  ''
];

function banner() {
  BANNER.forEach(function (line) { console.log(line); });
}

function divider() {
  console.log(chalk.gray('  ─────────────────────────────────────────────────────'));
}

function gap() {
  console.log('');
}

function success(text) {
  console.log(chalk.green('  ✔ ') + text);
}

function error(text) {
  console.log(chalk.red('  ✗ ') + text);
}

function info(text) {
  console.log(chalk.blue('  ℹ ') + text);
}

function warning(text) {
  console.log(chalk.yellow('  ⚠ ') + text);
}

function dim(text) {
  return chalk.gray(text);
}

/**
 * Simple spinner — no ora dependency, works on Node 10.
 * Returns { stop(), succeed(msg), fail(msg) }.
 */
function spinner(text) {
  var frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  var i = 0;
  var running = true;
  var lastLen = 0;
  var interval = setInterval(function () {
    if (!running) return;
    var line = chalk.cyan(frames[i++ % frames.length]) + ' ' + text;
    var pad = Math.max(0, lastLen - line.length);
    lastLen = line.length;
    process.stdout.write('\r' + line + ' '.repeat(pad) + ' ');
  }, 80);

  function clearLine() {
    running = false;
    clearInterval(interval);
    process.stdout.write('\r' + ' '.repeat(lastLen + 4) + '\r');
  }

  return {
    stop: function () {
      clearLine();
    },
    succeed: function (msg) {
      clearLine();
      success(msg || text);
    },
    fail: function (msg) {
      clearLine();
      error(msg || text);
    }
  };
}

/**
 * Print a key-value line (for config summaries).
 */
function kvLine(key, value) {
  console.log('  ' + chalk.white(key + ':') + '  ' + value);
}

module.exports = {
  banner: banner,
  divider: divider,
  gap: gap,
  success: success,
  error: error,
  info: info,
  warning: warning,
  dim: dim,
  spinner: spinner,
  kvLine: kvLine,
  chalk: chalk
};
