/**
 * @ai-editor/angular-plugin
 *
 * Angular CLI builder that injects `data-ai-source` attributes into
 * component templates during `ng serve`, enabling visual-ai-editor
 * to map DOM edits back to source files.
 *
 * ## Usage
 *
 * In angular.json, replace the default Angular builders with these:
 *
 * ```json
 * {
 *   "projects": {
 *     "your-app": {
 *       "architect": {
 *         "build": {
 *           "builder": "@ai-editor/angular-plugin:browser",
 *           ...
 *         },
 *         "serve": {
 *           "builder": "@ai-editor/angular-plugin:dev-server",
 *           ...
 *         }
 *       }
 *     }
 *   }
 * }
 * ```
 *
 * During `ng serve`, every element in your component templates will
 * be tagged with `data-ai-source="component.ts:line"`, which the
 * visual-ai-editor client detects in `getSourceInfo()` as its
 * highest-priority source-location mechanism.
 */

export { transformTemplate, injectSourceAttributesToHtml, SourceTagOptions, TransformResult } from './transformer';
export { default as builder } from './builder';
