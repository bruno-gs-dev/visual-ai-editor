import { AI } from './core.js';

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
