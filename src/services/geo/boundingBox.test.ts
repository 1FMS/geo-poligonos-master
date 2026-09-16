import { describe, expect, it } from 'vitest';

import { boundsFromGeometries } from './boundingBox';
import type { PolygonGeometry } from '../../types/polygon';

describe('boundsFromGeometries', () => {
  it('retorna null para uma lista vazia', () => {
    expect(boundsFromGeometries([])).toBeNull();
  });

  it('calcula os limites de um único polígono', () => {
    const polygon: PolygonGeometry = {
      type: 'Polygon',
      coordinates: [[[-46.6, -23.5], [-46.5, -23.5], [-46.5, -23.4], [-46.6, -23.5]]],
    };

    expect(boundsFromGeometries([polygon])).toEqual([[-23.5, -46.6], [-23.4, -46.5]]);
  });

  it('combina os limites de múltiplas geometrias, incluindo MultiPolygon', () => {
    const polygon: PolygonGeometry = {
      type: 'Polygon',
      coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]],
    };
    const multiPolygon: PolygonGeometry = {
      type: 'MultiPolygon',
      coordinates: [[[[5, 5], [6, 5], [6, 6], [5, 5]]]],
    };

    expect(boundsFromGeometries([polygon, multiPolygon])).toEqual([[0, 0], [6, 6]]);
  });
});
