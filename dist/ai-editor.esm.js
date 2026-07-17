// visual-ai-editor — ESM bundle
// https://github.com/bruno/visual-ai-editor

// --- core.js ---
export var AI = {
  active: false,
  selectedEls: [],
  currentTool: 'cursor',
  toolbar: null, hoverBox: null, tagLabel: null, panel: null,
  designOverlay: null, drawOverlay: null, selLabel: null,
  rateLimitTimer: null,

  isDrawing: false,
  drawStartX: 0, drawStartY: 0,
  drawRect: null, drawPath: null,
  lassoPoints: [],
  selBoxEls: [],

  pending: false,
  lastInstruction: '',
  lastSelector: '',
  lastHtml: '',
  undoStack: [],

  apiBase: '/api',
  apiToken: '',
  _initialized: false,
  _eventCleanups: [],
  css: '',

  authHeaders: function(extra){
    var headers = extra || {};
    if (AI.apiToken) headers['Authorization'] = 'Bearer ' + AI.apiToken;
    return headers;
  },

  SVG_NS: 'http://www.w3.org/2000/svg',
  SVG_CURSOR: '<svg viewBox="0 0 24 24"><path d="M5 3l14 8-6 2-3 6z"/></svg>',
  SVG_AREA:  '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="4 2"/></svg>',
  SVG_PENCIL: '<svg viewBox="0 0 24 24"><path d="M17 3l4 4-12 12H5v-4L17 3z"/></svg>',

  px: function(n){ return n + 'px'; },

  describeEl: function(el){
    var s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (el.classList && el.classList.length) s += '.' + Array.prototype.join.call(el.classList, '.');
    return s;
  },

  isEditorEl: function(el){
    return el && el.closest && el.closest('#ai-toolbar, #ai-editor-panel, #ai-design-overlay, #ai-draw-overlay, #ai-selection-label');
  }
};


// --- tools.js ---

AI.updateLassoPath = function(){
  if (!AI.drawPath || !AI.lassoPoints.length) return;
  var d = 'M' + AI.lassoPoints[0].x + ' ' + AI.lassoPoints[0].y;
  for (var i = 1; i < AI.lassoPoints.length; i++){
    d += ' L' + AI.lassoPoints[i].x + ' ' + AI.lassoPoints[i].y;
  }
  AI.drawPath.setAttribute('d', d);
};

AI.rectsIntersect = function(a, b){
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
};

AI.walkElements = function(root, fn){
  var stack = [root];
  while (stack.length){
    var el = stack.pop();
    if (el.nodeType !== 1) continue;
    fn(el);
    var children = el.children;
    for (var i = 0; i < children.length; i++) stack.push(children[i]);
  }
};

AI.deduplicateElements = function(els){
  for (var i = els.length - 1; i >= 0; i--){
    var el = els[i];
    for (var j = 0; j < els.length; j++){
      if (i !== j && els[j].contains(el)){
        els.splice(i, 1);
        break;
      }
    }
  }
  return els;
};

AI.findElementsInRect = function(rect){
  var result = [];
  AI.walkElements(document.body, function(el){
    if (AI.isEditorEl(el)) return;
    var r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    var cx = r.left + r.width / 2;
    var cy = r.top + r.height / 2;
    if (cx >= rect.left && cx <= rect.right && cy >= rect.top && cy <= rect.bottom) result.push(el);
  });
  return AI.deduplicateElements(result);
};

AI.samplePath = function(points, spacing){
  var samples = [];
  for (var i = 1; i < points.length; i++){
    var dx = points[i].x - points[i-1].x;
    var dy = points[i].y - points[i-1].y;
    var dist = Math.sqrt(dx*dx + dy*dy);
    var steps = Math.max(1, Math.floor(dist / spacing));
    for (var s = 0; s < steps; s++){
      var t = s / steps;
      samples.push({
        x: points[i-1].x + dx * t,
        y: points[i-1].y + dy * t
      });
    }
  }
  if (points.length) samples.push(points[points.length - 1]);
  return samples;
};

AI.pointInPolygon = function(point, polygon){
  var x = point.x, y = point.y;
  var inside = false;
  for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++){
    var xi = polygon[i].x, yi = polygon[i].y;
    var xj = polygon[j].x, yj = polygon[j].y;
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)){
      inside = !inside;
    }
  }
  return inside;
};

