import { feature, featureCollection } from '@turf/helpers';
import difference from '@turf/difference';

import type { PolygonGeometry } from '../../types/polygon';

export class OverlapTrimError extends Error {
  constructor(message = 'Não é possível remover a sobreposição sem eliminar o polígono.') {
    super(message);
    this.name = 'OverlapTrimError';
  }
}

/**
 * Subtracts exactly the region shared with `other` from `target`, leaving
 * the rest of `target`'s boundary untouched — the smallest possible edit
 * that clears the conflict, as opposed to manually nudging vertices.
 */
export function trimPolygonOverlap(target: PolygonGeometry, other: PolygonGeometry): PolygonGeometry {
  let result;
  try {
    result = difference(featureCollection([feature(target), feature(other)]));
  } catch {
    throw new OverlapTrimError();
  }

  if (!result || (result.geometry.type !== 'Polygon' && result.geometry.type !== 'MultiPolygon')) {
    throw new OverlapTrimError();
  }

  return result.geometry as PolygonGeometry;
}
