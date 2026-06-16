/**
 * Editor deep-linking for the "Open in editor" feature.
 *
 * Mirrors kahoot-frontend's `editorUrlTarget` (open-in-editor.ts): given a source location
 * (a "file:line:col" string produced by the build-time source tagging) it returns a URL whose
 * custom scheme the OS hands off to the configured editor.
 */
export type EditorName = 'vscode' | 'vscode-insiders' | 'cursor' | 'webstorm';

// TODO: make this user-configurable from the panel (persisted in localStorage), mirroring
// kahoot-frontend's DEV_IDE. Defaulting to VSCode for now.
export const DEFAULT_EDITOR: EditorName = 'vscode';

/**
 * Build a deep-link URL that opens `source` in `editor`.
 * @param source A "file:line:col" string (line/col optional). Path must be absolute.
 * @returns The URL, or undefined if `source` is empty or the editor is unknown.
 */
export function buildEditorUrl(editor: EditorName, source: string): string | undefined {
  if (!source) return undefined;

  // WebStorm cannot jump to a specific line via URL: https://youtrack.jetbrains.com/issue/TBX-3478
  if (editor === 'webstorm') {
    const fileName = source.split(':')[0];
    return `webstorm://open?file=${fileName}`;
  }

  // vscode / cursor accept `file/<path>:<line>:<col>` directly.
  switch (editor) {
    case 'vscode':
      return `vscode://file/${source}`;
    case 'vscode-insiders':
      return `vscode-insiders://file/${source}`;
    case 'cursor':
      return `cursor://file/${source}`;
    default:
      return undefined;
  }
}
