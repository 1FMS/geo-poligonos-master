import { describe, expect, it } from 'vitest';

import { findOverlappingPolygonIds, findOverlaps } from './detectOverlaps';
import { calculateAreaSquareMeters } from './calculateArea';
import type { PolygonEntity } from '../../types/polygon';

const makeSquareEntity = (id: string, [x, y]: [number, number], size: number): PolygonEntity => {
  const geometry = {
    type: 'Polygon' as const,
    coordinates: [
      [
        [x, y],
        [x + size, y],
        [x + size, y + size],
        [x, y + size],
        [x, y],
      ],
    ],
  };

  return {
    id,
    geometry,
    properties: { name: id, description: '', createdAt: new Date().toISOString(), customFields: [] },
    calculated: { areaSquareMeters: calculateAreaSquareMeters(geometry) },
  };
};

describe('findOverlappingPolygonIds', () => {
  it('marca dois polígonos que se sobrepõem em área', () => {
    const a = makeSquareEntity('a', [0, 0], 1);
    const b = makeSquareEntity('b', [0.5, 0.5], 1);

    const overlapping = findOverlappingPolygonIds([a, b]);

    expect(overlapping).toEqual(new Set(['a', 'b']));
  });

  it('não marca polígonos apenas adjacentes (tocando na borda)', () => {
    const a = makeSquareEntity('a', [0, 0], 1);
    const b = makeSquareEntity('b', [1, 0], 1);

    const overlapping = findOverlappingPolygonIds([a, b]);

    expect(overlapping.size).toBe(0);
  });

  it('não marca polígonos totalmente separados', () => {
    const a = makeSquareEntity('a', [0, 0], 1);
    const b = makeSquareEntity('b', [10, 10], 1);
    const c = makeSquareEntity('c', [10.5, 10.5], 1);

    const overlapping = findOverlappingPolygonIds([a, b, c]);

    expect(overlapping).toEqual(new Set(['b', 'c']));
  });

  it('não marca um lote totalmente contido em um bairro/talhão maior', () => {
    const neighborhood = makeSquareEntity('bairro', [0, 0], 10);
    const lot = makeSquareEntity('lote', [2, 2], 1);

    const overlapping = findOverlappingPolygonIds([neighborhood, lot]);

    expect(overlapping.size).toBe(0);
  });

  it('marca quando um lote genuinamente ultrapassa o limite do bairro, não apenas contido', () => {
    const neighborhood = makeSquareEntity('bairro', [0, 0], 10);
    // Metade do lote fica fora do bairro (cruza a borda leste em x=10).
    const straddlingLot = makeSquareEntity('lote', [9.5, 2], 1);

    const overlapping = findOverlappingPolygonIds([neighborhood, straddlingLot]);

    expect(overlapping).toEqual(new Set(['bairro', 'lote']));
  });

  it('detecta uma sobreposição pequena mas real (invasão de largura perceptível)', () => {
    // Dois lotes de ~10x10 m com um erro de limite de 15 cm de largura — bem
    // maior que qualquer ruído de arredondamento de coordenadas, mas ainda
    // uma fração pequena da área total. Precisa ser sinalizado.
    const metersToDegrees = 1 / 111_320;
    const lotSizeDegrees = 10 * metersToDegrees;
    const overlapWidthDegrees = 0.15 * metersToDegrees; // 15 cm de invasão

    const lotBStartX = lotSizeDegrees - overlapWidthDegrees;
    const lotA = makeSquareEntity('lote-a', [0, 0], lotSizeDegrees);
    const lotB = makeSquareEntity('lote-b', [lotBStartX, 0], lotSizeDegrees);

    const overlapping = findOverlappingPolygonIds([lotA, lotB]);

    expect(overlapping).toEqual(new Set(['lote-a', 'lote-b']));
  });

  it('detecta conflitos bem pequenos (frações de m², < 0,1%), como faz o sistema de referência do ONR', () => {
    // Cenário calibrado para refletir os exemplos reais do mapa de
    // sobreposições do ONR (mapa.onr.org.br): conflitos de ~0,05-0,2 m²
    // continuam sendo sinalizados, não tratados como ruído.
    const metersToDegrees = 1 / 111_320;
    const lotSizeDegrees = 20 * metersToDegrees;
    const overlapWidthDegrees = 0.01 * metersToDegrees; // 1 cm de invasão em uma borda de 20 m ≈ 0,2 m²

    const lotBStartX = lotSizeDegrees - overlapWidthDegrees;
    const lotA = makeSquareEntity('lote-a', [0, 0], lotSizeDegrees);
    const lotB = makeSquareEntity('lote-b', [lotBStartX, 0], lotSizeDegrees);

    const [detail] = findOverlaps([lotA, lotB]);

    expect(detail).toBeDefined();
    expect(detail.areaSquareMeters).toBeGreaterThan(0.05);
    expect(detail.areaSquareMeters).toBeLessThan(0.5);
  });

  it('não marca lotes adjacentes por ruído numérico de escala sub-milimétrica', () => {
    // Um "erro" de 0,01 mm entre bordas é ruído de ponto flutuante puro, bem
    // abaixo de qualquer precisão de agrimensura real — não deve ser tratado
    // como conflito de limite.
    const metersToDegrees = 1 / 111_320;
    const lotSizeDegrees = 10 * metersToDegrees;
    const noiseWidthDegrees = 0.00001 * metersToDegrees; // 0,01 mm

    const lotBStartX = lotSizeDegrees - noiseWidthDegrees;
    const lotA = makeSquareEntity('lote-a', [0, 0], lotSizeDegrees);
    const lotB = makeSquareEntity('lote-b', [lotBStartX, 0], lotSizeDegrees);

    const overlapping = findOverlappingPolygonIds([lotA, lotB]);

    expect(overlapping.size).toBe(0);
  });
});

describe('findOverlaps', () => {
  it('calcula a área e o percentual do conflito em relação a cada polígono', () => {
    // b (1x1) sobrepõe metade de a (2x2): 0.5x1 de interseção = 0.5 da área
    // de a (4) e 0.5 da área de b (1).
    const a = makeSquareEntity('a', [0, 0], 2);
    const b = makeSquareEntity('b', [1.5, 0], 1);

    const [detail] = findOverlaps([a, b]);

    expect(detail.polygonAId).toBe('a');
    expect(detail.polygonBId).toBe('b');
    expect(detail.areaSquareMeters).toBeCloseTo(b.calculated.areaSquareMeters * 0.5, 0);
    expect(detail.percentOfA).toBeCloseTo((detail.areaSquareMeters / a.calculated.areaSquareMeters) * 100, 5);
    expect(detail.percentOfB).toBeCloseTo(50, 0);
  });

  it('devolve a geometria da região sobreposta para ser desenhada no mapa', () => {
    const a = makeSquareEntity('a', [0, 0], 2);
    const b = makeSquareEntity('b', [1, 0], 2);

    const [detail] = findOverlaps([a, b]);

    expect(['Polygon', 'MultiPolygon']).toContain(detail.geometry.type);
    expect(calculateAreaSquareMeters(detail.geometry)).toBeCloseTo(detail.areaSquareMeters, 5);
  });

  it('não retorna nada quando não há conflito', () => {
    const a = makeSquareEntity('a', [0, 0], 1);
    const b = makeSquareEntity('b', [10, 10], 1);

    expect(findOverlaps([a, b])).toEqual([]);
  });
});
