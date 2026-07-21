export interface SourceTagOptions {
  componentPath: string;
  templateLine: number;
}

export interface TransformResult {
  html: string;
  tagged: number;
}

export function transformTemplate(templateHtml: string, options: SourceTagOptions): TransformResult;
export function injectSourceAttributesToHtml(html: string, componentPath: string, templateLine?: number): TransformResult;
