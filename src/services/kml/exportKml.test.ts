import { describe, expect, it } from 'vitest';

import { parseKml } from './importKml';
import { serializePolygonKml } from './exportKml';
import type { PolygonEntity } from '../../types/polygon';

const polygonEntity: PolygonEntity = {
  id: 'p1',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-46.6, -23.5],
        [-46.5, -23.5],
        [-46.5, -23.4],
        [-46.6, -23.5],
      ],
    ],
  },
  properties: {
    name: 'Fazenda Boa Vista',
    description: 'Área de teste',
    createdAt: '2026-01-01T00:00:00.000Z',
    customFields: [{ id: 'f1', key: 'proprietario', label: 'Proprietário', value: 'João' }],
  },
  calculated: {
    areaSquareMeters: 999999,
  },
};

const multiPolygonEntity: PolygonEntity = {
  id: 'p2',
  geometry: {
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [-46.6, -23.5],
          [-46.5, -23.5],
          [-46.5, -23.4],
          [-46.6, -23.5],
        ],
      ],
      [
        [
          [-47.6, -24.5],
          [-47.5, -24.5],
          [-47.5, -24.4],
          [-47.6, -24.5],
        ],
      ],
    ],
  },
  properties: {
    name: 'Talhão Composto',
    description: 'Duas partes',
    createdAt: '2026-01-01T00:00:00.000Z',
    customFields: [{ id: 'f2', key: 'safra', label: 'Safra', value: '2026' }],
  },
  calculated: {
    areaSquareMeters: 123456,
  },
};

describe('serializePolygonKml round-trip', () => {
  it('reimporta um Polygon exportado preservando geometria, nome, descrição e campos personalizados', () => {
    const kmlText = serializePolygonKml(polygonEntity);
    const { polygons } = parseKml(kmlText);

    expect(polygons).toHaveLength(1);
    const reimported = polygons[0];

    expect(reimported.geometry).toEqual(polygonEntity.geometry);
    expect(reimported.properties.name).toBe(polygonEntity.properties.name);
    expect(reimported.properties.description).toBe(polygonEntity.properties.description);
    expect(reimported.properties.customFields.map((f) => [f.key, f.value])).toEqual(
      expect.arrayContaining([['proprietario', 'João']]),
    );

    // Área deve ser recalculada a partir da geometria reimportada, não copiada do valor exportado.
    expect(reimported.calculated.areaSquareMeters).not.toBe(polygonEntity.calculated.areaSquareMeters);
    expect(reimported.calculated.areaSquareMeters).toBeGreaterThan(0);
  });

  it('reimporta um MultiPolygon exportado preservando geometria, nome, descrição e campos personalizados', () => {
    // O importador funde os membros Polygon de uma MultiGeometry KML (um
    // único Placemark) de volta em uma única entidade MultiPolygon: a
    // MultiGeometry representa uma única entidade lógica com N partes, e é
    // assim que o app deve tratá-la ao reimportar (ver `multipolygon.kml`
    // e o cenário E2E "importa MultiPolygon como uma única entidade").
    const kmlText = serializePolygonKml(multiPolygonEntity);
    const { polygons } = parseKml(kmlText);

    expect(polygons).toHaveLength(1);
    const reimported = polygons[0];

    expect(reimported.geometry).toEqual(multiPolygonEntity.geometry);
    expect(reimported.properties.name).toBe(multiPolygonEntity.properties.name);
    expect(reimported.properties.description).toBe(multiPolygonEntity.properties.description);
    expect(reimported.properties.customFields.map((f) => [f.key, f.value])).toEqual(
      expect.arrayContaining([['safra', '2026']]),
    );

    // Área deve ser recalculada a partir da geometria reimportada, não copiada do valor exportado.
    expect(reimported.calculated.areaSquareMeters).not.toBe(multiPolygonEntity.calculated.areaSquareMeters);
    expect(reimported.calculated.areaSquareMeters).toBeGreaterThan(0);
  });
});
