/**
 * Editor deep-linking for the "Open in editor" feature.
 *
 * Mirrors kahoot-frontend's `editorUrlTarget` (open-in-editor.ts): given a source location
 * (a "file:line:col" string produced by the build-time source tagging) it returns a URL whose
 * custom scheme the OS hands off to the configured editor.
 *
 * `editor` is a launch-editor command (e.g. 'code', 'code-insiders', 'webstorm', 'cursor'), as
 * resolved and injected into the page by the @pixi/devtools/vite plugin. Falls back to VSCode.
 */
export function buildEditorUrl(editor: string | undefined, source: string): string | undefined {
  if (!source) return undefined;

  const ide = (editor || 'code').toLowerCase();
  const fileName = source.split(':')[0];

  // WebStorm cannot jump to a specific line via URL: https://youtrack.jetbrains.com/issue/TBX-3478
  if (ide.includes('webstorm')) return `webstorm://open?file=${fileName}`;
  if (ide.includes('cursor')) return `cursor://file/${source}`;
  if (ide.includes('insider')) return `vscode-insiders://file/${source}`;

  // Default to VSCode (covers 'code' and any unrecognized editor).
  return `vscode://file/${source}`;
}
