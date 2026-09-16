import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { feature, point } from '@turf/helpers';

import type { PolygonEntity } from '../../types/polygon';

/**
 * When polygons are nested (e.g. a lot inside a block inside a
 * neighborhood), a click inside all of them should select the most
 * specific one — the smallest by area — rather than whichever happens to
 * render on top.
 */
export function findSmallestPolygonAt(polygons: PolygonEntity[], position: [number, number]): PolygonEntity | null {
  const clickPoint = point(position);
  let best: PolygonEntity | null = null;

  for (const polygon of polygons) {
    if (!booleanPointInPolygon(clickPoint, feature(polygon.geometry))) continue;
    if (!best || polygon.calculated.areaSquareMeters < best.calculated.areaSquareMeters) {
      best = polygon;
    }
  }

  return best;
}
