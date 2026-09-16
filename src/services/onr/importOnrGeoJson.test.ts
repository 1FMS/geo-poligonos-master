import { describe, expect, it } from 'vitest';

import { InvalidOnrGeoJsonError, NoSupportedGeometryError, parseOnrGeoJson } from './importOnrGeoJson';

const featureCollection = (features: unknown[]) => JSON.stringify({ type: 'FeatureCollection', features });

const polygonFeature = (overrides: Record<string, unknown> = {}) => ({
  type: 'Feature',
  properties: {
    matricula: '8207',
    cartorio: '3º Registro de Imóveis de São Luis',
    cidade: 'São Luís',
    uf: 'MA',
    url_mat: 'https://registradores.onr.org.br/VisualizarMatricula/DefaultVM.aspx?from=menu',
    ...overrides,
  },
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-44.247958, -2.524694],
        [-44.247838, -2.524666],
        [-44.24782, -2.524739],
        [-44.24794, -2.524769],
        [-44.247958, -2.524694],
      ],
    ],
  },
});

describe('parseOnrGeoJson', () => {
  it('importa um polígono da ONR nomeado pela matrícula, com metadados como campos personalizados', () => {
    const result = parseOnrGeoJson(featureCollection([polygonFeature()]));

    expect(result.polygons).toHaveLength(1);
    expect(result.ignoredCount).toBe(0);
    const [polygon] = result.polygons;
    expect(polygon.properties.name).toBe('ONR - matrícula 8207');
    expect(polygon.calculated.areaSquareMeters).toBeGreaterThan(0);
    expect(polygon.properties.customFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'cartorio', value: '3º Registro de Imóveis de São Luis' }),
        expect.objectContaining({ key: 'cidade', value: 'São Luís' }),
        expect.objectContaining({ key: 'uf', value: 'MA' }),
        expect.objectContaining({
          key: 'url_mat',
          value: 'https://registradores.onr.org.br/VisualizarMatricula/DefaultVM.aspx?from=menu',
        }),
      ]),
    );
  });

  it('nomeia como "ONR - sem matrícula" quando a feature não tem matrícula', () => {
    const result = parseOnrGeoJson(featureCollection([polygonFeature({ matricula: null })]));

    expect(result.polygons[0].properties.name).toBe('ONR - sem matrícula');
  });

  it('ignora features sem geometria de polígono e conta como ignoradas', () => {
    const pointFeature = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: [-44.2, -2.5] },
    };

    const result = parseOnrGeoJson(featureCollection([polygonFeature(), pointFeature]));

    expect(result.polygons).toHaveLength(1);
    expect(result.ignoredCount).toBe(1);
  });

  it('lança InvalidOnrGeoJsonError para um JSON malformado', () => {
    expect(() => parseOnrGeoJson('isto não é json')).toThrow(InvalidOnrGeoJsonError);
  });

  it('lança NoSupportedGeometryError quando não há nenhum polígono', () => {
    const pointFeature = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: [-44.2, -2.5] },
    };

    expect(() => parseOnrGeoJson(featureCollection([pointFeature]))).toThrow(NoSupportedGeometryError);
  });
});
