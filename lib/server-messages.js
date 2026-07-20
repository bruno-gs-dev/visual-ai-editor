/**
 * visual-ai-editor — server-side user-facing messages (i18n)
 *
 * Every string that can reach the editor UI (error messages, warnings) lives
 * here in English and Brazilian Portuguese. `startServer({ locale: 'pt-BR' })`
 * switches the language; default is English.
 *
 * msg(locale)(key, params) → interpolated string. {name} placeholders.
 */

var MESSAGES = {
  en: {
    'auth.invalid': 'Invalid or missing token. Send "Authorization: Bearer <token>".',
    'edit.missing-fields': 'Missing "html" or "instruction" in the request body.',
    'edit.no-api-key': 'Server has no AI API key configured. Run "npx visual-ai-editor config" to set up a provider.',
    'edit.too-large': 'Selection is too large ({size} bytes, limit {limit}). Select a smaller element.',
    'edit.rate-limit': 'Rate limit reached. Wait before trying again.',
    'edit.api-error': 'Error calling the AI provider.',
    'edit.off-palette': 'The change introduces colors outside the DESIGN.md palette: {colors}. Use "apply anyway" to force it.',
    'save.missing-body': 'Missing "html" or "patches" in the request body.',
    'save.write-error': 'Error writing the file: {error}',
    'save.invalid-page': 'Invalid "page" path.',
    'save.patch-failed': 'Could not apply {count} patch(es) to {path} and no full HTML fallback was provided.',
    'handoff.missing-changes': 'Missing "changes" array in the request body.',
    'production.refuse':
      '[ai-editor] Refusing to start in production (NODE_ENV=production) without "apiToken".\n' +
      'This server exposes AI edit endpoints without authentication by default — running it\n' +
      'publicly unprotected is unsafe (anyone can burn your AI API quota via /api/edit or\n' +
      'overwrite your HTML via /api/save).\n' +
      'Set options.apiToken (a secret only your frontend knows), or pass\n' +
      'options.allowUnsafeProduction: true if you already have auth at another layer\n' +
      '(reverse proxy, VPN, etc.) and understand the risk.',
    'log.design-loaded': '[ai-editor] DESIGN.md loaded ({chars} characters, {palette} palette colors).',
    'log.design-missing': '[ai-editor] DESIGN.md not found at {path}. The AI will edit without a design reference.',
    'log.design-hint': '[ai-editor] Run "npx visual-ai-editor design:init" to generate a guided prompt and create one.',
    'log.no-token': '[ai-editor] Running without "apiToken" — /api/edit and /api/save accept any request.',
    'log.no-token-hint': '[ai-editor] Fine for local/dev use. For production, set options.apiToken (see README).',
    'log.listening': '[ai-editor] server at http://localhost:{port}'
  },
  'pt-BR': {
    'auth.invalid': 'Token inválido ou ausente. Envie "Authorization: Bearer <token>".',
    'edit.missing-fields': 'Faltam "html" ou "instruction" no corpo da requisição.',
    'edit.no-api-key': 'Servidor sem chave de API de IA configurada. Execute "npx visual-ai-editor config" para configurar um provider.',
    'edit.too-large': 'A seleção é grande demais ({size} bytes, limite {limit}). Selecione um elemento menor.',
    'edit.rate-limit': 'Rate limit atingido. Aguarde antes de tentar novamente.',
    'edit.api-error': 'Erro ao chamar o provedor de IA.',
    'edit.off-palette': 'A alteração introduz cores fora da paleta do DESIGN.md: {colors}. Use "Aplicar mesmo assim" para forçar.',
    'save.missing-body': 'Faltando "html" ou "patches" no corpo da requisição.',
    'save.write-error': 'Erro ao salvar o arquivo: {error}',
    'save.invalid-page': 'Caminho de "page" inválido.',
    'save.patch-failed': 'Não foi possível aplicar {count} patch(es) em {path} e nenhum HTML completo foi enviado como fallback.',
    'handoff.missing-changes': 'Faltando o array "changes" no corpo da requisição.',
    'production.refuse':
      '[ai-editor] Recusando iniciar em produção (NODE_ENV=production) sem "apiToken".\n' +
      'Este servidor expõe endpoints de edição por IA sem autenticação por padrão — ' +
      'rodar isso publicamente sem proteção é inseguro (qualquer um pode consumir sua ' +
      'cota de API via /api/edit ou sobrescrever seu HTML via /api/save).\n' +
      'Defina options.apiToken (um segredo que só seu frontend conhece), ou passe ' +
      'options.allowUnsafeProduction: true se você já tem autenticação em outra camada ' +
      '(reverse proxy, VPN, etc.) e entende o risco.',
    'log.design-loaded': '[ai-editor] DESIGN.md carregado ({chars} caracteres, {palette} cores na paleta).',
    'log.design-missing': '[ai-editor] DESIGN.md não encontrado em {path}. A IA editará sem referência de design.',
    'log.design-hint': '[ai-editor] Rode "npx visual-ai-editor design:init" para gerar um prompt guiado e criar um.',
    'log.no-token': '[ai-editor] Rodando sem "apiToken" — /api/edit e /api/save aceitam qualquer requisição.',
    'log.no-token-hint': '[ai-editor] Ok para uso local/dev. Para produção, defina options.apiToken (veja README).',
    'log.listening': '[ai-editor] server em http://localhost:{port}'
  }
};

function resolveLocale(locale){
  if (!locale) return 'en';
  var l = String(locale).toLowerCase();
  if (l === 'pt' || l.indexOf('pt-') === 0) return 'pt-BR';
  return 'en';
}

function msg(locale){
  var dict = MESSAGES[resolveLocale(locale)] || MESSAGES.en;
  return function (key, params){
    var template = dict[key] || MESSAGES.en[key] || key;
    return template.replace(/\{(\w+)\}/g, function (_, name){
      return params && params[name] !== undefined ? String(params[name]) : '{' + name + '}';
    });
  };
}

module.exports = { msg: msg, resolveLocale: resolveLocale, MESSAGES: MESSAGES };
