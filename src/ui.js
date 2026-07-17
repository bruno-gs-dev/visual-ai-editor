import { AI } from './core.js';

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
