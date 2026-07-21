import { parseTemplate, TmplAstElement, TmplAstNode, TmplAstTemplate } from '@angular/compiler';

export interface SourceTagOptions {
  /** Path to the component file, relative to the project root */
  componentPath: string;
  /** Line number where the template starts in the source file */
  templateLine: number;
}

export interface TransformResult {
  html: string;
  tagged: number;
}

function sourceAttribute(path: string, line: number): string {
  return ` data-ai-source="${path}:${line}"`;
}

function attributeExists(el: TmplAstElement, name: string): boolean {
  return el.attrs.some(a => a.name === name) ||
    el.inputs.some(i => i.name === name) ||
    el.outputs.some(o => o.name === name);
}

function isElementNode(node: TmplAstNode): node is TmplAstElement {
  return node instanceof TmplAstElement;
}

function isTemplateNode(node: TmplAstNode): node is TmplAstTemplate {
  return node instanceof TmplAstTemplate;
}

/**
 * Walk the Angular template AST and inject data-ai-source into every
 * element that doesn't already have it. Skips structural directives
 * (*ngIf, *ngFor, etc.) on the host element itself — those are
 * Template nodes, not Element nodes, in the Angular AST.
 */
function injectSourceAttributes(
  nodes: TmplAstNode[],
  path: string,
  sourceLine: number,
  parentLine?: number
): { nodes: TmplAstNode[]; tagged: number } {
  let tagged = 0;

  function walk(node: TmplAstNode, line: number): TmplAstNode {
    if (isElementNode(node)) {
      let el = node;
      if (!attributeExists(el, 'data-ai-source')) {
        const attrLine = line;
        el = new TmplAstElement(
          el.name,
          [
            ...el.attrs,
            {
              name: 'data-ai-source',
              value: `${path}:${attrLine}`,
              sourceSpan: el.sourceSpan,
              keySpan: el.startSourceSpan,
              valueSpan: undefined,
              i18n: undefined,
            }
          ],
          el.inputs,
          el.outputs,
          el.references,
          el.children.map(c => walk(c, line)),
          el.references,
          el.sourceSpan,
          el.startSourceSpan,
          el.endSourceSpan,
          el.i18n
        );
        tagged++;
      } else {
        el = new TmplAstElement(
          el.name,
          el.attrs,
          el.inputs,
          el.outputs,
          el.references,
          el.children.map(c => walk(c, line)),
          el.references,
          el.sourceSpan,
          el.startSourceSpan,
          el.endSourceSpan,
          el.i18n
        );
      }
      return el;
    }

    if (isTemplateNode(node)) {
      return new TmplAstTemplate(
        node.tagName,
        node.attributes,
        node.inputs,
        node.outputs,
        node.templateAttrs,
        node.children.map(c => walk(c, line)),
        node.references,
        node.variables,
        node.sourceSpan,
        node.startSourceSpan,
        node.endSourceSpan,
        node.i18n
      );
    }

    return node;
  }

  const result = nodes.map(n => walk(n, parentLine || sourceLine));
  return { nodes: result, tagged };
}

/**
 * Parse, tag, and serialize an Angular component template.
 * Returns the modified HTML and the count of elements tagged.
 */
export function transformTemplate(
  templateHtml: string,
  options: SourceTagOptions
): TransformResult {
  const parsed = parseTemplate(templateHtml, options.componentPath, {
    preserveWhitespaces: true,
    preserveSignificantWhitespace: true,
  });

  if (parsed.errors && parsed.errors.length > 0) {
    throw new Error(
      `Template parse errors in ${options.componentPath}: ` +
      parsed.errors.map(e => e.msg).join('; ')
    );
  }

  const result = injectSourceAttributes(
    parsed.nodes,
    options.componentPath,
    options.templateLine
  );

  // Reconstruct HTML from the modified AST nodes.
  // This is a best-effort serialization — we rebuild the structure,
  // preserving the original template's character content while adding
  // the data-ai-source attributes.
  return {
    html: reconstructHtml(result.nodes, templateHtml),
    tagged: result.tagged,
  };
}

function reconstructHtml(nodes: TmplAstNode[], originalHtml: string): string {
  const parts: string[] = [];

  function appendAttribute(name: string, value: string): void {
    parts.push(` ${name}="${value}"`);
  }

  function serializeNode(node: TmplAstNode): void {
    if (isElementNode(node)) {
      const el = node as TmplAstElement;
      let tag = el.name;

      const attrParts: string[] = [];
      for (const attr of el.attrs) {
        if (attr.name === 'data-ai-source') {
          appendAttribute.bind(null, attr.name, attr.value)();
        } else {
          attrParts.push(` ${attr.name}="${attr.value}"`);
        }
      }
      for (const input of el.inputs) {
        attrParts.push(` [${input.name}]="${input.value}"`);
      }
      for (const output of el.outputs) {
        attrParts.push(` (${output.name})="${output.value}"`);
      }

      parts.push(`<${tag}`);
      if (el.attrs.some(a => a.name === 'data-ai-source')) {
        const src = el.attrs.find(a => a.name === 'data-ai-source')!;
        parts.push(` data-ai-source="${src.value}"`);
      }
      parts.push(attrParts.join(''));

      if (el.children.length === 0 && /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i.test(tag)) {
        parts.push(' />');
        return;
      }

      parts.push('>');
      for (const child of el.children) {
        serializeNode(child);
      }
      parts.push(`</${tag}>`);
    } else {
      parts.push(node.sourceSpan?.toString() || '');
    }
  }

  for (const node of nodes) {
    serializeNode(node);
  }

  return parts.join('');
}

/**
 * Low-level helper: given a raw template HTML string, inject
 * data-ai-source attributes into every element.
 * This is the public API consumers call programmatically.
 */
export function injectSourceAttributesToHtml(
  html: string,
  componentPath: string,
  templateLine?: number
): TransformResult {
  return transformTemplate(html, {
    componentPath,
    templateLine: templateLine || 0,
  });
}
