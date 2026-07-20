#!/usr/bin/env node
/**
 * visual-ai-editor CLI
 *
 *   npx visual-ai-editor [start]        — zero-config: interactive config on first run, then serve
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
var configLib = require('../lib/config.js');
var ui = require('../lib/cli-ui.js');
var prompts = require('prompts');

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

function parseFlag(argv, flag){
  var idx = argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= argv.length) return null;
  return argv[idx + 1];
}

function cmdConfig(argv){
  var root = resolveProjectRoot();
  var isGlobal = argv.indexOf('--global') !== -1;
  var isShow = argv.indexOf('--show') !== -1;
  var isAuto = argv.indexOf('--auto') !== -1;
  var scope = isGlobal ? 'global' : 'local';

  // --show: display current config with branded output
  if (isShow){
    ui.banner();
    var local = configLib.loadConfig(root);
    var globalPath = configLib.globalConfigPath();
    var global_ = (function(){ try { return JSON.parse(fs.readFileSync(globalPath, 'utf8')); } catch(e){ return null; }})();
    var chalk = ui.chalk;

    ui.info('Config local: ' + ui.dim(configLib.localConfigPath(root)));
    ui.info('Config global: ' + ui.dim(globalPath));
    ui.gap();

    if (local.provider || local.endpoint || local.model || local.apiKey){
      ui.kvLine('Provider', local.provider || ui.dim('(nenhum)'));
      ui.kvLine('Endpoint', local.endpoint || ui.dim('(nenhum)'));
      ui.kvLine('Model', local.model || ui.dim('(nenhum)'));
      if (local.apiKey) ui.kvLine('API Key', local.apiKey.slice(0, 8) + '...');
    } else {
      ui.warning('Nenhuma config local encontrada.');
    }
    ui.divider();
    if (global_ && (global_.provider || global_.endpoint || global_.model || global_.apiKey)){
      ui.kvLine('Provider (global)', global_.provider || ui.dim('(nenhum)'));
      ui.kvLine('Endpoint (global)', global_.endpoint || ui.dim('(nenhum)'));
      ui.kvLine('Model (global)', global_.model || ui.dim('(nenhum)'));
      if (global_.apiKey) ui.kvLine('API Key (global)', global_.apiKey.slice(0, 8) + '...');
    } else {
      ui.warning('Nenhuma config global encontrada.');
    }
    ui.gap();
    var fileConfig = configLib.resolveConfig(root, {});
    if (fileConfig.provider || fileConfig.endpoint){
      ui.info('Resolução ativa:');
      ui.kvLine('Provider', fileConfig.provider || ui.dim('(nenhum)'));
      ui.kvLine('Endpoint', fileConfig.endpoint || ui.dim('(nenhum)'));
      ui.kvLine('Model', fileConfig.model || ui.dim('(nenhum)'));
    }
    return;
  }

  // --provider flag: direct mode (no prompts, with branded output)
  var flagProvider = parseFlag(argv, '--provider');
  var flagModel = parseFlag(argv, '--model');
  var flagKey = parseFlag(argv, '--key');
  var flagEndpoint = parseFlag(argv, '--endpoint');

  if (flagProvider || flagEndpoint){
    ui.banner();
    var preset = configLib.PROVIDER_PRESETS.find(function(p){ return p.id === flagProvider; });
    var data = {
      provider: flagProvider || 'custom',
      endpoint: flagEndpoint || (preset ? preset.endpoint : ''),
      model: flagModel || (preset ? preset.defaultModel : ''),
      apiKey: flagKey || ''
    };
    var spin = ui.spinner('Salvando configuração...');
    var saved = configLib.saveConfig(root, scope, data);
    spin.succeed('Config salva em ' + saved);
    ui.gap();
    ui.kvLine('Provider', data.provider);
    ui.kvLine('Endpoint', data.endpoint);
    ui.kvLine('Model', data.model);
    if (data.apiKey) ui.kvLine('API Key', data.apiKey.slice(0, 8) + '...');
    ui.gap();
    ui.success('Próximo passo: ' + ui.chalk.cyan('npx visual-ai-editor start'));
    return;
  }

  // Interactive mode — full branded experience
  async function run(){
    ui.banner();
    ui.info('Configuração do provider de IA');
    ui.gap();

    // 1. Select provider
    var providerResult = await prompts({
      type: 'select',
      name: 'value',
      message: 'Provider:',
      choices: configLib.PROVIDER_PRESETS.map(function(p){
        return { title: p.name, value: p.id };
      }),
      initial: 0
    });
    if (providerResult.value === undefined){ ui.gap(); return; }

    var preset = configLib.PROVIDER_PRESETS.find(function(p){ return p.id === providerResult.value; });
    if (!preset){ ui.error('Provider inválido.'); return; }

    ui.gap();

    // 2. Select/enter model
    var model = '';
    if (preset.id === 'ollama'){
      // Dynamic Ollama model listing
      var spin = ui.spinner('Buscando modelos locais no Ollama...');
      var ollamaResult = await configLib.fetchOllamaModels(preset.endpoint);
      spin.stop();

      if (ollamaResult.ok && ollamaResult.models.length > 0){
        ui.gap();
        var modelResult = await prompts({
          type: 'select',
          name: 'value',
          message: 'Modelo (Ollama local):',
          choices: ollamaResult.models.map(function(m){
            return { title: m.label, value: m.name };
          }),
          initial: 0
        });
        if (modelResult.value === undefined){ ui.gap(); return; }
        model = modelResult.value;
      } else {
        ui.warning('Ollama não está rodando (' + preset.endpoint + ')');
        ui.info('Inicie o Ollama e tente novamente, ou digite o modelo manualmente.');
        ui.gap();
        var modelText = await prompts({
          type: 'text',
          name: 'value',
          message: 'Modelo (Ollama local):',
          initial: ''
        });
        if (modelText.value === undefined){ ui.gap(); return; }
        model = modelText.value;
      }
    } else if (preset.models.length > 0){
      var modelResult = await prompts({
        type: 'select',
        name: 'value',
        message: 'Modelo (' + preset.name + '):',
        choices: preset.models.map(function(m){
          return { title: m + (m === preset.defaultModel ? '  (padrão)' : ''), value: m };
        }),
        initial: 0
      });
      if (modelResult.value === undefined){ ui.gap(); return; }
      model = modelResult.value;
    } else {
      var modelText = await prompts({
        type: 'text',
        name: 'value',
        message: 'Modelo:',
        initial: preset.defaultModel || ''
      });
      if (modelText.value === undefined){ ui.gap(); return; }
      model = modelText.value;
    }

    ui.gap();

    // 3. API Key (password input — hidden)
    var apiKey = '';
    if (preset.needsKey){
      var keyResult = await prompts({
        type: 'password',
        name: 'value',
        message: 'API Key (' + preset.name + '):'
      });
      if (keyResult.value === undefined){ ui.gap(); return; }
      apiKey = keyResult.value;
      if (!apiKey){
        ui.warning('Sem API key — provider remoto não funcionará.');
        ui.gap();
      }
    }

    // 4. Custom endpoint
    var endpoint = preset.endpoint;
    if (preset.id === 'custom'){
      var epResult = await prompts({
        type: 'text',
        name: 'value',
        message: 'Endpoint URL:',
        validate: function(v){ return v ? true : 'Endpoint é obrigatório'; }
      });
      if (epResult.value === undefined){ ui.gap(); return; }
      endpoint = epResult.value;
    }

    ui.gap();

    // 5. Save
    var data = {
      provider: preset.id,
      endpoint: endpoint,
      model: model,
      apiKey: apiKey
    };

    var spin = ui.spinner('Salvando configuração...');
    var saved = configLib.saveConfig(root, scope, data);
    spin.succeed('Config salva em ' + saved);

    ui.gap();
    ui.divider();
    ui.kvLine('Provider', data.provider);
    ui.kvLine('Endpoint', data.endpoint);
    ui.kvLine('Model', data.model);
    if (data.apiKey) ui.kvLine('API Key', data.apiKey.slice(0, 8) + '...');
    ui.divider();
    ui.gap();

    // 6. Ask to start (skip in --auto mode)
    if (isAuto){
      ui.gap();
      ui.success('Configuração concluída!');
      ui.gap();
    } else {
      var startResult = await prompts({
        type: 'confirm',
        name: 'value',
        message: 'Iniciar o editor agora?',
        initial: true
      });
      ui.gap();

      if (startResult.value){
        cmdStart([]);
      } else {
        ui.success('Próximo passo: ' + ui.chalk.cyan('npx visual-ai-editor start'));
        ui.gap();
      }
    }
  }

  return run().catch(function(e){
    ui.error('Erro: ' + e.message);
    process.exitCode = 1;
  });
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

  var gi = envInit.ensureGitignore(root);
  if (gi.action !== 'unchanged'){
    console.log('[visual-ai-editor] .gitignore ' + (gi.action === 'created' ? 'criado' : 'atualizado') + ' — .env nunca deve ir para o git.');
  }

  // Load .env if it exists (backward compat), but don't auto-create it
  if (fs.existsSync(envPath)){
    try { require('dotenv').config({ path: envPath }); } catch (e) { /* env vars via OS */ }
  }

  // Merge config.json into env — config.json values fill in missing env vars
  var fileConfig = configLib.loadConfig(root);
  if (fileConfig.endpoint && !process.env.AI_ENDPOINT) process.env.AI_ENDPOINT = fileConfig.endpoint;
  if (fileConfig.model && !process.env.AI_MODEL) process.env.AI_MODEL = fileConfig.model;
  if (fileConfig.apiKey && !process.env.AI_API_KEY) process.env.AI_API_KEY = fileConfig.apiKey;

  var keyState = envInit.checkApiKey(process.env);

  if (!keyState.ok){
    // No config found — launch interactive config
    ui.banner();
    ui.info('Nenhuma configuração de provider encontrada.');
    ui.gap();
    ui.info('Vamos configurar agora...');
    ui.gap();

    cmdConfig(['--auto']).then(function(){
      // Re-check after config
      try { require('dotenv').config({ path: envPath }); } catch (e) {}
      var fc = configLib.loadConfig(root);
      if (fc.endpoint && !process.env.AI_ENDPOINT) process.env.AI_ENDPOINT = fc.endpoint;
      if (fc.model && !process.env.AI_MODEL) process.env.AI_MODEL = fc.model;
      if (fc.apiKey && !process.env.AI_API_KEY) process.env.AI_API_KEY = fc.apiKey;
      var ks = envInit.checkApiKey(process.env);
      if (!ks.ok){
        ui.error('Configuração incompleta. Rode novamente: npx visual-ai-editor config');
        process.exitCode = 1;
        return;
      }
      doStart(root, argv, envPath, !noInject, !noOpen, !isNaN(portFlag) ? portFlag : undefined);
    }).catch(function(e){
      ui.error('Erro na configuração: ' + e.message);
      process.exitCode = 1;
    });
    return;
  }

  doStart(root, argv, envPath, !noInject, !noOpen, !isNaN(portFlag) ? portFlag : undefined);
}

function doStart(root, argv, envPath, inject, noOpen, port){
  var startServer = require('../server/index.js').startServer;
  var result = startServer({
    port: port || undefined,
    envPath: envPath,
    staticDir: root,
    inject: inject
  });

  var url = 'http://localhost:' + result.port;
  console.log('[visual-ai-editor] Editor no ar: ' + url);
  if (inject) console.log('[visual-ai-editor] Toolbar injetada automaticamente em qualquer .html servido (desligue com --no-inject).');
  if (!noOpen) openBrowser(url);
}

function printUsage(){
  console.log('Uso: visual-ai-editor [comando]');
  console.log('');
  console.log('Comandos:');
  console.log('  start          (padrão) Sobe o editor no diretório atual — config interativa na primeira vez');
  console.log('                 Flags: --port <n>  --no-inject  --no-open');
  console.log('  config         Configura o provider de IA (interativo ou via flags)');
  console.log('                 Flags: --provider <id>  --model <name>  --key <api-key>');
  console.log('                        --endpoint <url>  --global  --local  --show');
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
  case 'config':
    cmdConfig(process.argv.slice(3));
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
