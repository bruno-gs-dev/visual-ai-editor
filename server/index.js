/**
 * visual-ai-editor — programmatic server entry
 *
 * Exports startServer({ port, envPath, designMdPath, indexHtmlPath, staticDir,
 * apiToken, allowUnsafeProduction, silent })
 *
 *   - Reads .env from envPath (default: <cwd>/.env)
 *   - Mounts Express with /api/edit, /api/design, /api/save
 *   - Returns the express instance (so callers can also .listen themselves)
 *   - By default, also calls app.listen(port) unless options.silent === true
 *
 * This lets consumers do:
 *   const { startServer } = require('visual-ai-editor/server');
 *   startServer({ port: 3000 });
 *
 * without ever copying server.js.
 *
 * SECURITY NOTE: this is a development/staging tool by default — it serves
 * your whole project directory over HTTP and its /api/edit and /api/save
 * endpoints are unauthenticated unless you set `apiToken`. See the "Security
 * & production" section in README.md before exposing this publicly.
 */

var path = require('path');
var fs = require('fs');
var express = require('express');

var DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;
var DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
var GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

// Blocked regardless of staticDir — defense-in-depth against the most common
// secret-leak vectors (dotfiles like .env are already blocked by express.static's
// default `dotfiles: 'ignore'`, but node_modules/ and lockfiles are not).
var SENSITIVE_PATH_RE = /(^|[\\/])(\.git|\.svn|\.hg|node_modules|\.env(\..*)?|\.npmrc|\.npmignore|package(-lock)?\.json|yarn\.lock|pnpm-lock\.yaml|\.ssh|\.aws)([\\/]|$)/i;

// Explicit exception: this package's own public dist/ assets live under
// node_modules/visual-ai-editor/dist — the editor's own bundle/CSS must stay
// reachable, even though node_modules/ is blocked above.
var OWN_DIST_ALLOW_RE = /(^|[\\/])node_modules[\\/]visual-ai-editor[\\/]dist[\\/]/i;

function tryLoadDotenv(envPath){
  // Lazy-require so consumers who don't need .env don't pay the cost.
  try {
    var dotenv = require('dotenv');
    dotenv.config({ path: envPath });
  } catch (e) {
    // dotenv not installed — assume env vars are set by the OS
  }
}

function stripCodeFence(text){
  var trimmed = text.trim();
  var fence = trimmed.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
  return fence ? fence[1].trim() : trimmed;
}

function requireApiToken(token){
  return function (req, res, next){
    if (!token) return next();
    var header = req.get('authorization') || '';
    var bearer = header.replace(/^Bearer\s+/i, '');
    var provided = bearer || req.get('x-ai-editor-token') || '';
    if (provided !== token){
      return res.status(401).json({ error: 'Token inválido ou ausente. Envie "Authorization: Bearer <token>".' });
    }
    next();
  };
}

function assertProductionSafe(options){
  if (process.env.NODE_ENV !== 'production') return;
  if (options.apiToken) return;
  if (options.allowUnsafeProduction === true) return;
  throw new Error(
    '[ai-editor] Recusando iniciar em produção (NODE_ENV=production) sem "apiToken".\n' +
    'Este servidor expõe endpoints de edição por IA sem autenticação por padrão — ' +
    'rodar isso publicamente sem proteção é inseguro (qualquer um pode consumir sua ' +
    'chave da Groq via /api/edit ou sobrescrever seu HTML via /api/save).\n' +
    'Defina options.apiToken (um segredo que só seu frontend conhece), ou passe ' +
    'options.allowUnsafeProduction: true se você já tem autenticação em outra camada ' +
    '(reverse proxy, VPN, etc.) e entende o risco.'
  );
}

