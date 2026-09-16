import { describe, expect, it } from 'vitest';
import type { Feature } from 'geojson';
import type { PolygonGeometry } from '../../types/polygon';
import {
  createPolygonEntity,
  featuresForPolygon,
  geometryFromEditingFeatures,
  geometryFromTerraFeature,
  InvalidPolygonGeometryError,
  terraPartId,
} from './terraDrawGeometry';

const triangleFeature = {
  id: 'created',
  type: 'Feature' as const,
  properties: { mode: 'polygon' as const, source: 'creation' as const, identityColor: '#f59e0b' },
  geometry: { type: 'Polygon' as const, coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]] },
};

const multiPolygon = {
  type: 'MultiPolygon' as const,
  coordinates: [
    [[[0, 0], [1, 0], [0, 1], [0, 0]]],
    [[[5, 5], [8, 5], [5, 8], [5, 5]]],
  ],
};

describe('Terra Draw geometry adapters', () => {
  it('converts a valid Terra Draw feature and derives a complete entity', () => {
    expect(geometryFromTerraFeature(triangleFeature)).toEqual(triangleFeature.geometry);
    const entity = createPolygonEntity(triangleFeature.geometry);
    expect(entity.properties.name).toBe('Polígono sem nome');
    expect(entity.properties.description).toBe('');
    expect(entity.properties.customFields).toEqual([]);
    expect(entity.calculated.areaSquareMeters).toBeGreaterThan(0);
  });

  it('rejects a Terra Draw polygon with fewer than three distinct positions', () => {
    expect(() => geometryFromTerraFeature({
      ...triangleFeature,
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [0, 0]]] },
    })).toThrow(InvalidPolygonGeometryError);
  });

  it('does not share geometry references with a Terra Draw feature', () => {
    const feature = {
      ...triangleFeature,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]],
      },
    };
    const converted = geometryFromTerraFeature(feature);

    feature.geometry.coordinates[0][0][0] = 99;

    expect(converted.coordinates[0][0]).toEqual([0, 0]);
  });

  it('does not share geometry references with a newly created entity', () => {
    const input: PolygonGeometry = {
      type: 'Polygon',
      coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]],
    };
    const entity = createPolygonEntity(input);

    input.coordinates[0][0][0] = 99;

    expect(entity.geometry.coordinates[0][0]).toEqual([0, 0]);
  });

  it.each([
    ['a coordinate string', [['0', 0], [1, 0], [0, 1], ['0', 0]]],
    ['a NaN coordinate', [[Number.NaN, 0], [1, 0], [0, 1], [Number.NaN, 0]]],
    ['an infinite coordinate', [[Infinity, 0], [1, 0], [0, 1], [Infinity, 0]]],
    ['a one-dimensional position', [[0], [1, 0], [0, 1], [0]]],
  ])('rejects a polygon with %s', (_description, ring) => {
    const invalidFeature = {
      ...triangleFeature,
      geometry: { type: 'Polygon' as const, coordinates: [ring] },
    } as unknown as Feature;

    expect(() => geometryFromTerraFeature(invalidFeature)).toThrow(InvalidPolygonGeometryError);
  });

  it('accepts and preserves finite additional position dimensions', () => {
    const feature = {
      ...triangleFeature,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[[0, 0, 10], [1, 0, 10], [0, 1, 10], [0, 0, 10]]],
      },
    };

    expect(geometryFromTerraFeature(feature).coordinates[0][0]).toEqual([0, 0, 10]);
  });

  it('splits and recomposes a MultiPolygon in stable part order', () => {
    const entity = createPolygonEntity(multiPolygon);
    entity.id = 'multi';
    const features = featuresForPolygon(entity);

    expect(features.map((feature) => feature.id)).toEqual([
      terraPartId('multi', 0),
      terraPartId('multi', 1),
    ]);
    expect(features.map((feature) => feature.properties)).toEqual([
      {
        mode: 'polygon',
        source: 'editing',
        polygonId: 'multi',
        partIndex: 0,
        identityColor: '#0891b2',
      },
      {
        mode: 'polygon',
        source: 'editing',
        polygonId: 'multi',
        partIndex: 1,
        identityColor: '#0891b2',
      },
    ]);

    features[1].geometry.coordinates[0][1] = [9, 5];
    const recomposed = geometryFromEditingFeatures(entity.geometry, features);
    expect(recomposed).toEqual({
      type: 'MultiPolygon',
      coordinates: [entity.geometry.coordinates[0], features[1].geometry.coordinates],
    });
    features[1].geometry.coordinates[0][0][0] = 99;
    expect(recomposed.type === 'MultiPolygon' && recomposed.coordinates[1][0][0]).toEqual([5, 5]);
  });

  it('preserves interior rings when splitting a Polygon', () => {
    const geometry = {
      type: 'Polygon' as const,
      coordinates: [
        [[0, 0], [5, 0], [5, 5], [0, 0]],
        [[1, 1], [2, 1], [1, 2], [1, 1]],
      ],
    };
    const entity = createPolygonEntity(geometry);
    entity.id = 'with-hole';

    expect(featuresForPolygon(entity)[0].geometry.coordinates).toEqual(geometry.coordinates);
  });

  it('rejects a missing or duplicated multipart index', () => {
    const entity = createPolygonEntity(multiPolygon);
    const [first] = featuresForPolygon(entity);

    expect(() => geometryFromEditingFeatures(entity.geometry, [first])).toThrow(InvalidPolygonGeometryError);
    expect(() => geometryFromEditingFeatures(entity.geometry, [first, { ...first, id: 'duplicate' }])).toThrow(InvalidPolygonGeometryError);
  });

  it.each([
    ['missing', undefined],
    ['fractional', 0.5],
    ['negative', -1],
    ['out of range', 2],
  ])('rejects a %s multipart index', (_description, partIndex) => {
    const entity = createPolygonEntity(multiPolygon);
    const [first, second] = featuresForPolygon(entity);
    const { partIndex: _originalPartIndex, ...propertiesWithoutPartIndex } = first.properties;
    const invalidFirst = {
      ...first,
      properties: partIndex === undefined ? propertiesWithoutPartIndex : { ...first.properties, partIndex },
    };
    expect(() => geometryFromEditingFeatures(entity.geometry, [invalidFirst, second])).toThrow(InvalidPolygonGeometryError);
  });

  it('ignores creation features while recomposing edited parts', () => {
    const entity = createPolygonEntity(multiPolygon);
    const [first, second] = featuresForPolygon(entity);
    const creationFeature = { ...first, id: 'created', properties: { ...first.properties, source: 'creation' as const } };

    expect(geometryFromEditingFeatures(entity.geometry, [creationFeature, second, first])).toEqual(entity.geometry);
  });
});
