import { feature } from '@turf/helpers';
import intersect from '@turf/intersect';
import booleanIntersects from '@turf/boolean-intersects';
import buffer from '@turf/buffer';

import { calculateAreaSquareMeters } from './calculateArea';
import type { PolygonEntity, PolygonGeometry } from '../../types/polygon';

// Reference cadastral systems (e.g. ONR's overlap map) report real
// conflicts as small as 0.05 m² without filtering them out, so the gate
// here must only remove true numerical noise (sub-millimeter artifacts from
// floating-point/UTM round-tripping on an exactly-touching edge), not
// anything at a scale a land registry would still consider a genuine
// boundary conflict. Erode the raw intersection by half this distance.
const MIN_OVERLAP_WIDTH_METERS = 0.001;

// A lot sitting fully inside a neighborhood/parent boundary is intentional
// nesting, not a boundary conflict — only flag when neither polygon is
// (almost) entirely swallowed by the intersection, i.e. both genuinely
// encroach on each other's exclusive area.
const CONTAINMENT_RATIO_THRESHOLD = 0.98;

export interface OverlapDetail {
  polygonAId: string;
  polygonBId: string;
  /** Real-world area of the overlapping region, in m². */
  areaSquareMeters: number;
  /** What % of polygon A's own area is covered by the overlap. */
  percentOfA: number;
  /** What % of polygon B's own area is covered by the overlap. */
  percentOfB: number;
  /** The overlapping region itself, so it can be drawn on the map. */
  geometry: PolygonGeometry;
}

const detectOverlap = (a: PolygonEntity, b: PolygonEntity): OverlapDetail | null => {
  const featureA = feature(a.geometry);
  const featureB = feature(b.geometry);

  if (!booleanIntersects(featureA, featureB)) {
    return null;
  }

  const intersection = intersect({
    type: 'FeatureCollection',
    features: [featureA, featureB],
  });

  if (!intersection) {
    return null;
  }

  let eroded;
  try {
    eroded = buffer(intersection, -MIN_OVERLAP_WIDTH_METERS / 2, { units: 'meters' });
  } catch {
    eroded = undefined;
  }
  if (!eroded) {
    return null;
  }

  const areaSquareMeters = calculateAreaSquareMeters(intersection.geometry as PolygonGeometry);
  const smallerArea = Math.min(a.calculated.areaSquareMeters, b.calculated.areaSquareMeters);
  const containmentRatio = smallerArea > 0 ? areaSquareMeters / smallerArea : 0;
  if (containmentRatio >= CONTAINMENT_RATIO_THRESHOLD) {
    return null;
  }

  return {
    polygonAId: a.id,
    polygonBId: b.id,
    areaSquareMeters,
    percentOfA: a.calculated.areaSquareMeters > 0 ? (areaSquareMeters / a.calculated.areaSquareMeters) * 100 : 0,
    percentOfB: b.calculated.areaSquareMeters > 0 ? (areaSquareMeters / b.calculated.areaSquareMeters) * 100 : 0,
    geometry: intersection.geometry as PolygonGeometry,
  };
};

/** All pairwise conflicts, each with the overlap area/percentage and the overlapping region itself. */
export function findOverlaps(polygons: PolygonEntity[]): OverlapDetail[] {
  const details: OverlapDetail[] = [];

  for (let i = 0; i < polygons.length; i += 1) {
    for (let j = i + 1; j < polygons.length; j += 1) {
      const detail = detectOverlap(polygons[i], polygons[j]);
      if (detail) details.push(detail);
    }
  }

  return details;
}

export function overlappingPolygonIdsFrom(details: OverlapDetail[]): Set<string> {
  const ids = new Set<string>();
  details.forEach((detail) => {
    ids.add(detail.polygonAId);
    ids.add(detail.polygonBId);
  });
  return ids;
}

export function findOverlappingPolygonIds(polygons: PolygonEntity[]): Set<string> {
  return overlappingPolygonIdsFrom(findOverlaps(polygons));
}
