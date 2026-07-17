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
