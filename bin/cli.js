#!/usr/bin/env node
/**
 * visual-ai-editor CLI
 *
 *   npx visual-ai-editor [start]        — zero-config: create .env on first run, then serve
 *                                         the project with the editor auto-injected
 *                                         (flags: --port <n>, --no-inject, --no-open)
 *   npx visual-ai-editor design:check   — locate DESIGN.md and report section coverage
 *   npx visual-ai-editor design:init    — write DESIGN.prompt.md (guided prompt for an AI agent)
 *   npx visual-ai-editor design:lint    — find off-palette colors in project CSS/HTML/JS files
 *   npx visual-ai-editor agents:init    — install/update AGENTS.md (normally done by postinstall)
 */

var fs = require('fs');
var path = require('path');
var designCheck = require('../lib/design-check.js');
var designTokens = require('../lib/design-tokens.js');

var LINT_EXTENSIONS = ['.css', '.html', '.htm', '.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte'];
var LINT_IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', '.next', '.cache', 'coverage', '.ai-editor'];
var LINT_MAX_FILES = 5000;

function walkLintFiles(root){
  var results = [];
  var queue = [root];
  while (queue.length && results.length < LINT_MAX_FILES){
    var dir = queue.shift();
    var entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (e) { continue; }
    for (var i = 0; i < entries.length; i++){
      var entry = entries[i];
      if (entry.name.charAt(0) === '.' && entry.name !== '.ai-editor') continue;
      if (entry.isDirectory()){
        if (LINT_IGNORE_DIRS.indexOf(entry.name) !== -1) continue;
        queue.push(path.join(dir, entry.name));
      } else if (LINT_EXTENSIONS.indexOf(path.extname(entry.name).toLowerCase()) !== -1){
        results.push(path.join(dir, entry.name));
      }
    }
  }
  return results;
}

function cmdDesignLint(){
  var root = resolveProjectRoot();
  var designPath = designCheck.findDesignMd(root);

  if (!designPath){
    console.log('[visual-ai-editor] Nenhum DESIGN.md encontrado em ' + root + ' — nada para validar contra.');
    console.log('Rode "npx visual-ai-editor design:init" primeiro.');
    process.exitCode = 1;
    return;
  }

  var designContent = fs.readFileSync(designPath, 'utf8');
  var palette = designTokens.extractPalette(designContent);

  if (palette.size === 0){
    console.log('[visual-ai-editor] DESIGN.md em ' + designPath + ' não tem nenhuma cor detectável — nada para validar.');
    return;
  }

  var files = walkLintFiles(root).filter(function(f){ return path.resolve(f) !== path.resolve(designPath); });
  var totalViolations = 0;
  var filesWithViolations = 0;

  console.log('[visual-ai-editor] Paleta detectada (' + palette.size + ' cores): ' + Array.from(palette).join(', '));
  console.log('[visual-ai-editor] Verificando ' + files.length + ' arquivo(s)...\n');

  files.forEach(function(file){
    var content;
    try { content = fs.readFileSync(file, 'utf8'); }
    catch (e) { return; }

    var violations = designTokens.lintContent(content, palette);
    if (!violations.length) return;

    filesWithViolations++;
    totalViolations += violations.length;
    console.log(path.relative(root, file) + ':');
    violations.forEach(function(v){
      console.log('  linha ' + v.line + ': cor fora da paleta ' + v.color);
    });
  });

  console.log('');
  if (totalViolations === 0){
    console.log('Nenhuma cor fora da paleta encontrada. ✓');
  } else {
    console.log(totalViolations + ' cor(es) fora da paleta em ' + filesWithViolations + ' arquivo(s).');
    console.log('(checagem heurística por regex — cores geradas dinamicamente ou vindas de');
    console.log('bibliotecas externas podem gerar falsos positivos; use como guia, não verdade absoluta.)');
    process.exitCode = 1;
  }
}

function resolveProjectRoot(){
  return process.env.INIT_CWD || process.cwd();
}

function cmdDesignCheck(){
  var root = resolveProjectRoot();
  var found = designCheck.findDesignMd(root);

  if (!found){
    console.log('[visual-ai-editor] Nenhum DESIGN.md encontrado em ' + root + '.');
    console.log('Rode "npx visual-ai-editor design:init" para gerar um prompt guiado e criar um —');
    console.log('isso melhora bastante a precisão das edições feitas pela IA no editor.');
    process.exitCode = 1;
    return;
  }

  var content = fs.readFileSync(found, 'utf8');
  console.log(designCheck.formatReport(found, content));
}

function cmdDesignInit(){
  var root = resolveProjectRoot();
  var existing = designCheck.findDesignMd(root);
  if (existing){
    console.log('[visual-ai-editor] Já existe um DESIGN.md em ' + existing + '.');
    console.log('Rode "npx visual-ai-editor design:check" para ver a cobertura de seções,');
    console.log('ou apague/renomeie o arquivo se quiser gerar um prompt do zero.');
    return;
  }

  var templatePath = path.join(__dirname, '..', 'templates', 'design-md-prompt.md');
  var outPath = path.join(root, 'DESIGN.prompt.md');

  if (fs.existsSync(outPath)){
    console.log('[visual-ai-editor] ' + outPath + ' já existe — nada foi sobrescrito.');
    console.log('Cole o conteúdo desse arquivo no seu agente de IA (Claude Code, Cursor, etc.)');
    console.log('e siga as instruções para gerar o DESIGN.md.');
    return;
  }

  fs.copyFileSync(templatePath, outPath);
  console.log('[visual-ai-editor] Criado: ' + outPath);
  console.log('');
  console.log('Próximo passo: cole esse arquivo no seu agente de IA (ex: "cat DESIGN.prompt.md | claude"');
  console.log('ou copie o conteúdo para o Cursor/outro agente) e siga a entrevista + estrutura');
  console.log('para gerar o DESIGN.md do projeto na raiz.');
}

