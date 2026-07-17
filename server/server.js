require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DESIGN_MD_PATH = path.join(__dirname, '..', 'DESIGN.md');

var DESIGN_MD = '';
try {
  DESIGN_MD = fs.readFileSync(DESIGN_MD_PATH, 'utf8');
  console.log('[info] DESIGN.md carregado (' + DESIGN_MD.length + ' caracteres).');
} catch (e) {
  console.warn('[warn] DESIGN.md não encontrado em ' + DESIGN_MD_PATH + '. A IA editará sem referência de design.');
}

if (!process.env.GROQ_API_KEY) {
  console.warn('[warn] GROQ_API_KEY não definida. Copie .env.example para .env e preencha sua chave (grátis em console.groq.com).');
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(__dirname));

function stripCodeFence(text) {
  var trimmed = text.trim();
  var fence = trimmed.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
  return fence ? fence[1].trim() : trimmed;
}

app.post('/api/edit', async function (req, res) {
  var html = req.body && req.body.html;
  var instruction = req.body && req.body.instruction;
  var selector = (req.body && req.body.selector) || '';
  var force = !!(req.body && req.body.force);

  if (!html || !instruction) {
    return res.status(400).json({ error: 'Faltam "html" ou "instruction" no corpo da requisição.' });
  }
  if (!process.env.GROQ_API_KEY) {
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
        model: MODEL,
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    var data = await apiRes.json();
    if (!apiRes.ok) {
      if (apiRes.status === 429) {
        var msg = (data.error && data.error.message) || '';
        var match = msg.match(/try again in ([\d.]+)s/);
        var retryAfter = match ? parseFloat(match[1]) : 10;
        return res.status(429).json({ error: 'Rate limit atingido. Aguarde antes de tentar novamente.', retryAfter: retryAfter });
      }
      throw new Error((data.error && data.error.message) || 'Erro ao chamar a API da Groq.');
    }

    var text = stripCodeFence(data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '');
    var trimmed = text.trim();

    if (trimmed.charAt(0) === '{') {
      try {
        var parsed = JSON.parse(trimmed);
        if (parsed.warn) {
          return res.json({ warn: parsed.warn });
        }
      } catch (e) { /* não era JSON, tratar como HTML */ }
    }

    res.json({ html: trimmed });
  } catch (err) {
    console.error('Erro ao chamar a API da Groq:', err);
    res.status(500).json({ error: err.message || 'Erro ao chamar a API da Groq.' });
  }
});

app.get('/api/design', function (req, res) {
  res.json({ md: DESIGN_MD });
});

app.post('/api/save', function (req, res) {
  var html = req.body && req.body.html;
  if (!html) {
    return res.status(400).json({ error: 'Faltando "html" no corpo da requisição.' });
  }
  var filePath = path.join(__dirname, '..', 'index.html');
  fs.writeFile(filePath, html, 'utf8', function (err) {
    if (err) {
      console.error('Erro ao salvar index.html:', err);
      return res.status(500).json({ error: 'Erro ao salvar o arquivo: ' + err.message });
    }
    res.json({ ok: true, path: filePath });
  });
});

app.listen(PORT, function () {
  console.log('AI editor rodando em http://localhost:' + PORT);
});
