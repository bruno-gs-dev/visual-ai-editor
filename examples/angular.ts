/**
 * visual-ai-editor — Angular integration (simplest setup)
 *
 * The server now accepts cross-origin requests from localhost:* (v1.7.0+),
 * so no proxy needed. Just init with the server URL directly.
 *
 * For source mapping (optional), see @ai-editor/angular-plugin.
 */

import { Component, OnInit, OnDestroy } from '@angular/core';
import { environment } from '../environments/environment';
import AIEditor from 'visual-ai-editor';

@Component({
  selector: 'app-root',
  template: '<router-outlet></router-outlet>'
})
export class AppComponent implements OnInit, OnDestroy {
  ngOnInit() {
    if (!environment.production) {
      AIEditor.init({ apiBase: 'http://localhost:3000' });
    }
  }
  ngOnDestroy() {
    AIEditor.destroy();
  }
}