function cmdAgentsInit(){
  var root = resolveProjectRoot();
  var installAgentsMd = require('../lib/agents-md.js').installAgentsMd;
  var result = installAgentsMd(root);

  switch (result.action){
    case 'created':
      console.log('[visual-ai-editor] Criado: ' + result.path);
      break;
    case 'appended':
      console.log('[visual-ai-editor] ' + result.path + ' já existia — bloco do visual-ai-editor adicionado ao final.');
      break;
    case 'updated':
      console.log('[visual-ai-editor] ' + result.path + ' atualizado (bloco do visual-ai-editor estava desatualizado).');
      break;
    case 'unchanged':
      console.log('[visual-ai-editor] ' + result.path + ' já está atualizado — nada a fazer.');
      break;
  }
}

function openBrowser(url){
  var spawn = require('child_process').spawn;
  var cmd, args;
  if (process.platform === 'win32'){ cmd = 'cmd'; args = ['/c', 'start', '', url]; }
  else if (process.platform === 'darwin'){ cmd = 'open'; args = [url]; }
  else { cmd = 'xdg-open'; args = [url]; }
  try {
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).on('error', function(){}).unref();
  } catch (e) { /* best effort — the URL is printed either way */ }
}

function cmdStart(argv){
  var root = resolveProjectRoot();
  var envInit = require('../lib/env-init.js');
  var envPath = path.join(root, '.env');

  var portFlagIdx = argv.indexOf('--port');
  var portFlag = portFlagIdx !== -1 ? parseInt(argv[portFlagIdx + 1], 10) : NaN;
  var noInject = argv.indexOf('--no-inject') !== -1;
  var noOpen = argv.indexOf('--no-open') !== -1;

  var created = envInit.ensureEnvFile(root);
  var gi = envInit.ensureGitignore(root);
  if (gi.action !== 'unchanged'){
    console.log('[visual-ai-editor] .gitignore ' + (gi.action === 'created' ? 'criado' : 'atualizado') + ' — .env nunca deve ir para o git.');
  }

  try { require('dotenv').config({ path: envPath }); } catch (e) { /* env vars via OS */ }

  var keyState = envInit.checkApiKey(process.env);

  if (created.action === 'created'){
    console.log('');
    console.log('[visual-ai-editor] Criei ' + created.path);
    console.log('');
    console.log('  1. Abra o arquivo e cole sua chave em AI_API_KEY=');
    console.log('     (qualquer provider compatível com OpenAI — o free tier da Groq');
    console.log('      é o caminho mais rápido: https://console.groq.com)');
    console.log('  2. Rode de novo:  npx visual-ai-editor start');
    console.log('');
    console.log('  Usando Ollama/LM Studio local? Descomente o AI_ENDPOINT correspondente');
    console.log('  no .env — não precisa de chave.');
    if (keyState.ok) console.log('\n  (Detectei uma chave no ambiente do sistema — subindo mesmo assim.)');
    if (!keyState.ok){ process.exitCode = 1; return; }
  } else if (!keyState.ok){
    console.log('[visual-ai-editor] ' + envPath + ' existe, mas AI_API_KEY está vazia.');
    console.log('Cole sua chave lá e rode de novo. (Ollama/LM Studio local dispensam chave —');
    console.log('descomente o AI_ENDPOINT correspondente no .env.)');
    process.exitCode = 1;
    return;
  }

  var startServer = require('../server/index.js').startServer;
  var result = startServer({
    port: !isNaN(portFlag) ? portFlag : undefined,
    envPath: envPath,
    staticDir: root,
    inject: !noInject
  });

  var url = 'http://localhost:' + result.port;
  console.log('[visual-ai-editor] Editor no ar: ' + url);
  if (!noInject) console.log('[visual-ai-editor] Toolbar injetada automaticamente em qualquer .html servido (desligue com --no-inject).');
  if (!noOpen) openBrowser(url);
}

function printUsage(){
  console.log('Uso: visual-ai-editor [comando]');
  console.log('');
  console.log('Comandos:');
  console.log('  start          (padrão) Sobe o editor no diretório atual — cria .env na primeira vez');
  console.log('                 Flags: --port <n>  --no-inject  --no-open');
  console.log('  design:check   Procura DESIGN.md no projeto e reporta cobertura das 11 seções');
  console.log('  design:init    Gera DESIGN.prompt.md — um prompt guiado para criar o DESIGN.md com IA');
  console.log('  design:lint    Procura cores fora da paleta do DESIGN.md em CSS/HTML/JS do projeto');
  console.log('  agents:init    Instala/atualiza AGENTS.md (normalmente feito automaticamente no install)');
  console.log('  help           Mostra esta mensagem');
}

var command = process.argv[2];

switch (command){
  case undefined:
  case 'start':
    cmdStart(process.argv.slice(3));
    break;
  case 'design:check':
    cmdDesignCheck();
    break;
  case 'design:init':
    cmdDesignInit();
    break;
  case 'design:lint':
    cmdDesignLint();
    break;
  case 'agents:init':
    cmdAgentsInit();
    break;
  case 'help':
  case '--help':
  case '-h':
    printUsage();
    break;
  default:
    printUsage();
    process.exitCode = 1;
}
