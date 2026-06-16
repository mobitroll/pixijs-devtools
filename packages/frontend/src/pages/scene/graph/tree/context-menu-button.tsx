import type { ContextMenuButtonMetadata } from '@kahoot/pixi-devtools';
import { useCallback } from 'react';
import type { NodeApi } from 'react-arborist';
import { ContextMenuItem, ContextMenuSeparator } from '../../../../components/ui/context-menu';
import type { BridgeFn } from '../../../../lib/utils';
import type { SceneGraphEntry } from '../../../../types';

export const NodeContextMenuItem: React.FC<{
  title: string;
  onClick: React.MouseEventHandler<HTMLDivElement>;
  icon?: React.ReactNode;
  shortcut?: string;
  isLast?: boolean;
}> = ({ title, onClick, icon, shortcut, isLast }) => {
  isLast = isLast ?? false;
  return (
    <>
      <ContextMenuItem onClick={onClick}>
        {title}
        {(shortcut || icon) && (
          <span className="ml-auto flex items-center gap-2 pl-3">
            {shortcut && <span className="text-muted-foreground text-xs tracking-widest">{shortcut}</span>}
            {icon}
          </span>
        )}
      </ContextMenuItem>
      {!isLast && <ContextMenuSeparator />}
    </>
  );
};

export const CustomNodeContextMenuItem: React.FC<{
  node: NodeApi<SceneGraphEntry>;
  item: ContextMenuButtonMetadata;
  bridge: BridgeFn;
  isLast?: boolean;
}> = ({ node, item, bridge, isLast }) => {
  const handleClick = useCallback(() => {
    bridge(
      `window.__PIXI_DEVTOOLS_WRAPPER__?.scene.tree.nodeContextMenu(${JSON.stringify(node.id)}, ${JSON.stringify(item.name)})`,
    );
  }, [node, item, bridge]);

  return <NodeContextMenuItem title={item.icon ?? item.name} onClick={handleClick} isLast={isLast} />;
};
