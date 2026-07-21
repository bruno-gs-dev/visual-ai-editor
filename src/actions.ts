import { AI } from './core.js';

AI.showDesignModal = function(){
  var content = document.getElementById('ai-design-content');
  content.innerHTML = '<p style="color:#8b949e">' + AI.t('design.loading') + '</p>';
  AI.designOverlay.classList.add('open');
  fetch(AI.apiBase + '/design')
    .then(function(r){ return r.json(); })
    .then(function(data){
      if (!data.exists){
        content.innerHTML = AI.t('design.missing');
        return;
      }
      var md = data.md || AI.t('design.empty');
      content.innerHTML = typeof marked !== 'undefined' ? marked.parse(md) : '<pre>' + md + '</pre>';
    })
    .catch(function(){ content.innerHTML = '<p style="color:#e22718">' + AI.t('design.error') + '</p>'; });
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
    statusEl.textContent = AI.t('status.rate-limit', { seconds: remaining });
    if (remaining <= 0){
      clearInterval(AI.rateLimitTimer);
      AI.rateLimitTimer = null;
      statusEl.className = 'status';
      statusEl.textContent = AI.t('status.rate-limit-over');
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

/** Swap `oldEls` for the elements parsed out of `newHtml`. Returns the new elements array. */
AI._swapElements = function(oldEls, newHtml, isMulti){
  var temp = document.createElement('div');
  temp.innerHTML = newHtml;

  if (isMulti){
    var container = temp.querySelector('[data-ai-multi]') || temp;
    var newChildren = Array.prototype.slice.call(container.children);
    if (newChildren.length !== oldEls.length){
      throw new Error(AI.t('status.count-mismatch', { got: newChildren.length, expected: oldEls.length }));
    }
    var updated = [];
    oldEls.forEach(function(oldEl, i){
      oldEl.replaceWith(newChildren[i]);
      updated.push(newChildren[i]);
    });
    return updated;
  }

  if (temp.children.length !== 1){
    throw new Error(AI.t('status.unexpected-html'));
  }
  var newEl = temp.children[0];
  oldEls[0].replaceWith(newEl);
  return [newEl];
};

AI._refreshSelectionBoxes = function(){
  AI.clearSelBoxes();
  AI.selectedEls.forEach(function(el){
    var box = document.createElement('div');
    box.className = 'ai-sel-box';
    document.body.appendChild(box);
    AI.selBoxEls.push(box);
  });
  AI.updateSelectedBoxes();
  AI.positionPanel();
};

AI.updateUndoRedoButtons = function(){
  var undoBtn = document.getElementById('ai-editor-undo');
  var redoBtn = document.getElementById('ai-editor-redo');
  if (undoBtn) undoBtn.disabled = AI.undoStack.length === 0;
  if (redoBtn) redoBtn.disabled = AI.redoStack.length === 0;
};

/**
 * Apply an already-known HTML result (either fresh from /api/edit, or the
 * `html` payload the server attaches to an off-palette warning so force mode
 * doesn't need a second round trip) and record undo/patch/change history.
 */
AI._commitEdit = function(params){
  var oldEls = AI.selectedEls.slice();
  var isMulti = oldEls.length > 1;
  var newHtml = (params.html || '').trim();

  var beforeParts = oldEls.map(function(el){ return el.outerHTML; });
  var newEls = AI._swapElements(oldEls, newHtml, isMulti);
  var afterParts = newEls.map(function(el){ return el.outerHTML; });

  var patchEntry = beforeParts.map(function(before, i){ return { before: before, after: afterParts[i] }; });
  var changeEntry = {
    source: params.sourceInfo || '',
    selector: params.selector,
    instruction: params.instruction,
    before: beforeParts.join(''),
    after: afterParts.join('')
  };

  AI.undoStack.push({ els: oldEls, newEls: newEls, patches: patchEntry, change: changeEntry });
  AI.redoStack = [];
  AI.patches = AI.patches.concat(patchEntry);
  AI.changes = (AI.changes || []).concat([changeEntry]);

  AI.selectedEls = newEls;
  AI.lastHtml = afterParts.join('');
  AI._refreshSelectionBoxes();
  AI.updateUndoRedoButtons();

  if (typeof AI.onAfterApply === 'function'){
    try { AI.onAfterApply(newEls.slice()); } catch (e) { /* consumer's problem */ }
  }
};

AI.applyWithAI = function(force){
  if (!AI.selectedEls.length || AI.pending) return;
  var instructionEl = document.getElementById('ai-editor-instruction');
  var statusEl = document.getElementById('ai-editor-status');
  var instruction = (force === true) ? AI.lastInstruction : instructionEl.value.trim();
  var isMulti = AI.selectedEls.length > 1;

  var selector, html;
  if (isMulti){
    selector = AI.selectedEls.length + ' elements';
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
      statusEl.textContent = AI.t('status.empty-instruction');
      return;
    }
    AI.lastInstruction = instruction;
    AI.lastSelector = selector;
    AI.lastHtml = html;
    AI.lastSourceInfo = AI.selectedEls.length === 1 ? AI.getSourceInfo(AI.selectedEls[0]) : '';
    AI.pendingForceHtml = '';
  }

  if (html.length > AI.maxHtmlSize){
    statusEl.style.color = '#e22718';
    statusEl.className = 'status';
    statusEl.textContent = AI.t('status.too-large', { size: html.length, limit: AI.maxHtmlSize });
    return;
  }

  // Off-palette warnings come back with the already-computed `html` attached —
  // forcing just applies it locally, zero extra tokens / no second request.
  if (force && AI.pendingForceHtml){
    try {
      AI._commitEdit({
        html: AI.pendingForceHtml,
        selector: selector,
        instruction: instruction,
        sourceInfo: AI.lastSourceInfo
      });
      instructionEl.value = '';
      statusEl.style.color = '#0fa336';
      statusEl.className = 'status';
      statusEl.textContent = AI.t('status.applied');
    } catch (err) {
      statusEl.style.color = '#e22718';
      statusEl.className = 'status';
      statusEl.textContent = err.message || AI.t('status.apply-error');
    }
    AI.pendingForceHtml = '';
    return;
  }

  var applyBtn = document.getElementById('ai-editor-apply');
  AI.pending = true;
  applyBtn.disabled = true;
  statusEl.style.color = '#7e7e7e';
  statusEl.className = 'status';
  statusEl.textContent = AI.t('status.applying');

  var css = AI.collectCssContext(AI.selectedEls);

  fetch(AI.apiBase + '/edit', {
    method: 'POST',
    headers: AI.authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ html: html, instruction: instruction, selector: selector, css: css, force: !!force })
  })
    .then(function(r){
      return r.text().then(function(raw){
        var data;
        try { data = raw ? JSON.parse(raw) : {}; }
        catch (e) { data = { error: AI.t('status.unexpected-response', { status: r.status, body: raw.slice(0, 200) }) }; }
        return { status: r.status, data: data };
      });
    })
    .then(function(res){
      if (res.status === 429 && res.data.retryAfter){
        AI.startRateLimitCountdown(res.data.retryAfter);
        return;
      }
      if (res.status >= 400) throw new Error(res.data && res.data.error ? res.data.error : AI.t('status.apply-error'));

      if (res.data.warn){
        AI.pendingForceHtml = res.data.html || '';
        statusEl.className = 'status warn';
        statusEl.innerHTML = '⚠ ' + res.data.warn +
          '<br><button class="btn-force" id="ai-editor-force">' + AI.t('force.button') + '</button>';
        document.getElementById('ai-editor-force').addEventListener('click', function(){ AI.applyWithAI(true); });
        return;
      }

      AI._commitEdit({
        html: res.data.html,
        selector: selector,
        instruction: instruction,
        sourceInfo: AI.lastSourceInfo
      });
      instructionEl.value = '';
      statusEl.style.color = '#0fa336';
      statusEl.className = 'status';
      statusEl.textContent = AI.t('status.applied');
    })
    .catch(function(err){
      statusEl.style.color = '#e22718';
      statusEl.className = 'status';
      statusEl.textContent = err.message || AI.t('status.apply-error');
    })
    .finally(function(){
      AI.pending = false;
      applyBtn.disabled = false;
    });
};

