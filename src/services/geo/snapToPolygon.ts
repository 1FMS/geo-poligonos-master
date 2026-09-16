import { point } from '@turf/helpers';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import polygonToLine from '@turf/polygon-to-line';
import type { Position } from 'geojson';

import type { PolygonGeometry } from '../../types/polygon';

// Close enough to "on the line" to be a deliberate snap, far enough not to
// fight normal dragging — a fraction of a meter, matching the millimeter-
// scale precision this app otherwise targets for boundary edits.
const SNAP_DISTANCE_METERS = 0.5;

/**
 * Finds the closest point, if any, on the boundary of any of `targets` to
 * (lng, lat), within SNAP_DISTANCE_METERS. Used while dragging a vertex in
 * the geometry editor so it can lock onto a neighboring polygon's exact
 * edge instead of eyeballing it.
 */
export function snapToNearestPolygonEdge(lng: number, lat: number, targets: PolygonGeometry[]): Position | undefined {
  let closest: { position: Position; distance: number } | undefined;

  for (const geometry of targets) {
    let lines;
    try {
      lines = polygonToLine(geometry);
    } catch {
      continue;
    }
    const lineFeatures = lines.type === 'FeatureCollection' ? lines.features : [lines];

    for (const line of lineFeatures) {
      let nearest;
      try {
        nearest = nearestPointOnLine(line, point([lng, lat]), { units: 'meters' });
      } catch {
        continue;
      }
      const distance = nearest.properties?.dist;
      if (
        typeof distance === 'number'
        && distance <= SNAP_DISTANCE_METERS
        && (!closest || distance < closest.distance)
      ) {
        closest = { position: nearest.geometry.coordinates, distance };
      }
    }
  }

  return closest?.position;
}
