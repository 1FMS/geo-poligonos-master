import { describe, expect, it } from 'vitest';
import type { PolygonGeometry } from '../../types/polygon';
import { snapToNearestPolygonEdge } from './snapToPolygon';

const square: PolygonGeometry = {
  type: 'Polygon',
  coordinates: [[[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001], [0, 0]]],
};

describe('snapToNearestPolygonEdge', () => {
  it('snaps to the nearest edge point when within range', () => {
    // ~0.05m south of the bottom edge (lat 0), well within the snap threshold.
    const result = snapToNearestPolygonEdge(0.0005, -0.00000045, [square]);
    expect(result).toBeDefined();
    expect(result?.[1]).toBeCloseTo(0, 5);
  });

  it('returns undefined when nothing is close enough', () => {
    const result = snapToNearestPolygonEdge(5, 5, [square]);
    expect(result).toBeUndefined();
  });

  it('returns undefined when there are no targets', () => {
    expect(snapToNearestPolygonEdge(0, 0, [])).toBeUndefined();
  });
});
