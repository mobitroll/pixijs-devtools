import { useCallback } from 'react';
import { useDevtoolStore } from '../../../App';
import { buildEditorUrl } from '../../../lib/editor';

/**
 * Returns a function that opens a scene node's source file in the configured editor.
 * Shared by the tree context-menu "Open" item and the keyboard shortcut so both behave identically.
 */
export function useOpenInEditor() {
  const bridge = useDevtoolStore.use.bridge()!;

  return useCallback(
    async (nodeId: string, nodeName?: string) => {
      // Log in the INSPECTED PAGE's console (via the bridge), not the panel's, so the app
      // developer actually sees it in their own devtools console.
      const logToPage = (level: 'warn' | 'error', message: string) =>
        bridge(`console.${level}(${JSON.stringify(message)})`);

      // Ask the backend (running in the page) for the source location tagged onto this node's class.
      const source = await bridge<string | null>(
        `window.__PIXI_DEVTOOLS_WRAPPER__?.scene.tree.getNodeSource(${JSON.stringify(nodeId)})`,
      );

      if (!source) {
        // Tell "the build plugin isn't enabled" apart from "this node is just a built-in class".
        const hasTaggedClasses = await bridge<boolean>(
          `!!window.__PIXI_DEVTOOLS_WRAPPER__?.scene.tree.hasTaggedClasses?.()`,
        );

        const label = nodeName ?? 'the selected node';
        const message = hasTaggedClasses
          ? `[PixiJS DevTools] No source file found for "${label}" or any of its ancestors — ` +
            `"Open" only works for classes defined in your app's source.`
          : `[PixiJS DevTools] "Open in editor" needs source locations, but none were found on the page. ` +
            `Enable the \`pixiDevtoolsSource()\` plugin from \`@pixi/devtools/vite\` in your app's Vite dev config.`;

        logToPage(hasTaggedClasses ? 'warn' : 'error', message);
        return;
      }

      // The editor is injected into the page by the @pixi/devtools/vite plugin; default to VSCode.
      const editor = await bridge<string | null>(`window.__PIXI_DEVTOOLS_EDITOR__ ?? null`);
      const url = buildEditorUrl(editor ?? undefined, source);
      if (!url) {
        logToPage('warn', `[PixiJS DevTools] Could not build an editor URL for "${source}".`);
        return;
      }

      // Open from the PANEL, not via the page bridge: launching an external protocol (vscode://)
      // requires a user gesture, which the click/keypress provides here in the panel. Code eval'd in
      // the inspected page has no gesture, so Chrome blocks it silently on un-granted origins.
      window.open(url, '_blank');
    },
    [bridge],
  );
}
