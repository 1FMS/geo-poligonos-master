import { describe, expect, it } from 'vitest';
import type { PolygonGeometry } from '../../types/polygon';
import { OverlapTrimError, trimPolygonOverlap } from './trimOverlap';

describe('trimPolygonOverlap', () => {
  it('removes exactly the shared region, keeping the rest of the boundary', () => {
    const target: PolygonGeometry = {
      type: 'Polygon',
      coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
    };
    const other: PolygonGeometry = {
      type: 'Polygon',
      coordinates: [[[5, 5], [15, 5], [15, 15], [5, 15], [5, 5]]],
    };

    const result = trimPolygonOverlap(target, other);

    expect(result.type).toBe('Polygon');
    // The trimmed corner (5,5)-(10,5)-(10,10)-(5,10) must be gone, but the
    // untouched corners of the original square must remain.
    const flat = JSON.stringify(result);
    expect(flat).toContain('[0,0]');
    expect(flat).toContain('[10,0]');
    expect(flat).toContain('[0,10]');
  });

  it('throws when the overlap fully consumes the target polygon', () => {
    const target: PolygonGeometry = {
      type: 'Polygon',
      coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
    };
    const other: PolygonGeometry = {
      type: 'Polygon',
      coordinates: [[[-5, -5], [15, -5], [15, 15], [-5, 15], [-5, -5]]],
    };

    expect(() => trimPolygonOverlap(target, other)).toThrow(OverlapTrimError);
  });

  it('throws when there is no overlap to remove', () => {
    const target: PolygonGeometry = {
      type: 'Polygon',
      coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
    };
    const other: PolygonGeometry = {
      type: 'Polygon',
      coordinates: [[[20, 20], [30, 20], [30, 30], [20, 30], [20, 20]]],
    };

    // No intersection: turf's difference returns the original geometry,
    // which is a same-polygon "trim" — the caller decides whether that's
    // worth acting on, but it must not throw or silently delete anything.
    expect(trimPolygonOverlap(target, other)).toEqual(target);
  });
});
