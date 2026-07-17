// Type definitions for visual-ai-editor (client)

export type SelectionTool = 'cursor' | 'area' | 'pencil';

export interface InitOptions {
  /** Base URL for backend endpoints. Default: '/api' */
  apiBase?: string;
  /** Sent as "Authorization: Bearer <token>" on write endpoints. Must match the server's apiToken. */
  apiToken?: string;
  /** Auto-inject CSS into <head>. Default: true */
  cssInject?: boolean;
  /** Custom CSS URL when injecting. Default: 'dist/ai-editor.css' */
  cssUrl?: string;
  /** UI locale. 'en' (default) or 'pt-BR'. Falls back to <html lang> when omitted. */
  locale?: 'en' | 'pt-BR' | string;
  /** Reject selections whose serialized HTML exceeds this many characters. Default: 60000 */
  maxHtmlSize?: number;
  /**
   * Called after a DOM swap (AI edit applied, or redo). Use this to rebind
   * event listeners on the replaced elements in frameworks/vanilla pages that
   * attach listeners outside a framework's own reactivity system.
   */
  onAfterApply?: (elements: HTMLElement[]) => void;
  /** Called after an undo restores the previous elements. */
  onAfterUndo?: (elements: HTMLElement[]) => void;
}

export interface AIEditorAPI {
  init(options?: InitOptions): void;
  destroy(): void;
  setTool(tool: SelectionTool): void;
  selectElements(elements: HTMLElement[]): void;
}

declare const AIEditor: AIEditorAPI;

export default AIEditor;
export function init(options?: InitOptions): void;
export function destroy(): void;
export function setTool(tool: SelectionTool): void;
export function selectElements(elements: HTMLElement[]): void;
