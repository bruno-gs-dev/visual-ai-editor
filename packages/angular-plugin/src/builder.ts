import { BuilderContext, BuilderOutput, createBuilder } from '@angular-devkit/architect';
import { JsonObject, experimental } from '@angular-devkit/core';
import * as path from 'path';
import * as fs from 'fs';
import { transformTemplate, SourceTagOptions } from './transformer';

interface AngularPluginOptions extends JsonObject {
  browserTarget: string;
  sourceMap?: boolean;
  port?: number;
  [key: string]: unknown;
}

/**
 * Resolve the target builder from @angular-devkit/build-angular.
 * We delegate all actual compilation to the original Angular CLI builders.
 */
function resolveAngularBuilder(targetBuilder: string) {
  // Map our builder name back to the original @angular-devkit/build-angular builder
  return targetBuilder.replace(/^@ai-editor\/angular-plugin:/, '@angular-devkit/build-angular:');
}

/**
 * Find all component files (.ts) in the project source and extract template info.
 * Returns a map of template file path → component file path.
 */
function findComponentTemplates(
  root: string,
  projectSourceRoot: string
): Array<{ templateFile: string; componentFile: string; componentSource: string }> {
  const components: Array<{ templateFile: string; componentFile: string; componentSource: string }> = [];
  const sourceRoot = path.join(root, projectSourceRoot || 'src');

  if (!fs.existsSync(sourceRoot)) return components;

  function walkDir(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        walkDir(fullPath);
      } else if (entry.isFile() && /\.component\.ts$/i.test(entry.name)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const relPath = path.relative(root, fullPath).replace(/\\/g, '/');

        const templateUrlMatch = content.match(/templateUrl\s*:\s*['"]([^'"]+)['"]/);
        const inlineTemplateMatch = content.match(/template\s*:\s*`([\s\S]*?)`/);

        if (templateUrlMatch) {
          const templateFile = path.resolve(path.dirname(fullPath), templateUrlMatch[1]);
          if (fs.existsSync(templateFile)) {
            components.push({
              templateFile: templateFile,
              componentFile: relPath,
              componentSource: content,
            });
          }
        } else if (inlineTemplateMatch) {
          // Inline template — extract line number
          const lineNum = content.split('\n').findIndex(line => line.includes('template:')) + 1;
          // Write inline template to a temp file for the transformer
          const templateDir = path.join(root, '.ai-editor', 'angular-templates');
          fs.mkdirSync(templateDir, { recursive: true });
          const tempFile = path.join(templateDir, relPath.replace(/\//g, '_') + '.html');
          fs.writeFileSync(tempFile, inlineTemplateMatch[1], 'utf8');
          components.push({
            templateFile: tempFile,
            componentFile: relPath,
            componentSource: content,
          });
        }
      }
    }
  }

  walkDir(sourceRoot);
  return components;
}

/**
 * Transform all component templates in the project to inject data-ai-source.
 */
function transformProjectTemplates(
  root: string,
  projectSourceRoot: string
): number {
  const components = findComponentTemplates(root, projectSourceRoot);
  let totalTagged = 0;

  for (const comp of components) {
    try {
      const templateHtml = fs.readFileSync(comp.templateFile, 'utf8');
      const result = transformTemplate(templateHtml, {
        componentPath: comp.componentFile,
        templateLine: 1,
      });
      fs.writeFileSync(comp.templateFile, result.html, 'utf8');
      totalTagged += result.tagged;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[ai-editor] Warning: could not transform template for ${comp.componentFile}: ${message}`);
    }
  }

  return totalTagged;
}

export default createBuilder<AngularPluginOptions>(async (
  options: AngularPluginOptions,
  context: BuilderContext
): Promise<BuilderOutput> => {
  const target = context.target;
  const project = (await context.getProjectMetadata(target?.project || '')).toJSON() as Record<string, unknown> | null;
  const root = project?.root
    ? path.resolve(context.workspaceRoot, project.root as string)
    : context.workspaceRoot;

  const projectSourceRoot = (project?.sourceRoot as string) || (project?.root ? path.join(project.root as string, 'src') : 'src');
  const sourceRoot = path.resolve(context.workspaceRoot, projectSourceRoot);

  const isDev = context.builder.builderName.includes('dev-server');

  if (isDev) {
    context.logger.info('[ai-editor] Injecting data-ai-source attributes into Angular component templates...');
    const tagged = transformProjectTemplates(context.workspaceRoot, path.relative(context.workspaceRoot, sourceRoot));
    context.logger.info(`[ai-editor] Tagged ${tagged} elements with data-ai-source`);
  }

  // Delegate to the real Angular CLI builder
  const originalBuilderName = resolveAngularBuilder(context.builder.builderName);
  const originalBuilder = await context.scheduleBuilder(originalBuilderName, options as JsonObject);

  return new Promise<BuilderOutput>((resolve, reject) => {
    originalBuilder.output.subscribe({
      next: (output: BuilderOutput) => {
        if (output.success === false) {
          reject(new Error('Angular build failed'));
        }
      },
      error: reject,
      complete: () => resolve({ success: true }),
    });
  });
});
