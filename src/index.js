import { AI } from './core.js';
import './tools.js';
import './selection.js';
import './actions.js';
import './ui.js';
// __INJECT_CSS__  // replaced by build.js with `var __EMBEDDED_CSS__ = "...escaped css..."`

if (typeof __EMBEDDED_CSS__ !== 'undefined') AI.css = __EMBEDDED_CSS__;

export default AI;
export var init = AI.init;
export var destroy = AI.destroy;
export var setTool = AI.setTool;
export var selectElements = AI.selectElements;
