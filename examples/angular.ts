import { Component, OnInit, OnDestroy } from '@angular/core';
import AIEditor from 'visual-ai-editor';
import 'visual-ai-editor/dist/ai-editor.css';

@Component({
  selector: 'app-root',
  template: `
    <div class="hero">
      <h1>Meu Site</h1>
      <p>Clique nos elementos para editar com IA.</p>
    </div>
  `
})
export class AppComponent implements OnInit, OnDestroy {
  ngOnInit() {
    AIEditor.init({ apiBase: '/api' });
  }

  ngOnDestroy() {
    AIEditor.destroy();
  }
}
