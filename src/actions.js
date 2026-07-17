import { AI } from './core.js';

AI.showDesignModal = function(){
  var content = document.getElementById('ai-design-content');
  content.innerHTML = '<p style="color:#8b949e">Carregando...</p>';
  AI.designOverlay.classList.add('open');
  fetch(AI.apiBase + '/design')
    .then(function(r){ return r.json(); })
    .then(function(data){
      if (!data.exists){
        content.innerHTML =
          '<p>Este projeto ainda não tem um <code>DESIGN.md</code>.</p>' +
          '<p>Sem ele, a IA edita sem referência de design — o que aumenta a chance ' +
          'de inconsistência visual (cores, espaçamentos e componentes fora do padrão).</p>' +
          '<p>Rode este comando no terminal do projeto para gerar um prompt guiado:</p>' +
          '<pre>npx visual-ai-editor design:init</pre>' +
          '<p>Depois cole o conteúdo gerado (<code>DESIGN.prompt.md</code>) no seu agente de IA ' +
          '(Claude Code, Cursor, etc.) e siga as instruções para criar o <code>DESIGN.md</code>.</p>';
        return;
      }
      var md = data.md || '(DESIGN.md vazio)';
      content.innerHTML = typeof marked !== 'undefined' ? marked.parse(md) : '<pre>' + md + '</pre>';
    })
    .catch(function(){ content.innerHTML = '<p style="color:#e22718">Erro ao carregar DESIGN.md</p>'; });
};

AI.hideDesignModal = function(){
  AI.designOverlay.classList.remove('open');
};

AI.startRateLimitCountdown = function(seconds){
  var statusEl = document.getElementById('ai-editor-status');
  var applyBtn = document.getElementById('ai-editor-apply');
  var remaining = Math.ceil(seconds);
  AI.pending = true;
  applyBtn.disabled = true;

  function tick(){
    statusEl.className = 'status rate-limit';
    statusEl.textContent = '⏳ Rate limit — aguarde ' + remaining + 's';
    if (remaining <= 0){
      clearInterval(AI.rateLimitTimer);
      AI.rateLimitTimer = null;
      statusEl.className = 'status';
      statusEl.textContent = 'Pode tentar novamente ✓';
      statusEl.style.color = '#0fa336';
      AI.pending = false;
      applyBtn.disabled = false;
      return;
    }
    remaining--;
  }
  tick();
  AI.rateLimitTimer = setInterval(tick, 1000);
};

AI.applyWithAI = function(force){
  if (!AI.selectedEls.length || AI.pending) return;
  var instructionEl = document.getElementById('ai-editor-instruction');
  var statusEl = document.getElementById('ai-editor-status');
  var instruction = (force === true) ? AI.lastInstruction : instructionEl.value.trim();
  var isMulti = AI.selectedEls.length > 1;

  var selector, html;
  if (isMulti){
    selector = AI.selectedEls.length + ' elementos';
    var wrapper = '<div data-ai-multi>';
    AI.selectedEls.forEach(function(el){ wrapper += el.outerHTML; });
    wrapper += '</div>';
    html = AI.lastHtml || wrapper;
  } else {
    selector = AI.lastSelector || AI.describeEl(AI.selectedEls[0]);
    html = AI.lastHtml || AI.selectedEls[0].outerHTML;
  }

  if (!force) {
    if (!instruction){
      statusEl.style.color = '#e22718';
      statusEl.textContent = 'Digite o que você quer mudar.';
      return;
    }
    AI.lastInstruction = instruction;
    AI.lastSelector = selector;
    AI.lastHtml = html;
  }

  var applyBtn = document.getElementById('ai-editor-apply');
  AI.pending = true;
  applyBtn.disabled = true;
  statusEl.style.color = '#7e7e7e';
  statusEl.className = 'status';
  statusEl.textContent = 'Aplicando com IA…';

  fetch(AI.apiBase + '/edit', {
    method: 'POST',
    headers: AI.authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ html: html, instruction: instruction, selector: selector, force: !!force })
  })
    .then(function(r){
      return r.text().then(function(raw){
        var data;
        try { data = raw ? JSON.parse(raw) : {}; }
        catch (e) { data = { error: 'Resposta inesperada do servidor (' + r.status + '): ' + raw.slice(0, 200) }; }
        return { status: r.status, data: data };
      });
    })
    .then(function(res){
      if (res.status === 429 && res.data.retryAfter){
        AI.startRateLimitCountdown(res.data.retryAfter);
        return;
      }
      if (res.status >= 400) throw new Error(res.data && res.data.error ? res.data.error : 'Falha ao aplicar a alteração.');

      if (res.data.warn){
        statusEl.className = 'status warn';
        statusEl.innerHTML = '⚠ ' + res.data.warn +
          '<br><button class="btn-force" id="ai-editor-force">Aplicar mesmo assim</button>';
        document.getElementById('ai-editor-force').addEventListener('click', function(){ AI.applyWithAI(true); });
        return;
      }

      var newHtml = (res.data.html || '').trim();
      var temp = document.createElement('div');
      temp.innerHTML = newHtml;

      AI.undoStack.push(AI.selectedEls.slice());

      if (isMulti){
        var container = temp.querySelector('[data-ai-multi]') || temp;
        var newChildren = Array.prototype.slice.call(container.children);
        if (newChildren.length !== AI.selectedEls.length){
          throw new Error('A IA devolveu ' + newChildren.length + ' elementos, esperado ' + AI.selectedEls.length + '. Tente reformular.');
        }
        var updatedEls = [];
        AI.selectedEls.forEach(function(oldEl, i){
          oldEl.replaceWith(newChildren[i]);
          updatedEls.push(newChildren[i]);
        });
        AI.selectedEls = updatedEls;
        AI.lastHtml = '';
        AI.selectedEls.forEach(function(el){ AI.lastHtml += el.outerHTML; });
      } else {
        if (temp.children.length !== 1){
          throw new Error('A IA devolveu um HTML inesperado. Tente reformular a instrução.');
        }
        var newEl = temp.children[0];
        AI.selectedEls[0].replaceWith(newEl);
        AI.selectedEls = [newEl];
        AI.lastHtml = newEl.outerHTML;
      }

      AI.clearSelBoxes();
      AI.selectedEls.forEach(function(el){
        var box = document.createElement('div');
        box.className = 'ai-sel-box';
        document.body.appendChild(box);
        AI.selBoxEls.push(box);
      });
      AI.updateSelectedBoxes();
      AI.positionPanel();
      instructionEl.value = '';
      statusEl.style.color = '#0fa336';
      statusEl.className = 'status';
      statusEl.textContent = 'Alterado ✓';
    })
    .catch(function(err){
      statusEl.style.color = '#e22718';
      statusEl.className = 'status';
      statusEl.textContent = err.message || 'Erro ao aplicar a alteração.';
    })
    .finally(function(){
      AI.pending = false;
      applyBtn.disabled = false;
    });
};