AI.findElementsAtPoints = function(points){
  var seen = new Map();
  points.forEach(function(p){
    var el = document.elementFromPoint(p.x, p.y);
    if (el && !AI.isEditorEl(el)){
      if (!seen.has(el)) seen.set(el, el);
    }
  });
  var result = Array.from(seen.values());
  if (AI.lassoPoints.length > 2){
    result = result.filter(function(el){
      var r = el.getBoundingClientRect();
      var cx = r.left + r.width / 2;
      var cy = r.top + r.height / 2;
      return AI.pointInPolygon({x: cx, y: cy}, AI.lassoPoints);
    });
  }
  return AI.deduplicateElements(result);
};

AI.onMouseDown = function(e){
  if (!AI.active || AI.selectedEls.length) return;
  if (e.button !== 0) return;
  var el = e.target;
  if (AI.isEditorEl(el)) return;
  if (AI.currentTool === 'cursor') return;

  if (AI.currentTool === 'area' || AI.currentTool === 'pencil'){
    AI.isDrawing = true;
    AI.drawStartX = e.clientX;
    AI.drawStartY = e.clientY;
    AI.hoverBox.style.display = 'none';
    AI.tagLabel.style.display = 'none';

    while (AI.drawOverlay.firstChild) AI.drawOverlay.removeChild(AI.drawOverlay.firstChild);

    if (AI.currentTool === 'area'){
      AI.drawRect = document.createElementNS(AI.SVG_NS, 'rect');
      AI.drawRect.setAttribute('class', 'ai-draw-rect');
      AI.drawRect.setAttribute('x', AI.px(e.clientX));
      AI.drawRect.setAttribute('y', AI.px(e.clientY));
      AI.drawRect.setAttribute('width', '0');
      AI.drawRect.setAttribute('height', '0');
      AI.drawOverlay.appendChild(AI.drawRect);
    } else {
      AI.lassoPoints = [{x: e.clientX, y: e.clientY}];
      AI.drawPath = document.createElementNS(AI.SVG_NS, 'path');
      AI.drawPath.setAttribute('class', 'ai-draw-lasso');
      AI.drawPath.setAttribute('d', 'M' + e.clientX + ' ' + e.clientY);
      AI.drawOverlay.appendChild(AI.drawPath);
    }
  }
};

AI.onMouseMove = function(e){
  if (!AI.active) return;

  if (AI.isDrawing){
    if (AI.currentTool === 'area'){
      var x = Math.min(AI.drawStartX, e.clientX);
      var y = Math.min(AI.drawStartY, e.clientY);
      var w = Math.abs(e.clientX - AI.drawStartX);
      var h = Math.abs(e.clientY - AI.drawStartY);
      AI.drawRect.setAttribute('x', AI.px(x));
      AI.drawRect.setAttribute('y', AI.px(y));
      AI.drawRect.setAttribute('width', AI.px(w));
      AI.drawRect.setAttribute('height', AI.px(h));
    } else if (AI.currentTool === 'pencil'){
      AI.lassoPoints.push({x: e.clientX, y: e.clientY});
      AI.updateLassoPath();
    }
    return;
  }

  if (AI.selectedEls.length) return;

  var el = e.target;
  if (AI.isEditorEl(el)){
    AI.hoverBox.style.display = 'none';
    AI.tagLabel.style.display = 'none';
    return;
  }
  var r = el.getBoundingClientRect();
  AI.hoverBox.style.display = 'block';
  AI.hoverBox.style.left = AI.px(r.left);
  AI.hoverBox.style.top = AI.px(r.top);
  AI.hoverBox.style.width = AI.px(r.width);
  AI.hoverBox.style.height = AI.px(r.height);
  AI.tagLabel.style.display = 'block';
  AI.tagLabel.style.left = AI.px(r.left);
  AI.tagLabel.style.top = AI.px(Math.max(0, r.top - 20));
  AI.tagLabel.textContent = AI.describeEl(el);
};

