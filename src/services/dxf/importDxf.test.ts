import { describe, expect, it } from 'vitest';

import { InvalidDxfError, listDxfLayers, parseDxf } from './importDxf';

const closedSquareDxf = [
  '0', 'SECTION',
  '2', 'ENTITIES',
  '0', 'LWPOLYLINE',
  '8', 'Talhao 1',
  '90', '4',
  '70', '1',
  '10', '500000', '20', '7402000',
  '10', '500100', '20', '7402000',
  '10', '500100', '20', '7402100',
  '10', '500000', '20', '7402100',
  '0', 'ENDSEC',
  '0', 'EOF',
].join('\n');

const mixedLayersDxf = [
  '0', 'SECTION',
  '2', 'ENTITIES',
  '0', 'LWPOLYLINE',
  '8', 'BAIRRO',
  '90', '4',
  '70', '1',
  '10', '500000', '20', '7402000',
  '10', '500500', '20', '7402000',
  '10', '500500', '20', '7402500',
  '10', '500000', '20', '7402500',
  '0', 'LWPOLYLINE',
  '8', 'LOTES',
  '90', '4',
  '70', '1',
  '10', '500010', '20', '7402010',
  '10', '500050', '20', '7402010',
  '10', '500050', '20', '7402050',
  '10', '500010', '20', '7402050',
  '0', 'LWPOLYLINE',
  '8', 'LOTES',
  '90', '4',
  '70', '1',
  '10', '500060', '20', '7402060',
  '10', '500100', '20', '7402060',
  '10', '500100', '20', '7402100',
  '10', '500060', '20', '7402100',
  '0', 'ENDSEC',
  '0', 'EOF',
].join('\n');

const mixedOpenAndClosedDxf = [
  '0', 'SECTION',
  '2', 'ENTITIES',
  '0', 'LWPOLYLINE',
  '8', 'Linha limite',
  '90', '2',
  '70', '0',
  '10', '500000', '20', '7402000',
  '10', '500100', '20', '7402000',
  '0', 'LWPOLYLINE',
  '8', 'Talhao 1',
  '90', '4',
  '70', '1',
  '10', '500000', '20', '7402000',
  '10', '500100', '20', '7402000',
  '10', '500100', '20', '7402100',
  '10', '500000', '20', '7402100',
  '0', 'ENDSEC',
  '0', 'EOF',
].join('\n');

describe('parseDxf', () => {
  it('importa uma polilinha fechada como polígono usando a zona UTM informada', () => {
    const result = parseDxf(closedSquareDxf, { utmZone: 22, utmHemisphere: 'S' });

    expect(result.polygons).toHaveLength(1);
    expect(result.ignoredCount).toBe(0);
    expect(result.polygons[0].geometry.type).toBe('Polygon');
    expect(result.polygons[0].properties.name).toBe('Talhao 1');
    expect(result.polygons[0].calculated.areaSquareMeters).toBeGreaterThan(0);
  });

  it('ignora polilinhas abertas (não fechadas)', () => {
    const result = parseDxf(mixedOpenAndClosedDxf, { utmZone: 22, utmHemisphere: 'S' });

    expect(result.polygons).toHaveLength(1);
    expect(result.ignoredCount).toBe(1);
  });

  it('lança InvalidDxfError para conteúdo que não é um DXF', () => {
    expect(() => parseDxf('isto não é um dxf', { utmZone: 22, utmHemisphere: 'S' })).toThrow(InvalidDxfError);
  });

  it('lista as camadas com polígonos importáveis e a contagem de cada uma', () => {
    const layers = listDxfLayers(mixedLayersDxf);

    expect(layers).toEqual(
      expect.arrayContaining([
        { name: 'BAIRRO', polygonCount: 1 },
        { name: 'LOTES', polygonCount: 2 },
      ]),
    );
  });

  it('importa somente as camadas selecionadas quando "layers" é informado', () => {
    const result = parseDxf(mixedLayersDxf, { utmZone: 22, utmHemisphere: 'S', layers: ['LOTES'] });

    expect(result.polygons).toHaveLength(2);
    expect(result.polygons.every((polygon) => polygon.properties.name === 'LOTES')).toBe(true);
    expect(result.ignoredCount).toBe(1);
  });
});
