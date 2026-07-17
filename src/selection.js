import { AI } from './core.js';

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
  AI.lastHtml = '';
  AI.lastSelector = '';
  AI.lastInstruction = '';
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