AI.onMouseUp = function(e){
  if (!AI.isDrawing) return;
  AI.isDrawing = false;

  if (AI.currentTool === 'area' && AI.drawRect){
    var rx = parseFloat(AI.drawRect.getAttribute('x'));
    var ry = parseFloat(AI.drawRect.getAttribute('y'));
    var rw = parseFloat(AI.drawRect.getAttribute('width'));
    var rh = parseFloat(AI.drawRect.getAttribute('height'));

    while (AI.drawOverlay.firstChild) AI.drawOverlay.removeChild(AI.drawOverlay.firstChild);
    AI.drawRect = null;

    if (rw < 5 && rh < 5) return;

    var selRect = { left: rx, top: ry, right: rx + rw, bottom: ry + rh };
    var found = AI.findElementsInRect(selRect);
    if (found.length) AI.selectElements(found);

  } else if (AI.currentTool === 'pencil' && AI.drawPath){
    while (AI.drawOverlay.firstChild) AI.drawOverlay.removeChild(AI.drawOverlay.firstChild);
    AI.drawPath = null;

    var samples = AI.samplePath(AI.lassoPoints, 8);
    var found = AI.findElementsAtPoints(samples);
    AI.lassoPoints = [];
    if (found.length) AI.selectElements(found);
  }
};


// --- selection.js ---

AI.clearSelBoxes = function(){
  AI.selBoxEls.forEach(function(b){ if (b.parentNode) b.parentNode.removeChild(b); });
  AI.selBoxEls = [];
  AI.selLabel.style.display = 'none';
};

AI.updateSelectedBoxes = function(){
  AI.selectedEls.forEach(function(el, i){
    if (!AI.selBoxEls[i]) return;
    var r = el.getBoundingClientRect();
    AI.selBoxEls[i].style.display = 'block';
    AI.selBoxEls[i].style.left = AI.px(r.left);
    AI.selBoxEls[i].style.top = AI.px(r.top);
    AI.selBoxEls[i].style.width = AI.px(r.width);
    AI.selBoxEls[i].style.height = AI.px(r.height);
  });
};

AI.positionPanel = function(){
  if (!AI.selectedEls.length) return;
  var lowest = 0;
  AI.selectedEls.forEach(function(el){ var r = el.getBoundingClientRect(); if (r.bottom > lowest) lowest = r.bottom; });
  var top = lowest + 6;
  var first = AI.selectedEls[0].getBoundingClientRect();
  if (top + 300 > window.innerHeight) top = Math.max(12, first.top - 6 - AI.panel.offsetHeight);
  var left = Math.min(window.innerWidth - 356, Math.max(12, first.left));
  AI.panel.style.top = AI.px(Math.max(12, Math.min(top, window.innerHeight - 40)));
  AI.panel.style.left = AI.px(left);
};

AI.exitSelection = function(){
  AI.selectedEls = [];
  AI.clearSelBoxes();
  AI.panel.classList.remove('open');
};

AI.selectElements = function(els){
  AI.selectedEls = els;
  AI.hoverBox.style.display = 'none';
  AI.tagLabel.style.display = 'none';
  AI.clearSelBoxes();
  els.forEach(function(el){
    var box = document.createElement('div');
    box.className = 'ai-sel-box';
    document.body.appendChild(box);
    AI.selBoxEls.push(box);
  });
  AI.updateSelectedBoxes();
  AI.panel.classList.add('open');
  AI.positionPanel();
  var statusEl = document.getElementById('ai-editor-status');
  statusEl.textContent = '';
  statusEl.className = 'status';
  document.getElementById('ai-editor-instruction').value = '';
  var lbl = document.getElementById('ai-editor-label');
  lbl.textContent = els.length === 1 ? 'O que você quer mudar aqui?' : els.length + ' elementos selecionados';
  AI.selLabel.style.display = els.length > 1 ? 'block' : 'none';
  if (els.length > 1){
    var lowest = 0;
    els.forEach(function(el){ var b = el.getBoundingClientRect(); if (b.bottom > lowest) lowest = b.bottom; });
    AI.selLabel.style.left = AI.px(els[0].getBoundingClientRect().left);
    AI.selLabel.style.top = AI.px(Math.max(0, lowest + 4));
    AI.selLabel.textContent = els.length + ' elementos selecionados';
  }
  document.getElementById('ai-editor-instruction').focus();
};

AI.onClick = function(e){
  if (!AI.active) return;
  var el = e.target;
  if (AI.isEditorEl(el)) return;
  if (AI.selectedEls.length) return;
  if (AI.currentTool !== 'cursor') return;
  e.preventDefault();
  e.stopPropagation();
  AI.selectElements([el]);
};


// --- actions.js ---

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


// --- ui.js ---

