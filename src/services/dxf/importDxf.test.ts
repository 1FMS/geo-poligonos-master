import { describe, expect, it } from 'vitest';

import { NoSupportedGeometryError } from '../kml/importKml';
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

// Same lot boundary traced twice on two different "lote"-matching layers —
// a common CAD authoring pattern (outline layer + hatch/fill layer) that
// would otherwise double-import every lot.
const duplicateLotDxf = [
  '0', 'SECTION',
  '2', 'ENTITIES',
  '0', 'LWPOLYLINE',
  '8', 'LOTES',
  '90', '4',
  '70', '1',
  '10', '500000', '20', '7402000',
  '10', '500100', '20', '7402000',
  '10', '500100', '20', '7402100',
  '10', '500000', '20', '7402100',
  '0', 'LWPOLYLINE',
  '8', 'LOTES_HACHURA',
  '90', '4',
  '70', '1',
  '10', '500000', '20', '7402000',
  '10', '500100', '20', '7402000',
  '10', '500100', '20', '7402100',
  '10', '500000', '20', '7402100',
  '0', 'ENDSEC',
  '0', 'EOF',
].join('\n');

// Vertices out of order — (500100,7402000) and (500100,7402100) swapped —
// producing a self-intersecting ("bowtie") ring instead of a simple square.
const selfIntersectingDxf = [
  '0', 'SECTION',
  '2', 'ENTITIES',
  '0', 'LWPOLYLINE',
  '8', 'Talhao 1',
  '90', '4',
  '70', '1',
  '10', '500000', '20', '7402000',
  '10', '500100', '20', '7402100',
  '10', '500100', '20', '7402000',
  '10', '500000', '20', '7402100',
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

  it('descarta o mesmo lote traçado em duas camadas diferentes (contorno + hachura)', () => {
    const result = parseDxf(duplicateLotDxf, {
      utmZone: 22,
      utmHemisphere: 'S',
      layers: ['LOTES', 'LOTES_HACHURA'],
    });

    expect(result.polygons).toHaveLength(1);
    expect(result.ignoredCount).toBe(1);
  });

  it('descarta (em vez de travar) uma polilinha com vértices fora de ordem formando um laço autointersectante grave', () => {
    // The area lost by resolving the bowtie would be too large (~50%) to
    // silently "fix" — a real lot boundary should never be trimmed that
    // much automatically, so the entity is dropped instead of imported
    // half-shaped or handed to the geometry editor broken. With no other
    // geometry in the file, that leaves nothing importable at all.
    expect(() => parseDxf(selfIntersectingDxf, { utmZone: 22, utmHemisphere: 'S' }))
      .toThrow(NoSupportedGeometryError);
  });
});
