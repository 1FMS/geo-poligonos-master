import { describe, expect, it } from 'vitest';

import { findSmallestPolygonAt } from './findSmallestPolygonAt';
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

describe('findSmallestPolygonAt', () => {
  it('escolhe o lote em vez do bairro/quadra quando os três contêm o ponto clicado', () => {
    const bairro = makeSquareEntity('bairro', [0, 0], 10);
    const quadra = makeSquareEntity('quadra', [2, 2], 4);
    const lote = makeSquareEntity('lote', [3, 3], 1);

    const match = findSmallestPolygonAt([bairro, quadra, lote], [3.5, 3.5]);

    expect(match?.id).toBe('lote');
  });

  it('encontra o resultado independentemente da ordem de renderização/array', () => {
    const bairro = makeSquareEntity('bairro', [0, 0], 10);
    const quadra = makeSquareEntity('quadra', [2, 2], 4);
    const lote = makeSquareEntity('lote', [3, 3], 1);

    const match = findSmallestPolygonAt([lote, bairro, quadra], [3.5, 3.5]);

    expect(match?.id).toBe('lote');
  });

  it('retorna o único polígono que contém o ponto quando não há aninhamento', () => {
    const a = makeSquareEntity('a', [0, 0], 1);
    const b = makeSquareEntity('b', [10, 10], 1);

    expect(findSmallestPolygonAt([a, b], [0.5, 0.5])?.id).toBe('a');
  });

  it('retorna null quando nenhum polígono contém o ponto', () => {
    const a = makeSquareEntity('a', [0, 0], 1);

    expect(findSmallestPolygonAt([a], [50, 50])).toBeNull();
  });
});
