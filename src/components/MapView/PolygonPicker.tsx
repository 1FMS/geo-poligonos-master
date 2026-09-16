import { useMapEvent } from 'react-leaflet';

import { usePolygons } from '../../app/PolygonProvider';
import { findSmallestPolygonAt } from '../../services/geo/findSmallestPolygonAt';

/**
 * Centralizes map-click selection so nested polygons (a lot inside a block
 * inside a neighborhood, common in cadastral DXF/KML imports) can always be
 * reached: instead of whichever polygon happens to render on top winning
 * the click, this picks the smallest polygon whose area contains the
 * clicked point.
 */
export function PolygonPicker() {
  const { polygons, drawingMode, editingPolygonId, selectPolygon } = usePolygons();

  useMapEvent('click', (event) => {
    if (drawingMode || !event.latlng) return;

    const match = findSmallestPolygonAt(polygons, [event.latlng.lng, event.latlng.lat]);
    if (!match) return;

    // A click that lands on the polygon currently being edited is Geoman
    // interacting with its own vertices/fill, not a request to change
    // selection — leave it alone so an active multi-vertex edit isn't reset.
    if (editingPolygonId !== null && match.id === editingPolygonId) return;

    selectPolygon(match.id);
  });

  return null;
}