/**
 * Persist recorded edits. Static/server-rendered pages: surgical patches
 * against the source file (falls back to a full snapshot only if a patch
 * can't be located). Framework pages (React/Vue source detected on any
 * recorded change): exported as a handoff manifest instead — writing the
 * rendered DOM back over JSX/templates would be wrong.
 */
AI.saveToFile = function(){
  var statusEl = document.getElementById('ai-editor-status');
  var saveBtn = document.getElementById('ai-editor-save');
  saveBtn.disabled = true;
  statusEl.style.color = '#7e7e7e';
  statusEl.className = 'status';
  statusEl.textContent = AI.t('status.saving');

  var changes = AI.changes || [];
  var hasFrameworkSource = changes.some(function(c){ return c.source; });

  var request = hasFrameworkSource
    ? fetch(AI.apiBase + '/handoff', {
        method: 'POST',
        headers: AI.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ changes: changes })
      }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
      .then(function(res){
        if (!res.ok) throw new Error(res.data.error || AI.t('status.save-error'));
        statusEl.style.color = '#0fa336';
        statusEl.className = 'status';
        statusEl.textContent = AI.t('status.handoff', { count: res.data.count });
      })
    : (function(){
        var clone = document.documentElement.cloneNode(true);
        clone.querySelectorAll(
          '#ai-toolbar,#ai-editor-hover-box,#ai-editor-selected-box,#ai-editor-tag-label,' +
          '#ai-editor-panel,#ai-design-overlay,#ai-draw-overlay,.ai-sel-box,#ai-selection-label'
        ).forEach(function(el){ el.remove(); });
        var fullHtml = '<!DOCTYPE html>\n' + clone.outerHTML;

        return fetch(AI.apiBase + '/save', {
          method: 'POST',
          headers: AI.authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ html: fullHtml, page: location.pathname, patches: AI.patches })
        })
          .then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
          .then(function(res){
            if (!res.ok) throw new Error(res.data.error || AI.t('status.save-error'));
            statusEl.style.color = '#0fa336';
            statusEl.className = 'status';
            if (res.data.mode === 'patch'){
              statusEl.textContent = AI.t('status.saved-patch', { applied: res.data.applied });
            } else if (res.data.failedPatches && res.data.failedPatches.length){
              statusEl.textContent = AI.t('status.saved-full');
            } else {
              statusEl.textContent = AI.t('status.saved', { path: res.data.path });
            }
            AI.patches = [];
          });
      })();

  request
    .catch(function(err){
      statusEl.style.color = '#e22718';
      statusEl.className = 'status';
      statusEl.textContent = err.message || AI.t('status.save-error');
    })
    .finally(function(){
      saveBtn.disabled = false;
    });
};