AI.setTool = function(tool){
  AI.currentTool = tool;
  AI.toolbar.querySelectorAll('button').forEach(function(b){
    b.classList.toggle('active', b.getAttribute('data-tool') === tool);
  });
  if (!AI.active) AI.toggleMode(true);
};

AI.toggleMode = function(on){
  AI.active = typeof on === 'boolean' ? on : !AI.active;
  if (!AI.active){
    AI.currentTool = 'cursor';
    AI.toolbar.querySelectorAll('button').forEach(function(b){ b.classList.remove('active'); });
    AI.exitSelection();
    AI.hoverBox.style.display = 'none';
    AI.tagLabel.style.display = 'none';
  }
};

AI._onScroll = function(){ AI.updateSelectedBoxes(); AI.positionPanel(); };
AI._onResize = function(){ AI.updateSelectedBoxes(); AI.positionPanel(); };
AI._onKeydown = function(e){
  if ((e.ctrlKey || e.metaKey) && e.key === 'z'){
    var tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT') return;
    e.preventDefault();
    AI.undoLast();
    return;
  }
  if (e.key === 'Escape'){
    if (AI.designOverlay && AI.designOverlay.classList.contains('open')){ AI.hideDesignModal(); return; }
    if (AI.selectedEls.length) AI.exitSelection();
  }
};

AI._addEvent = function(target, event, handler, options){
  target.addEventListener(event, handler, options);
  AI._eventCleanups.push(function(){ target.removeEventListener(event, handler, options); });
};

AI.createUI = function(){
  AI.toolbar = document.createElement('div');
  AI.toolbar.id = 'ai-toolbar';
  AI.toolbar.innerHTML =
    '<button type="button" class="active" data-tool="cursor" title="Selecionar">' + AI.SVG_CURSOR + '</button>' +
    '<button type="button" data-tool="area" title="Seleção por área">' + AI.SVG_AREA + '</button>' +
    '<button type="button" data-tool="pencil" title="Lápis (lasso)">' + AI.SVG_PENCIL + '</button>';
  document.body.appendChild(AI.toolbar);

  AI.toolbar.querySelector('[data-tool="cursor"]').addEventListener('click', function(){ AI.setTool('cursor'); });
  AI.toolbar.querySelector('[data-tool="area"]').addEventListener('click', function(){ AI.setTool('area'); });
  AI.toolbar.querySelector('[data-tool="pencil"]').addEventListener('click', function(){ AI.setTool('pencil'); });

  AI.hoverBox = document.createElement('div');
  AI.hoverBox.id = 'ai-editor-hover-box';
  document.body.appendChild(AI.hoverBox);

  AI.tagLabel = document.createElement('div');
  AI.tagLabel.id = 'ai-editor-tag-label';
  document.body.appendChild(AI.tagLabel);

  AI.drawOverlay = document.createElementNS(AI.SVG_NS, 'svg');
  AI.drawOverlay.id = 'ai-draw-overlay';
  AI.drawOverlay.setAttribute('width', '100%');
  AI.drawOverlay.setAttribute('height', '100%');
  document.body.appendChild(AI.drawOverlay);

  AI.selLabel = document.createElement('div');
  AI.selLabel.id = 'ai-selection-label';
  document.body.appendChild(AI.selLabel);

  AI.designOverlay = document.createElement('div');
  AI.designOverlay.id = 'ai-design-overlay';
  AI.designOverlay.innerHTML =
    '<div id="ai-design-modal">' +
      '<div class="head"><span>DESIGN.md</span><button id="ai-design-close" type="button">×</button></div>' +
      '<div id="ai-design-content" class="markdown-body"></div>' +
    '</div>';
  document.body.appendChild(AI.designOverlay);

  AI.panel = document.createElement('div');
  AI.panel.id = 'ai-editor-panel';
  AI.panel.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center">' +
      '<label id="ai-editor-label" style="margin:0">O que você quer mudar aqui?</label>' +
      '<button id="ai-editor-close" type="button" style="background:none;border:none;color:#7e7e7e;font-size:18px;cursor:pointer;line-height:1;padding:0" aria-label="Fechar">×</button>' +
    '</div>' +
    '<textarea id="ai-editor-instruction" rows="3" placeholder="Ex: troque este título, mude a cor do botão..."></textarea>' +
    '<div class="actions">' +
      '<button class="btn-apply" id="ai-editor-apply" type="button">Alterar</button>' +
      '<button class="btn-save" id="ai-editor-save" type="button">Salvar</button>' +
      '<button class="btn-undo" id="ai-editor-undo" type="button" title="Desfazer (Ctrl+Z)">↩</button>' +
    '</div>' +
    '<button class="btn-design" id="ai-editor-design" type="button">📖 Ver DESIGN.md</button>' +
    '<div class="status" id="ai-editor-status"></div>';
  document.body.appendChild(AI.panel);

  document.getElementById('ai-editor-close').addEventListener('click', AI.exitSelection);
  document.getElementById('ai-editor-apply').addEventListener('click', AI.applyWithAI);
  document.getElementById('ai-editor-save').addEventListener('click', AI.saveToFile);
  document.getElementById('ai-editor-undo').addEventListener('click', AI.undoLast);
  document.getElementById('ai-editor-design').addEventListener('click', AI.showDesignModal);
  document.getElementById('ai-design-close').addEventListener('click', AI.hideDesignModal);
  AI.designOverlay.addEventListener('click', function(e){ if (e.target === AI.designOverlay) AI.hideDesignModal(); });
  document.getElementById('ai-editor-instruction').addEventListener('keydown', function(e){
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); AI.applyWithAI(); }
  });

  AI._addEvent(window, 'scroll', AI._onScroll, true);
  AI._addEvent(window, 'resize', AI._onResize);
  AI._addEvent(document, 'mousemove', AI.onMouseMove, true);
  AI._addEvent(document, 'mousedown', AI.onMouseDown, true);
  AI._addEvent(document, 'mouseup', AI.onMouseUp, true);
  AI._addEvent(document, 'click', AI.onClick, true);
  AI._addEvent(document, 'keydown', AI._onKeydown);
};

