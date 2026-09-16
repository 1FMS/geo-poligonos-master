import { feature } from '@turf/helpers';
import intersect from '@turf/intersect';
import booleanIntersects from '@turf/boolean-intersects';

import { calculateAreaSquareMeters } from '../geo/calculateArea';
import type { PolygonEntity, PolygonGeometry } from '../../types/polygon';

export interface OnrMatch {
  candidate: PolygonEntity;
  /** What % of the selected polygon's own area this candidate covers. */
  overlapPercentOfSelected: number;
}

// Unlike detectOverlaps.ts (which flags boundary *conflicts* and so
// deliberately ignores full containment as intentional nesting), a near-total
// overlap here is exactly the signal we're looking for — it means the ONR
// candidate IS the selected lot. So this intentionally does its own turf
// intersection instead of reusing detectOverlap, with no containment filter.
const overlapPercent = (selected: PolygonEntity, candidateGeometry: PolygonGeometry): number => {
  const selectedFeature = feature(selected.geometry);
  const candidateFeature = feature(candidateGeometry);

  if (!booleanIntersects(selectedFeature, candidateFeature)) return 0;

  const intersection = intersect({ type: 'FeatureCollection', features: [selectedFeature, candidateFeature] });
  if (!intersection) return 0;

  const overlapArea = calculateAreaSquareMeters(intersection.geometry as PolygonGeometry);
  return selected.calculated.areaSquareMeters > 0 ? (overlapArea / selected.calculated.areaSquareMeters) * 100 : 0;
};

/** For each ONR candidate, how much of the selected polygon it actually covers — never mutates or persists anything. */
export function describeOnrMatches(selected: PolygonEntity, candidates: PolygonEntity[]): OnrMatch[] {
  return candidates.map((candidate) => ({
    candidate,
    overlapPercentOfSelected: overlapPercent(selected, candidate.geometry),
  }));
}
