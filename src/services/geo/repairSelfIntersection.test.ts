import { describe, expect, it } from 'vitest';
import type { PolygonGeometry } from '../../types/polygon';
import { geometryHasSelfIntersection, repairSelfIntersectingPolygon, ringHasSelfIntersection } from './repairSelfIntersection';

describe('ringHasSelfIntersection', () => {
  it('returns false for a simple square', () => {
    const ring = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
    expect(ringHasSelfIntersection(ring)).toBe(false);
  });

  it('detects a bowtie ring (vertices out of order)', () => {
    const ring = [[0, 0], [10, 10], [10, 0], [0, 10], [0, 0]];
    expect(ringHasSelfIntersection(ring)).toBe(true);
  });
});

describe('geometryHasSelfIntersection', () => {
  it('checks every ring of a MultiPolygon', () => {
    const geometry: PolygonGeometry = {
      type: 'MultiPolygon',
      coordinates: [
        [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
        [[[10, 10], [11, 11], [11, 10], [10, 11], [10, 10]]],
      ],
    };
    expect(geometryHasSelfIntersection(geometry)).toBe(true);
  });
});

describe('repairSelfIntersectingPolygon', () => {
  it('returns null when the fix would discard too much area (a real vertex-ordering problem)', () => {
    // A perfect bowtie splits into two equal-area triangles; keeping only
    // one after the fix would silently drop ~50% of the original shape.
    const bowtie: PolygonGeometry = {
      type: 'Polygon',
      coordinates: [[[0, 0], [10, 10], [10, 0], [0, 10], [0, 0]]],
    };
    expect(repairSelfIntersectingPolygon(bowtie)).toBeNull();
  });

  it('repairs a self-intersection that only costs a negligible sliver of area', () => {
    // A square with one corner clipped by a tiny reversed "ear" — the kind
    // of small vertex-ordering slip a CAD export can introduce, as opposed
    // to a genuine bowtie spanning the whole shape.
    const nearSquare: PolygonGeometry = {
      type: 'Polygon',
      coordinates: [[[0, 0], [10, 0], [10, 10], [9, 10], [10, 9], [0, 10], [0, 0]]],
    };
    expect(geometryHasSelfIntersection(nearSquare)).toBe(true);

    const repaired = repairSelfIntersectingPolygon(nearSquare);
    expect(repaired).not.toBeNull();
    expect(geometryHasSelfIntersection(repaired!)).toBe(false);
  });
});
