import { GeoJSON } from 'react-leaflet';
import type { FeatureCollection, Polygon } from 'geojson';

import { usePolygons } from '../../app/PolygonProvider';

// A bright white outline around a saturated fill keeps the conflict zone
// legible whether the map underneath is pale soil or dark vegetation —
// the same halo trick used for the selected-polygon outline.
const OVERLAP_STYLE = {
  color: '#ffffff',
  weight: 2,
  fillColor: '#e11d1d',
  fillOpacity: 0.65,
  className: 'overlap-highlight',
};

/**
 * Draws the exact overlapping region(s) — not just which polygons conflict,
 * but where the conflict actually is — as a solid highlight on top of the
 * polygons involved.
 */
export function OverlapHighlight() {
  const { overlapDetails } = usePolygons();

  if (overlapDetails.length === 0) {
    return null;
  }

  const data: FeatureCollection<Polygon> = {
    type: 'FeatureCollection',
    features: overlapDetails.flatMap((detail) => {
      const parts = detail.geometry.type === 'Polygon' ? [detail.geometry.coordinates] : detail.geometry.coordinates;
      return parts.map((coordinates) => ({
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'Polygon' as const, coordinates },
      }));
    }),
  };

  // react-leaflet's GeoJSON only reacts to `style` prop changes, not `data`
  // (see PolygonLayer for the same caveat) — key on the data itself so a
  // changed conflict zone actually redraws instead of showing a stale shape.
  return <GeoJSON key={JSON.stringify(data)} data={data} style={OVERLAP_STYLE} interactive={false} />;
}
