import { AI } from './core.js';

/**
 * Client-side i18n. Locale resolution order:
 *   1. init({ locale }) option
 *   2. <html lang="..."> of the host page
 *   3. 'en'
 * AI.t(key, params) interpolates {name} placeholders.
 */

AI.I18N = {
  en: {
    'tool.cursor': 'Select',
    'tool.area': 'Area selection',
    'tool.pencil': 'Pencil (lasso)',
    'panel.label.single': 'What do you want to change here?',
    'panel.label.multi': '{count} elements selected',
    'panel.placeholder': 'E.g.: change this title, change the button color...',
    'panel.apply': 'Apply',
    'panel.save': 'Save',
    'panel.undo': 'Undo (Ctrl+Z)',
    'panel.redo': 'Redo (Ctrl+Y)',
    'panel.design': '📖 View DESIGN.md',
    'panel.close': 'Close',
    'status.empty-instruction': 'Type what you want to change.',
    'status.applying': 'Applying with AI…',
    'status.applied': 'Changed ✓',
    'status.saving': 'Saving…',
    'status.saved': 'Saved to {path} ✓',
    'status.saved-patch': 'Saved ({applied} surgical patch(es)) ✓',
    'status.saved-full': 'Saved (full file — some patches could not be located) ✓',
    'status.save-error': 'Error saving the file.',
    'status.apply-error': 'Failed to apply the change.',
    'status.undone': 'Undone ✓',
    'status.redone': 'Redone ✓',
    'status.rate-limit': '⏳ Rate limit — wait {seconds}s',
    'status.rate-limit-over': 'You can try again ✓',
    'status.too-large': 'Selection too large ({size} chars, limit {limit}). Select something smaller.',
    'status.count-mismatch': 'The AI returned {got} elements, expected {expected}. Try rephrasing.',
    'status.unexpected-html': 'The AI returned unexpected HTML. Try rephrasing the instruction.',
    'status.unexpected-response': 'Unexpected server response ({status}): {body}',
    'status.handoff': '{count} change(s) exported to .ai-editor/pending-changes.md — apply them with your AI coding agent.',
    'force.button': 'Apply anyway',
    'design.loading': 'Loading...',
    'design.error': 'Error loading DESIGN.md',
    'design.missing':
      '<p>This project has no <code>DESIGN.md</code> yet.</p>' +
      '<p>Without it, the AI edits with no design reference — which increases the chance ' +
      'of visual inconsistency (off-palette colors, spacing and components).</p>' +
      '<p>Run this in the project terminal to generate a guided prompt:</p>' +
      '<pre>npx visual-ai-editor design:init</pre>' +
      '<p>Then paste the generated file (<code>DESIGN.prompt.md</code>) into your AI agent ' +
      '(Claude Code, Cursor, etc.) and follow the instructions to create the <code>DESIGN.md</code>.</p>',
    'design.empty': '(DESIGN.md is empty)'
  },
  'pt-BR': {
    'tool.cursor': 'Selecionar',
    'tool.area': 'Seleção por área',
    'tool.pencil': 'Lápis (lasso)',
    'panel.label.single': 'O que você quer mudar aqui?',
    'panel.label.multi': '{count} elementos selecionados',
    'panel.placeholder': 'Ex: troque este título, mude a cor do botão...',
    'panel.apply': 'Alterar',
    'panel.save': 'Salvar',
    'panel.undo': 'Desfazer (Ctrl+Z)',
    'panel.redo': 'Refazer (Ctrl+Y)',
    'panel.design': '📖 Ver DESIGN.md',
    'panel.close': 'Fechar',
    'status.empty-instruction': 'Digite o que você quer mudar.',
    'status.applying': 'Aplicando com IA…',
    'status.applied': 'Alterado ✓',
    'status.saving': 'Salvando…',
    'status.saved': 'Salvo em {path} ✓',
    'status.saved-patch': 'Salvo ({applied} patch(es) cirúrgico(s)) ✓',
    'status.saved-full': 'Salvo (arquivo completo — alguns patches não foram localizados) ✓',
    'status.save-error': 'Erro ao salvar o arquivo.',
    'status.apply-error': 'Falha ao aplicar a alteração.',
    'status.undone': 'Desfeito ✓',
    'status.redone': 'Refeito ✓',
    'status.rate-limit': '⏳ Rate limit — aguarde {seconds}s',
    'status.rate-limit-over': 'Pode tentar novamente ✓',
    'status.too-large': 'Seleção grande demais ({size} caracteres, limite {limit}). Selecione algo menor.',
    'status.count-mismatch': 'A IA devolveu {got} elementos, esperado {expected}. Tente reformular.',
    'status.unexpected-html': 'A IA devolveu um HTML inesperado. Tente reformular a instrução.',
    'status.unexpected-response': 'Resposta inesperada do servidor ({status}): {body}',
    'status.handoff': '{count} mudança(s) exportada(s) para .ai-editor/pending-changes.md — aplique com seu agente de IA.',
    'force.button': 'Aplicar mesmo assim',
    'design.loading': 'Carregando...',
    'design.error': 'Erro ao carregar DESIGN.md',
    'design.missing':
      '<p>Este projeto ainda não tem um <code>DESIGN.md</code>.</p>' +
      '<p>Sem ele, a IA edita sem referência de design — o que aumenta a chance ' +
      'de inconsistência visual (cores, espaçamentos e componentes fora do padrão).</p>' +
      '<p>Rode este comando no terminal do projeto para gerar um prompt guiado:</p>' +
      '<pre>npx visual-ai-editor design:init</pre>' +
      '<p>Depois cole o conteúdo gerado (<code>DESIGN.prompt.md</code>) no seu agente de IA ' +
      '(Claude Code, Cursor, etc.) e siga as instruções para criar o <code>DESIGN.md</code>.</p>',
    'design.empty': '(DESIGN.md vazio)'
  }
};

AI.resolveLocale = function(explicit){
  var candidate = explicit ||
    (typeof document !== 'undefined' && document.documentElement && document.documentElement.lang) ||
    'en';
  var l = String(candidate).toLowerCase();
  if (l === 'pt' || l.indexOf('pt-') === 0) return 'pt-BR';
  return 'en';
};

AI.t = function(key, params){
  var dict = AI.I18N[AI.locale] || AI.I18N.en;
  var template = dict[key] || AI.I18N.en[key] || key;
  return template.replace(/\{(\w+)\}/g, function(_, name){
    return params && params[name] !== undefined ? String(params[name]) : '{' + name + '}';
  });
};
