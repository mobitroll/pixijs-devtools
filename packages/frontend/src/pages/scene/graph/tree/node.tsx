import { useCallback } from 'react';
import type { NodeRendererProps } from 'react-arborist';
import { useDevtoolStore } from '../../../../App';
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '../../../../components/ui/context-menu';
import { ExternalLinkIcon } from '../../../../components/ui/external-link-icon';
import { buildEditorUrl, DEFAULT_EDITOR } from '../../../../lib/editor';
import type { SceneGraphEntry } from '../../../../types';
import { CustomNodeContextMenuItem, NodeContextMenuItem } from './context-menu-button';
import { NodeTrigger } from './node-trigger';

export function Node({ node, style, dragHandle }: NodeRendererProps<SceneGraphEntry>) {
  const bridge = useDevtoolStore.use.bridge()!;

  const onToggle = useCallback(() => {
    node.isInternal && node.toggle();
  }, [node]);

  const onSelected = useCallback(() => {
    node.tree.select(node);
  }, [node]);

  const onDeleted = useCallback(() => {
    if (!node.parent || node.data.metadata.locked) return;
    node.tree.delete(node);
  }, [node]);

  const onRename = useCallback(() => {
    setTimeout(() => {
      if (node.data.metadata.locked) return;
      node.tree.edit(node);
    }, 200);
  }, [node]);

  const onOpenInEditor = useCallback(async () => {
    const logToPage = (level: 'warn' | 'error', message: string) =>
      bridge(`console.${level}(${JSON.stringify(message)})`);

    // Ask the backend (running in the page) for the source location tagged onto this node's class.
    const source = await bridge<string | null>(
      `window.__PIXI_DEVTOOLS_WRAPPER__?.scene.tree.getNodeSource(${JSON.stringify(node.id)})`,
    );

    if (!source) {
      // Tell "the build plugin isn't enabled" apart from "this node is just a built-in class".
      const hasTaggedClasses = await bridge<boolean>(
        `!!window.__PIXI_DEVTOOLS_WRAPPER__?.scene.tree.hasTaggedClasses?.()`,
      );

      const message = hasTaggedClasses
        ? `[PixiJS DevTools] No source file found for "${node.data.name}" or any of its ancestors — ` +
          `"Open" only works for classes defined in your app's source.`
        : `[PixiJS DevTools] "Open in editor" needs source locations, but none were found on the page. ` +
          `Enable the \`pixiDevtoolsSource()\` plugin from \`@pixi/devtools/vite\` in your app's Vite dev config.`;

      // Log in the INSPECTED PAGE's console (via the bridge), not the panel's, so the app
      // developer actually sees it in their own devtools console.
      logToPage(hasTaggedClasses ? 'warn' : 'error', message);
      return;
    }

    const url = buildEditorUrl(DEFAULT_EDITOR, source);
    if (!url) {
      logToPage('warn', `[PixiJS DevTools] Could not build an editor URL for "${source}".`);
      return;
    }

    // Open from the PANEL, not via the page bridge: launching an external protocol (vscode://)
    // requires a user gesture, and the context-menu click only counts here in the panel. Code
    // eval'd in the inspected page has no gesture, so Chrome blocks it silently on origins that
    // haven't been granted permission.
    window.open(url, '_blank');
  }, [bridge, node]);

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <NodeTrigger dragHandle={dragHandle} style={style} node={node} onToggle={onToggle} bridge={bridge} />
      </ContextMenuTrigger>
      <ContextMenuContent>
        <NodeContextMenuItem title="Select" onClick={onSelected} />
        <NodeContextMenuItem
          title="Open"
          onClick={onOpenInEditor}
          icon={<ExternalLinkIcon className="h-3.5 w-3.5 opacity-70" />}
        />
        <NodeContextMenuItem title="Rename" onClick={onRename} />
        <NodeContextMenuItem title="Toggle" onClick={onToggle} />
        <NodeContextMenuItem title="Delete" onClick={onDeleted} />
        {node.data.metadata.contextMenu?.map((item, i) => (
          <CustomNodeContextMenuItem
            key={node.id + item + i}
            node={node}
            item={item}
            bridge={bridge}
            isLast={i === node.data.metadata.contextMenu!.length - 1}
          />
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}
