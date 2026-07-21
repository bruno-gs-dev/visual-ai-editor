/**
 * visual-ai-editor — Angular integration example
 *
 * See README.md for the full setup (proxy.conf.json, environment guard,
 * optional @ai-editor/angular-plugin for source mapping).
 *
 * Quick reference:
 *   1. Create proxy.conf.json:  { "/api": { "target": "http://localhost:3000", "secure": false } }
 *   2. Register proxy in angular.json (serve.proxyConfig)
 *   3. Dynamic import guarded by environment.production
 *   4. Use a singleton service (AiEditorService) wired once in AppComponent
 */

import { Injectable, OnDestroy } from '@angular/core';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class AiEditorService implements OnDestroy {
  private editor: any = null;

  initIfDev() {
    if (environment.production) return;
    import('visual-ai-editor').then(({ default: AI }) => {
      AI.init({ apiBase: '/api' });
      this.editor = AI;
    });
  }

  ngOnDestroy() {
    if (this.editor) {
      import('visual-ai-editor').then(({ default: AI }) => AI.destroy());
      this.editor = null;
    }
  }
}
