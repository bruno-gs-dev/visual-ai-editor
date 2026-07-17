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
  pendingForceHtml: '',   // off-palette result held back by the server; applied locally on "force"
  lastSourceInfo: '',
  undoStack: [],          // [{ els, newEls, patches, change }]
  redoStack: [],
  patches: [],            // [{ before, after }] — sent to /api/save for surgical patching
  changes: [],            // [{ source, selector, instruction, before, after }] — sent to /api/handoff

  apiBase: '/api',
  apiToken: '',
  locale: 'en',
  maxHtmlSize: 60000,
  onAfterApply: null,     // callback(els) — rebind page event listeners after a DOM swap
  onAfterUndo: null,      // callback(els)
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
  },

  /**
   * Best-effort source location ("file:line") for an element, so framework
   * edits can be handed off to an AI coding agent with a real target.
   *   1. data-ai-source attribute (set manually or by a build plugin)
   *   2. React dev builds ≤18: fiber._debugSource ({ fileName, lineNumber })
   *   3. Vue 3 dev builds: __vueParentComponent.type.__file
   */
  getSourceInfo: function(el){
    try {
      var tagged = el.closest && el.closest('[data-ai-source]');
      if (tagged) return tagged.getAttribute('data-ai-source');

      for (var key in el){
        if (key.indexOf('__reactFiber$') === 0){
          var fiber = el[key];
          while (fiber){
            var src = fiber._debugSource;
            if (src && src.fileName){
              return src.fileName + (src.lineNumber ? ':' + src.lineNumber : '');
            }
            fiber = fiber.return;
          }
          break;
        }
      }

      var node = el;
      while (node){
        var comp = node.__vueParentComponent;
        if (comp && comp.type && comp.type.__file) return comp.type.__file;
        node = node.parentElement;
      }
    } catch (e) { /* detection is best-effort only */ }
    return '';
  },

  /**
   * Collect the CSS rules that currently apply to the selected elements (and
   * a sample of their descendants), so the LLM knows what existing classes do.
   * Same-origin stylesheets only; capped; failures return ''.
   */
  collectCssContext: function(els){
    var MAX_CHARS = 8000;
    var MAX_DESCENDANTS = 40;
    try {
      var targets = [];
      els.forEach(function(el){
        targets.push(el);
        var kids = el.querySelectorAll('*');
        for (var i = 0; i < kids.length && i < MAX_DESCENDANTS; i++) targets.push(kids[i]);
      });

      var seen = {};
      var out = [];
      var total = 0;

      function matchesAny(selector){
        var clean = selector.replace(/::?[a-zA-Z-]+(\([^)]*\))?/g, '') || selector;
        for (var i = 0; i < targets.length; i++){
          try { if (targets[i].matches(clean)) return true; } catch (e) { /* invalid after strip */ }
        }
        return false;
      }

      for (var s = 0; s < document.styleSheets.length && total < MAX_CHARS; s++){
        var rules;
        try { rules = document.styleSheets[s].cssRules; } catch (e) { continue; } // cross-origin
        if (!rules) continue;
        for (var r = 0; r < rules.length && total < MAX_CHARS; r++){
          var rule = rules[r];
          if (!rule.selectorText || !rule.cssText) continue;
          if (seen[rule.cssText]) continue;
          var sel = rule.selectorText;
          if (sel === ':root' || sel === 'html' || matchesAny(sel)){
            seen[rule.cssText] = true;
            out.push(rule.cssText);
            total += rule.cssText.length;
          }
        }
      }
      return out.join('\n').slice(0, MAX_CHARS);
    } catch (e) {
      return '';
    }
  }
};
