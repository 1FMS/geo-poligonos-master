import { describe, expect, it } from 'vitest';

import { buildPolygonReport } from './buildPolygonReport';
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
    customFields: [{ id: 'f1', key: 'proprietario', label: 'Proprietário', value: 'Ana' }],
  },
  calculated: {
    areaSquareMeters: 999999,
  },
};

describe('buildPolygonReport', () => {
  it('monta o modelo do relatório a partir da entidade', () => {
    const report = buildPolygonReport(polygonEntity);

    expect(report.title).toBe('Relatório do Polígono');
    expect(report.name).toBe('Fazenda Boa Vista');
    expect(report.description).toBe('Área de teste');
    expect(report.area).toEqual({ squareMeters: expect.any(String), hectares: expect.any(String) });
    expect(report.coordinates[0]).toEqual(expect.objectContaining({ point: 'A', utmZone: '23 S' }));
    expect(report.customFields).toEqual([{ label: 'Proprietário', value: 'Ana' }]);
  });

  it('retorna lista vazia de campos personalizados quando não há características cadastradas', () => {
    const report = buildPolygonReport({
      ...polygonEntity,
      properties: { ...polygonEntity.properties, customFields: [] },
    });

    expect(report.customFields).toEqual([]);
  });

  it('inclui latitude, longitude, easting e northing formatados para cada coordenada', () => {
    const report = buildPolygonReport(polygonEntity);

    expect(report.coordinates).toHaveLength(3);
    for (const coordinate of report.coordinates) {
      expect(coordinate).toEqual(
        expect.objectContaining({
          point: expect.any(String),
          latitude: expect.any(String),
          longitude: expect.any(String),
          utmZone: expect.any(String),
          easting: expect.any(String),
          northing: expect.any(String),
        }),
      );
    }
  });
});