AI._injectCSS = function(url){
  if (document.getElementById('ai-editor-css') || document.getElementById('ai-editor-css-inline')) return;

  // Prefer the embedded CSS string (works regardless of where the page is served from)
  if (AI.css && typeof AI.css === 'string'){
    var style = document.createElement('style');
    style.id = 'ai-editor-css-inline';
    style.appendChild(document.createTextNode(AI.css));
    document.head.appendChild(style);
    return;
  }

  // Fallback: <link> with a path supplied by the consumer
  if (url){
    var link = document.createElement('link');
    link.id = 'ai-editor-css';
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);
  }
};

AI._removeCSS = function(){
  ['ai-editor-css', 'ai-editor-css-inline'].forEach(function(id){
    var el = document.getElementById(id);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  });
};

AI._removeUI = function(){
  var ids = [
    'ai-toolbar', 'ai-editor-hover-box', 'ai-editor-tag-label',
    'ai-draw-overlay', 'ai-selection-label', 'ai-design-overlay',
    'ai-editor-panel'
  ];
  ids.forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.parentNode.removeChild(el);
  });
  AI.selBoxEls.forEach(function(b){ if (b.parentNode) b.parentNode.removeChild(b); });
  AI.selBoxEls = [];
};

AI.init = function(options){
  options = options || {};
  if (AI._initialized) return;

  AI.apiBase = options.apiBase || '/api';
  AI.apiToken = options.apiToken || '';

  if (options.cssInject !== false){
    AI._injectCSS(options.cssUrl);
  }

  AI.createUI();
  AI._initialized = true;
};

AI.destroy = function(){
  if (!AI._initialized) return;

  AI.exitSelection();

  AI._removeUI();
  AI._removeCSS();

  AI._eventCleanups.forEach(function(fn){ fn(); });
  AI._eventCleanups = [];

  AI._initialized = false;
  AI.active = false;
  AI.selectedEls = [];
  AI.undoStack = [];
  AI.pending = false;
};


// --- index.js ---