AI.undoLast = function(){
  if (!AI.undoStack.length) return;
  var entry = AI.undoStack.pop();
  var statusEl = document.getElementById('ai-editor-status');

  AI.lastHtml = '';
  AI.lastSelector = '';
  AI.lastInstruction = '';

  var currentEls = entry.newEls.slice();
  currentEls.forEach(function(el, i){
    var target = entry.els[i];
    if (target) el.replaceWith(target);
  });
  AI.selectedEls = entry.els;

  if (entry.patches.length){
    AI.patches = AI.patches.slice(0, AI.patches.length - entry.patches.length);
  }
  if (AI.changes && AI.changes.length) AI.changes = AI.changes.slice(0, -1);
  AI.redoStack.push(entry);

  AI._refreshSelectionBoxes();
  AI.panel.classList.add('open');
  AI.updateUndoRedoButtons();

  if (typeof AI.onAfterUndo === 'function'){
    try { AI.onAfterUndo(AI.selectedEls.slice()); } catch (e) { /* consumer's problem */ }
  }

  statusEl.style.color = '#0fa336';
  statusEl.className = 'status';
  statusEl.textContent = AI.t('status.undone');
};

AI.redoLast = function(){
  if (!AI.redoStack.length) return;
  var entry = AI.redoStack.pop();
  var statusEl = document.getElementById('ai-editor-status');

  var currentEls = entry.els.slice();
  currentEls.forEach(function(el, i){
    var target = entry.newEls[i];
    if (target) el.replaceWith(target);
  });
  AI.selectedEls = entry.newEls;

  AI.patches = AI.patches.concat(entry.patches);
  if (entry.change) AI.changes = (AI.changes || []).concat([entry.change]);
  AI.undoStack.push(entry);

  AI._refreshSelectionBoxes();
  AI.panel.classList.add('open');
  AI.updateUndoRedoButtons();

  if (typeof AI.onAfterApply === 'function'){
    try { AI.onAfterApply(AI.selectedEls.slice()); } catch (e) { /* consumer's problem */ }
  }

  statusEl.style.color = '#0fa336';
  statusEl.className = 'status';
  statusEl.textContent = AI.t('status.redone');
};
