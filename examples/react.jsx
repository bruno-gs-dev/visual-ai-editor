import { useEffect } from 'react';
import AIEditor from 'visual-ai-editor';
import 'visual-ai-editor/dist/ai-editor.css';

/**
 * React component that wraps the visual-ai-editor.
 *
 * Usage:
 *   import { AIEditorComponent } from './AIEditor';
 *   function App() { return <><AIEditorComponent apiBase="/api" /><div>...</div></>; }
 */
export function AIEditorComponent({ apiBase = '/api', cssUrl }) {
  useEffect(() => {
    AIEditor.init({ apiBase, cssUrl });
    return () => {
      AIEditor.destroy();
    };
  }, [apiBase, cssUrl]);

  return null; // Editor is injected into document.body
}

export default AIEditor;
