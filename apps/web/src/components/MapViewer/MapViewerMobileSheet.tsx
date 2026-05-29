import { useCallback } from 'react';
import type { MapMobSpawnWithName, MapNpcWithName, MapPortalRecord } from '@/db';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { PortalGraph } from '@/domain/portal-types';
import { MapViewerSidebar } from './MapViewerSidebar';
import type { LayerVisibility, MapViewerHighlight } from './types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mapId: number;
  npcs: MapNpcWithName[];
  mobSpawns: MapMobSpawnWithName[];
  portals: MapPortalRecord[];
  portalGraph: PortalGraph;
  selection: MapViewerHighlight | null;
  onSelectionChange: (sel: MapViewerHighlight | null) => void;
  onHover: (sel: MapViewerHighlight | null) => void;
  onLayerEnable: (key: keyof LayerVisibility) => void;
}

/**
 * Mobile bottom sheet wrapping the existing `MapViewerSidebar`. The desktop
 * layout keeps the sidebar inline next to the canvas; on phones the canvas
 * needs the whole viewport, so the entity browser lives behind a FAB and
 * auto-dismisses on selection so the user immediately sees the highlight.
 */
export function MapViewerMobileSheet({
  open,
  onOpenChange,
  mapId,
  npcs,
  mobSpawns,
  portals,
  portalGraph,
  selection,
  onSelectionChange,
  onHover,
  onLayerEnable,
}: Props) {
  const handleSelect = useCallback(
    (sel: MapViewerHighlight | null) => {
      onSelectionChange(sel);
      if (sel !== null) onOpenChange(false);
    },
    [onSelectionChange, onOpenChange],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-card flex h-[70dvh] flex-col rounded-t-lg p-0"
      >
        <SheetHeader className="border-border border-b p-3">
          <SheetTitle className="text-sm">Browse map</SheetTitle>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col">
          <MapViewerSidebar
            mapId={mapId}
            npcs={npcs}
            mobSpawns={mobSpawns}
            portals={portals}
            portalGraph={portalGraph}
            selection={selection}
            onSelect={handleSelect}
            // Hover highlight is mouse-only — passing null no-ops on touch.
            onHover={onHover}
            onLayerEnable={onLayerEnable}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