var __EMBEDDED_CSS__ = `/* ---------- AI Selection Editor ---------- */
#ai-toolbar{
  position:fixed;left:var(--lg, 16px);top:50%;transform:translateY(-50%);z-index:400;
  display:flex;flex-direction:column;gap:2px;
  background:#1a1a1a;border:1px solid #333;border-radius:12px;
  box-shadow:0 4px 24px rgba(0,0,0,.5);padding:4px;
}
#ai-toolbar button{
  width:40px;height:40px;border:none;border-radius:8px;
  background:transparent;color:#7e7e7e;cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  transition:background .15s,color .15s;
}
#ai-toolbar button:hover{background:#262626;color:#ccc}
#ai-toolbar button.active{background:#fff;color:#111}
#ai-toolbar button svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#ai-editor-hover-box,#ai-editor-selected-box{
  position:fixed;pointer-events:none;z-index:390;border-radius:2px;display:none;
}
#ai-editor-hover-box{border:2px dashed #1c69d4;background:rgba(28,105,212,.08)}
#ai-editor-selected-box{border:2px solid #e22718;background:rgba(226,39,24,.08)}
#ai-editor-tag-label{
  position:fixed;z-index:391;background:#e22718;color:#fff;font-size:11px;font-weight:700;
  padding:2px 6px;border-radius:2px;pointer-events:none;letter-spacing:.5px;font-family:var(--font, sans-serif);display:none;
}
#ai-draw-overlay{
  position:fixed;inset:0;z-index:450;pointer-events:none;
}
#ai-draw-overlay rect.ai-draw-rect{
  fill:rgba(28,105,212,.1);stroke:#1c69d4;stroke-width:2;stroke-dasharray:6 3;
}
#ai-draw-overlay path.ai-draw-lasso{
  fill:rgba(28,105,212,.08);stroke:#1c69d4;stroke-width:2;stroke-dasharray:6 3;
}
.ai-sel-box{
  position:fixed;pointer-events:none;z-index:390;
  border:2px solid #e22718;background:rgba(226,39,24,.08);
}
#ai-selection-label{
  position:fixed;z-index:391;background:#e22718;color:#fff;font-size:11px;font-weight:700;
  padding:2px 6px;pointer-events:none;letter-spacing:.5px;font-family:var(--font, sans-serif);display:none;
}
#ai-editor-panel{
  position:fixed;z-index:500;width:340px;max-width:92vw;
  background:#111;border:1px solid #333;border-radius:8px;
  box-shadow:0 12px 40px rgba(0,0,0,.5);color:#eee;font-family:var(--font, sans-serif);
  display:none;flex-direction:column;padding:16px;gap:12px;
}
#ai-editor-panel.open{display:flex}
#ai-editor-panel label{font-size:13px;font-weight:600;color:#eee}
#ai-editor-panel textarea{width:100%;background:#0d0d0d;border:1px solid #333;color:#eee;border-radius:4px;padding:8px;font-size:13px;font-family:var(--font, sans-serif);resize:vertical}
#ai-editor-panel textarea:focus{outline:none;border-color:#555}
#ai-editor-panel .actions{display:flex;gap:8px}
#ai-editor-panel .btn-apply{flex:1;height:36px;border-radius:4px;border:none;background:#1c69d4;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font, sans-serif)}
#ai-editor-panel .btn-apply:hover{background:#0653b6}
#ai-editor-panel .btn-apply:disabled{opacity:.5;cursor:not-allowed}
#ai-editor-panel .btn-save{flex:1;height:36px;border-radius:4px;border:1px solid #444;background:#1a1a1a;color:#ccc;font-size:13px;cursor:pointer;font-family:var(--font, sans-serif)}
#ai-editor-panel .btn-save:hover{background:#262626;border-color:#555}
#ai-editor-panel .btn-save:disabled{opacity:.5;cursor:not-allowed}
#ai-editor-panel .btn-undo{width:36px;height:36px;border-radius:0;border:1px solid #444;background:#1a1a1a;color:#ccc;font-size:16px;cursor:pointer;font-family:var(--font, sans-serif);display:inline-flex;align-items:center;justify-content:center}
#ai-editor-panel .btn-undo:hover{background:#262626;border-color:#555}
#ai-editor-panel .btn-undo:disabled{opacity:.3;cursor:not-allowed}
#ai-editor-panel .status{font-size:12px;min-height:16px}
#ai-editor-panel .status.warn{color:var(--warning, #f4b400);background:rgba(244,180,0,.1);border:1px solid rgba(244,180,0,.25);border-radius:4px;padding:8px}
#ai-editor-panel .btn-force{width:100%;height:32px;border-radius:4px;border:1px solid var(--warning, #f4b400);background:transparent;color:var(--warning, #f4b400);font-size:12px;cursor:pointer;font-family:var(--font, sans-serif);margin-top:4px}
#ai-editor-panel .btn-force:hover{background:rgba(244,180,0,.1)}
#ai-editor-panel .btn-design{width:100%;height:32px;border-radius:4px;border:1px solid #333;background:#1a1a1a;color:#999;font-size:12px;cursor:pointer;font-family:var(--font, sans-serif);display:flex;align-items:center;justify-content:center;gap:6px}
#ai-editor-panel .btn-design:hover{background:#262626;color:#ccc}
#ai-editor-panel .status.rate-limit{color:var(--warning, #f4b400);background:rgba(244,180,0,.12);border:1px solid rgba(244,180,0,.3);border-radius:4px;padding:8px;text-align:center;font-weight:600}
#ai-design-overlay{
  position:fixed;inset:0;z-index:600;background:rgba(0,0,0,.75);
  display:none;align-items:center;justify-content:center;
  backdrop-filter:blur(4px);
}
#ai-design-overlay.open{display:flex}
#ai-design-modal{
  width:700px;max-width:92vw;max-height:80vh;
  background:#111;border:1px solid #333;border-radius:12px;
  box-shadow:0 20px 60px rgba(0,0,0,.6);color:#ccc;font-family:var(--font, sans-serif);
  display:flex;flex-direction:column;overflow:hidden;
}
#ai-design-modal .head{
  display:flex;justify-content:space-between;align-items:center;
  padding:16px 20px;border-bottom:1px solid #262626;
}
#ai-design-modal .head span{font-size:14px;font-weight:700;color:#eee}
#ai-design-modal .head button{background:none;border:none;color:#7e7e7e;font-size:20px;cursor:pointer;line-height:1}
#ai-design-modal .head button:hover{color:#eee}
#ai-design-content.markdown-body{
  padding:24px 28px;overflow:auto;flex:1;
  font-size:14px;line-height:1.7;color:#c9d1d9;
  background:#0d1117;
}
#ai-design-content.markdown-body h1,#ai-design-content.markdown-body h2,
#ai-design-content.markdown-body h3,#ai-design-content.markdown-body h4,
#ai-design-content.markdown-body h5,#ai-design-content.markdown-body h6{
  margin-top:24px;margin-bottom:12px;font-weight:700;line-height:1.25;color:#e6edf3;
}
#ai-design-content.markdown-body h1{font-size:28px;padding-bottom:8px;border-bottom:1px solid #21262d}
#ai-design-content.markdown-body h2{font-size:22px;padding-bottom:6px;border-bottom:1px solid #21262d}
#ai-design-content.markdown-body h3{font-size:18px}
#ai-design-content.markdown-body h4{font-size:16px}
#ai-design-content.markdown-body p{margin:0 0 12px}
#ai-design-content.markdown-body ul,#ai-design-content.markdown-body ol{
  padding-left:24px;margin:0 0 12px;
}
#ai-design-content.markdown-body li{margin-bottom:4px}
#ai-design-content.markdown-body code{
  background:rgba(110,118,129,.2);padding:2px 6px;border-radius:4px;font-size:13px;
  font-family:"SFMono-Regular",Consolas,monospace;color:#e6edf3;
}
#ai-design-content.markdown-body pre{
  background:#161b22;border:1px solid #30363d;border-radius:6px;
  padding:14px 16px;overflow:auto;margin:0 0 12px;
}
#ai-design-content.markdown-body pre code{
  background:none;padding:0;border-radius:0;font-size:13px;
}
#ai-design-content.markdown-body blockquote{
  border-left:3px solid #3b82f6;padding:4px 16px;margin:0 0 12px;color:#8b949e;
}
#ai-design-content.markdown-body table{
  border-collapse:collapse;margin:0 0 12px;width:100%;
}
#ai-design-content.markdown-body th,#ai-design-content.markdown-body td{
  border:1px solid #30363d;padding:6px 12px;text-align:left;
}
#ai-design-content.markdown-body th{background:#161b22;font-weight:600;color:#e6edf3}
#ai-design-content.markdown-body a{color:#58a6ff;text-decoration:none}
#ai-design-content.markdown-body a:hover{text-decoration:underline}
#ai-design-content.markdown-body strong{color:#e6edf3}
#ai-design-content.markdown-body hr{border:none;border-top:1px solid #21262d;margin:16px 0}
`;  // replaced by build.js with `var __EMBEDDED_CSS__ = "...escaped css..."`

if (typeof __EMBEDDED_CSS__ !== 'undefined') AI.css = __EMBEDDED_CSS__;

export default AI;
export var init = AI.init;
export var destroy = AI.destroy;
export var setTool = AI.setTool;
export var selectElements = AI.selectElements;

