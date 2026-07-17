#!/usr/bin/env node
/**
 * visual-ai-editor CLI
 *
 *   npx visual-ai-editor design:check   — locate DESIGN.md and report section coverage
 *   npx visual-ai-editor design:init    — write DESIGN.prompt.md (guided prompt for an AI agent)
 *   npx visual-ai-editor agents:init    — install/update AGENTS.md (normally done by postinstall)
 */

var fs = require('fs');
var path = require('path');
var designCheck = require('../lib/design-check.js');

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

function printUsage(){
  console.log('Uso: visual-ai-editor <comando>');
  console.log('');
  console.log('Comandos:');
  console.log('  design:check   Procura DESIGN.md no projeto e reporta cobertura das 11 seções');
  console.log('  design:init    Gera DESIGN.prompt.md — um prompt guiado para criar o DESIGN.md com IA');
  console.log('  agents:init    Instala/atualiza AGENTS.md (normalmente feito automaticamente no install)');
}

var command = process.argv[2];

switch (command){
  case 'design:check':
    cmdDesignCheck();
    break;
  case 'design:init':
    cmdDesignInit();
    break;
  case 'agents:init':
    cmdAgentsInit();
    break;
  default:
    printUsage();
    process.exitCode = command ? 1 : 0;
}
