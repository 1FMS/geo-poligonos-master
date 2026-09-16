import { describe, expect, it } from 'vitest';

import { calculateAreaSquareMeters, toHectares } from './calculateArea';
import type { PolygonGeometry } from '../../types/polygon';

const oneDegreeSquareAtEquator: PolygonGeometry = {
  type: 'Polygon',
  coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
};

describe('calculateAreaSquareMeters', () => {
  it('calculates the geodesic area of a one-degree equatorial square', () => {
    // This literal is an independently calculated spherical surface area in m².
    expect(calculateAreaSquareMeters(oneDegreeSquareAtEquator)).toBeCloseTo(12_363_718_145, -4);
  });
});

describe('toHectares', () => {
  it('converts square metres to hectares', () => {
    expect(toHectares(25_000)).toBe(2.5);
  });
});
