import { describe, expect, it } from 'vitest';

import { isValidPolygonGeometry, listVertices, vertexLabel } from './polygonUtils';
import type { PolygonGeometry } from '../../types/polygon';

const validTriangle: PolygonGeometry = {
  type: 'Polygon',
  coordinates: [[[-46.7, -23.6], [-46.6, -23.6], [-46.65, -23.5], [-46.7, -23.6]]],
};

const repeatedTwoPointRing: PolygonGeometry = {
  type: 'Polygon',
  coordinates: [[[0, 0], [1, 0], [0, 0], [1, 0], [0, 0]]],
};

describe('isValidPolygonGeometry', () => {
  it('accepts a closed ring with three distinct positions', () => {
    expect(isValidPolygonGeometry(validTriangle)).toBe(true);
  });

  it('rejects a ring that repeats only two distinct positions', () => {
    expect(isValidPolygonGeometry(repeatedTwoPointRing)).toBe(false);
  });
});

describe('vertexLabel', () => {
  it('continues spreadsheet-style labels after Z', () => {
    expect(vertexLabel(0)).toBe('A');
    expect(vertexLabel(25)).toBe('Z');
    expect(vertexLabel(26)).toBe('AA');
  });
});

describe('listVertices', () => {
  it('omits closing positions and retains part and ring identity in a multipolygon', () => {
    const geometry: PolygonGeometry = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [[0, 0], [2, 0], [0, 2], [0, 0]],
          [[0.2, 0.2], [0.4, 0.2], [0.2, 0.4], [0.2, 0.2]],
        ],
        [
          [[10, 10], [12, 10], [10, 12], [10, 10]],
        ],
      ],
    };

    expect(listVertices(geometry)).toEqual([
      { position: [0, 0], partIndex: 0, ringIndex: 0, vertexIndex: 0 },
      { position: [2, 0], partIndex: 0, ringIndex: 0, vertexIndex: 1 },
      { position: [0, 2], partIndex: 0, ringIndex: 0, vertexIndex: 2 },
      { position: [0.2, 0.2], partIndex: 0, ringIndex: 1, vertexIndex: 0 },
      { position: [0.4, 0.2], partIndex: 0, ringIndex: 1, vertexIndex: 1 },
      { position: [0.2, 0.4], partIndex: 0, ringIndex: 1, vertexIndex: 2 },
      { position: [10, 10], partIndex: 1, ringIndex: 0, vertexIndex: 0 },
      { position: [12, 10], partIndex: 1, ringIndex: 0, vertexIndex: 1 },
      { position: [10, 12], partIndex: 1, ringIndex: 0, vertexIndex: 2 },
    ]);
  });
});
