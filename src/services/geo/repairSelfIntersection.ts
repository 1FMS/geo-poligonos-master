import { feature } from '@turf/helpers';
import buffer from '@turf/buffer';
import type * as GeoJSON from 'geojson';

import { calculateAreaSquareMeters } from './calculateArea';
import { isValidPolygonGeometry } from './polygonUtils';
import type { PolygonGeometry } from '../../types/polygon';

// A repaired shape whose area drifts more than this from the original is
// treated as a genuine structural problem (e.g. vertices recorded in the
// wrong order), not numerical noise — silently discarding that much of a
// real cadastral lot would be worse than just rejecting the import.
const MAX_AREA_DRIFT_RATIO = 0.01;

const orientation = (p: GeoJSON.Position, q: GeoJSON.Position, r: GeoJSON.Position): number => {
  const value = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
  if (Math.abs(value) < Number.EPSILON) return 0;
  return value > 0 ? 1 : 2;
};

const onSegment = (p: GeoJSON.Position, q: GeoJSON.Position, r: GeoJSON.Position): boolean =>
  q[0] <= Math.max(p[0], r[0]) && q[0] >= Math.min(p[0], r[0])
  && q[1] <= Math.max(p[1], r[1]) && q[1] >= Math.min(p[1], r[1]);

const segmentsIntersect = (
  p1: GeoJSON.Position, p2: GeoJSON.Position, p3: GeoJSON.Position, p4: GeoJSON.Position,
): boolean => {
  const o1 = orientation(p1, p2, p3);
  const o2 = orientation(p1, p2, p4);
  const o3 = orientation(p3, p4, p1);
  const o4 = orientation(p3, p4, p2);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p3, p2)) return true;
  if (o2 === 0 && onSegment(p1, p4, p2)) return true;
  if (o3 === 0 && onSegment(p3, p1, p4)) return true;
  if (o4 === 0 && onSegment(p3, p2, p4)) return true;
  return false;
};

/** True when consecutive (non-adjacent) edges of a closed ring cross each other — a "bowtie". */
export function ringHasSelfIntersection(ring: GeoJSON.Position[]): boolean {
  const edgeCount = ring.length - 1; // last point repeats the first
  for (let i = 0; i < edgeCount; i += 1) {
    for (let j = i + 1; j < edgeCount; j += 1) {
      const adjacent = j === i + 1 || (i === 0 && j === edgeCount - 1);
      if (adjacent) continue;
      if (segmentsIntersect(ring[i], ring[i + 1], ring[j], ring[j + 1])) return true;
    }
  }
  return false;
}

export function geometryHasSelfIntersection(geometry: PolygonGeometry): boolean {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some((rings) => rings.some(ringHasSelfIntersection));
}

/**
 * Attempts to resolve a self-intersecting ("bowtie") polygon into a simple
 * one via a zero-distance buffer (a standard JTS/GEOS trick). Returns the
 * repaired geometry only when its area is close to the original — a large
 * drift means the self-intersection reflects a real vertex-ordering problem
 * in the source data, not numerical noise, and silently "fixing" it would
 * mean silently discarding part of a real cadastral boundary.
 */
export function repairSelfIntersectingPolygon(geometry: PolygonGeometry): PolygonGeometry | null {
  const originalArea = calculateAreaSquareMeters(geometry);

  let repaired;
  try {
    repaired = buffer(feature(geometry), 0, { units: 'meters' });
  } catch {
    return null;
  }

  if (!repaired || (repaired.geometry.type !== 'Polygon' && repaired.geometry.type !== 'MultiPolygon')) {
    return null;
  }

  const repairedGeometry = repaired.geometry as PolygonGeometry;
  if (!isValidPolygonGeometry(repairedGeometry)) return null;

  const repairedArea = calculateAreaSquareMeters(repairedGeometry);
  const drift = originalArea > 0 ? Math.abs(repairedArea - originalArea) / originalArea : 1;
  if (drift > MAX_AREA_DRIFT_RATIO) return null;

  return repairedGeometry;
}