AI.saveToFile = function(){
  var statusEl = document.getElementById('ai-editor-status');
  var saveBtn = document.getElementById('ai-editor-save');
  saveBtn.disabled = true;
  statusEl.style.color = '#7e7e7e';
  statusEl.className = 'status';
  statusEl.textContent = 'Salvando…';

  var clone = document.documentElement.cloneNode(true);
  clone.querySelectorAll('#ai-toolbar,#ai-editor-hover-box,#ai-editor-selected-box,#ai-editor-tag-label,#ai-editor-panel,#ai-design-overlay,#ai-draw-overlay,.ai-sel-box,#ai-selection-label').forEach(function(el){ el.remove(); });
  var fullHtml = '<!DOCTYPE html>\n' + clone.outerHTML;

  fetch(AI.apiBase + '/save', {
    method: 'POST',
    headers: AI.authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ html: fullHtml })
  })
    .then(function(r){ return r.json(); })
    .then(function(res){
      if (!res.ok) throw new Error(res.error || 'Erro ao salvar.');
      statusEl.style.color = '#0fa336';
      statusEl.className = 'status';
      statusEl.textContent = 'Salvo em index.html ✓';
    })
    .catch(function(err){
      statusEl.style.color = '#e22718';
      statusEl.className = 'status';
      statusEl.textContent = err.message || 'Erro ao salvar o arquivo.';
    })
    .finally(function(){
      saveBtn.disabled = false;
    });
};

AI.undoLast = function(){
  if (!AI.undoStack.length) return;
  var oldEls = AI.undoStack.pop();
  var statusEl = document.getElementById('ai-editor-status');

  if (AI.selectedEls.length){
    var newEls = AI.selectedEls.slice();
    oldEls.forEach(function(oldEl, i){
      if (newEls[i]) newEls[i].replaceWith(oldEl);
    });
    AI.selectedEls = oldEls;
  } else {
    oldEls.forEach(function(el){ document.body.appendChild(el); });
    AI.selectedEls = oldEls;
  }

  AI.clearSelBoxes();
  AI.selectedEls.forEach(function(el){
    var box = document.createElement('div');
    box.className = 'ai-sel-box';
    document.body.appendChild(box);
    AI.selBoxEls.push(box);
  });
  AI.updateSelectedBoxes();
  AI.positionPanel();
  AI.panel.classList.add('open');

  statusEl.style.color = '#0fa336';
  statusEl.className = 'status';
  statusEl.textContent = 'Desfeito ✓';
};