function buildApp(options){
  options = options || {};
  assertProductionSafe(options);
  var designMdPath = options.designMdPath || path.join(process.cwd(), 'DESIGN.md');
  var indexHtmlPath = options.indexHtmlPath || path.join(process.cwd(), 'index.html');
  var staticDir = options.staticDir || process.cwd();

  var DESIGN_MD = '';
  var DESIGN_MD_EXISTS = false;
  try {
    DESIGN_MD = fs.readFileSync(designMdPath, 'utf8');
    DESIGN_MD_EXISTS = true;
    if (!options.silent) console.log('[ai-editor] DESIGN.md carregado (' + DESIGN_MD.length + ' caracteres).');
  } catch (e) {
    if (!options.silent){
      console.warn('[ai-editor] DESIGN.md não encontrado em ' + designMdPath + '. A IA editará sem referência de design.');
      console.warn('[ai-editor] Rode "npx visual-ai-editor design:init" para gerar um prompt guiado e criar um.');
    }
  }

  if (!options.silent && !options.apiToken){
    console.warn('[ai-editor] Rodando sem "apiToken" — /api/edit e /api/save aceitam qualquer requisição.');
    console.warn('[ai-editor] Ok para uso local/dev. Para produção, defina options.apiToken (veja README).');
  }

  var app = express();
  app.use(express.json({ limit: '2mb' }));

  // Block sensitive paths regardless of where staticDir points (defense in depth),
  // except this package's own public dist/ assets (needed for the editor itself
  // to load when consumers import it straight from node_modules).
  app.use(function (req, res, next){
    if (OWN_DIST_ALLOW_RE.test(req.path)) return next();
    if (SENSITIVE_PATH_RE.test(req.path)) return res.status(404).end();
    next();
  });

  // Serve the consumer's project directory as static files (so the editor UI
  // in index.html can fetch /api/* from the same origin). Defaults to cwd —
  // pass `staticDir` to narrow this to a public/ folder in production.
  app.use(express.static(staticDir));

  var apiAuth = requireApiToken(options.apiToken);

  app.post('/api/edit', apiAuth, async function (req, res){
    var html = req.body && req.body.html;
    var instruction = req.body && req.body.instruction;
    var selector = (req.body && req.body.selector) || '';
    var force = !!(req.body && req.body.force);

    if (!html || !instruction){
      return res.status(400).json({ error: 'Faltam "html" ou "instruction" no corpo da requisição.' });
    }
    if (!process.env.GROQ_API_KEY){
      return res.status(500).json({ error: 'Servidor sem GROQ_API_KEY configurada (.env).' });
    }

    var designSection = DESIGN_MD
      ? '\n\nDESIGN SYSTEM DE REFERÊNCIA (siga rigorosamente):\n' + DESIGN_MD
      : '';

    var systemPrompt =
      'Você é um editor de HTML que segue estritamente o design system fornecido abaixo.' + designSection + '\n\n' +
      'REGRAS:\n' +
      '- Você recebe um trecho de HTML e uma instrução do usuário para editar.\n' +
      '- Responda APENAS com o HTML atualizado do trecho, mantendo a mesma tag raiz e estrutura externa.\n' +
      '- Reutilize classes CSS já existentes quando fizer sentido. Não invente novas classes a menos que seja realmente necessário.\n' +
      '- NUNCA inclua explicações, comentários ou blocos de markdown — apenas HTML puro.\n' +
      '- SE o pedido do usuário contradiz claramente o design system (ex: pedir border-radius grande quando o design exige 0px, ' +
      'ou usar cores fora da paleta, ou quebrar hierarquia tipográfica), e a instrução NÃO veio com force=true, ' +
      'responda APENAS com um JSON no formato: {"warn":"descreva brevemente por que o pedido conflita com o design system"}\n' +
      '- SE force=true estiver presente, aplique a alteração independentemente de conflitos com o design system.';

    var userPrompt =
      (force ? '[FORÇADO] O usuário quer aplicar esta alteração mesmo conflitando com o design.\n\n' : '') +
      'Seletor aproximado do elemento: ' + selector + '\n\n' +
      'INSTRUÇÃO: ' + instruction + '\n\n' +
      'HTML ORIGINAL DO TRECHO:\n' + html;

    try {
      var apiRes = await fetch(GROQ_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + process.env.GROQ_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          temperature: 0.2,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        })
      });

      var data = await apiRes.json();
      if (!apiRes.ok){
        if (apiRes.status === 429){
          var msg = (data.error && data.error.message) || '';
          var match = msg.match(/try again in ([\d.]+)s/);
          var retryAfter = match ? parseFloat(match[1]) : 10;
          return res.status(429).json({ error: 'Rate limit atingido. Aguarde antes de tentar novamente.', retryAfter: retryAfter });
        }
        throw new Error((data.error && data.error.message) || 'Erro ao chamar a API da Groq.');
      }

      var text = stripCodeFence(data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '');
      var trimmed = text.trim();

      if (trimmed.charAt(0) === '{'){
        try {
          var parsed = JSON.parse(trimmed);
          if (parsed.warn) return res.json({ warn: parsed.warn });
        } catch (e) { /* não era JSON, tratar como HTML */ }
      }

      res.json({ html: trimmed });
    } catch (err) {
      console.error('Erro ao chamar a API da Groq:', err);
      res.status(500).json({ error: err.message || 'Erro ao chamar a API da Groq.' });
    }
  });

  app.get('/api/design', function (req, res){
    res.json({ md: DESIGN_MD, exists: DESIGN_MD_EXISTS });
  });

  app.post('/api/save', apiAuth, function (req, res){
    var html = req.body && req.body.html;
    if (!html) return res.status(400).json({ error: 'Faltando "html" no corpo da requisição.' });
    fs.writeFile(indexHtmlPath, html, 'utf8', function (err){
      if (err){
        console.error('Erro ao salvar index.html:', err);
        return res.status(500).json({ error: 'Erro ao salvar o arquivo: ' + err.message });
      }
      res.json({ ok: true, path: indexHtmlPath });
    });
  });

  return app;
}

function startServer(options){
  options = options || {};
  if (options.envPath) tryLoadDotenv(options.envPath);

  var port = typeof options.port === 'number' ? options.port : DEFAULT_PORT;
  var app = buildApp(options); // buildApp() also runs the production safety check

  if (options.silent) return { app: app, port: port };

  var server = app.listen(port, function (){
    console.log('[ai-editor] server em http://localhost:' + port);
  });
  return { app: app, server: server, port: port };
}

module.exports = { startServer: startServer, buildApp: buildApp };
