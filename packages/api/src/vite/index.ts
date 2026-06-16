import { parse } from '@babel/parser';
import type { ParserPlugin } from '@babel/parser';
import _traverse from '@babel/traverse';
// Explicit .js: launch-editor has no `exports` map, so Node ESM needs the extension at runtime.
import _guess from 'launch-editor/guess.js';
import MagicString from 'magic-string';
import type { Plugin } from 'vite';

// These deps are CJS; their real function lives on `.default` under ESM interop.
const traverse = ((_traverse as unknown as { default?: typeof _traverse }).default ?? _traverse) as typeof _traverse;
const guess = ((_guess as unknown as { default?: typeof _guess }).default ?? _guess) as typeof _guess;

export interface PixiDevtoolsSourceOptions {
  /**
   * The property injected onto each class to carry its "file:line:col" location.
   * Must match what the devtools backend reads (see scene/tree/tree.ts `getNodeSource`).
   * @default '__devtoolSource'
   */
  property?: string;
  /**
   * The editor to open files in (a launch-editor command, e.g. 'code', 'code-insiders',
   * 'webstorm', 'cursor'). Defaults to `process.env.EDITOR_SHORTCUT_NAME`, then to the running
   * editor detected by `launch-editor/guess`, then to VSCode in the panel.
   */
  editor?: string;
}

/** Resolve the editor command, mirroring kahoot-frontend's DEV_IDE (env override, else guess). */
function detectEditor(explicit?: string): string | undefined {
  if (explicit) return explicit;
  if (process.env.EDITOR_SHORTCUT_NAME) return process.env.EDITOR_SHORTCUT_NAME;
  try {
    return guess()?.[0] ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Vite plugin for the devtools "Open in editor" feature.
 *
 * It tags every named class with the source location of its definition, e.g. it appends
 * `MyClass.__devtoolSource = "/abs/path/MyClass.ts:12:1";` after the class. The devtools panel
 * then reads `node.constructor.__devtoolSource` to open the class in your editor.
 *
 * Dev-only (`apply: 'serve'`): the absolute path it injects is the local source path, which only
 * makes sense on the machine running the dev server. Parse failures are warned and skipped, so the
 * plugin can never break a build.
 *
 * @example
 * // vite.config.ts
 * import { pixiDevtoolsSource } from '@kahoot/pixi-devtools/vite';
 * export default defineConfig({ plugins: [pixiDevtoolsSource()] });
 */
export function pixiDevtoolsSource(options: PixiDevtoolsSourceOptions = {}): Plugin {
  const property = options.property ?? '__devtoolSource';
  let editor: string | undefined | null = null; // null = not resolved yet (resolve lazily, once)

  return {
    name: 'pixi-devtools-source',
    apply: 'serve',
    // Run before Vite's esbuild strips TS/JSX, so line/column map to the original source.
    enforce: 'pre',
    // Expose the chosen editor to the page so the devtools panel can build the right deep-link.
    transformIndexHtml() {
      if (editor === null) editor = detectEditor(options.editor);
      if (!editor) return;
      return [
        {
          tag: 'script',
          injectTo: 'head-prepend',
          children: `window.__PIXI_DEVTOOLS_EDITOR__ = ${JSON.stringify(editor)};`,
        },
      ];
    },
    transform(code, id) {
      const file = id.split('?')[0];

      if (file.includes('/node_modules/')) return null;
      if (!/\.[cm]?[jt]sx?$/.test(file)) return null;
      // Cheap bail-out: nothing to tag if there are no classes.
      if (!code.includes('class ')) return null;

      const plugins: ParserPlugin[] = ['decorators-legacy'];
      if (/\.[cm]?tsx?$/.test(file)) plugins.push('typescript');
      if (/\.(tsx|jsx)$/.test(file)) plugins.push('jsx');

      let ast;
      try {
        ast = parse(code, { sourceType: 'module', plugins });
      } catch (err) {
        // Never break the build over a file we can't parse; just skip it.
        this.warn(`[pixi-devtools-source] Skipping ${file}: ${(err as Error).message}`);
        return null;
      }

      const s = new MagicString(code);
      let tagged = false;

      // Inject a static field at the top of the class body, e.g. `static __devtoolSource = "..."`.
      // A static member lives on the constructor (which is what the backend reads) and needs no
      // name binding, so this handles every class shape uniformly: declarations, named/anonymous
      // default exports, `const X = class {}` expressions, and classes returned from mixins.
      const tagClass = (path: { node: import('@babel/types').Class }) => {
        const node = path.node;
        const bodyStart = node.body.start;
        const loc = node.loc?.start;
        if (bodyStart == null || !loc) return;

        // Babel columns are 0-based; editors expect 1-based.
        const source = `${file}:${loc.line}:${loc.column + 1}`;
        s.appendRight(bodyStart + 1, ` static ${property} = ${JSON.stringify(source)};`);
        tagged = true;
      };

      traverse(ast, {
        ClassDeclaration: tagClass,
        ClassExpression: tagClass,
      });

      if (!tagged) return null;

      return { code: s.toString(), map: s.generateMap({ hires: true }) };
    },
  };
}
