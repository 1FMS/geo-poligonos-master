import { describe, expect, it } from 'vitest';

import { describeOnrMatches } from './compareOnrCandidates';
import { calculateAreaSquareMeters } from '../geo/calculateArea';
import type { PolygonEntity } from '../../types/polygon';

const makeSquareEntity = (name: string, [x, y]: [number, number], size: number): PolygonEntity => {
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
    id: name,
    geometry,
    properties: { name, description: '', createdAt: new Date().toISOString(), customFields: [] },
    calculated: { areaSquareMeters: calculateAreaSquareMeters(geometry) },
  };
};

describe('describeOnrMatches', () => {
  it('reporta alta % de sobreposição quando o candidato praticamente coincide com o lote', () => {
    const selected = makeSquareEntity('LOTE', [0, 0], 0.001);
    const candidate = makeSquareEntity('ONR - matrícula 8207', [0, 0], 0.001);

    const [match] = describeOnrMatches(selected, [candidate]);

    expect(match.candidate).toBe(candidate);
    expect(match.overlapPercentOfSelected).toBeGreaterThan(95);
  });

  it('reporta 0% quando o candidato não toca o lote', () => {
    const selected = makeSquareEntity('LOTE', [0, 0], 0.001);
    const candidate = makeSquareEntity('ONR - matrícula 9999', [10, 10], 0.001);

    const [match] = describeOnrMatches(selected, [candidate]);

    expect(match.overlapPercentOfSelected).toBe(0);
  });

  it('devolve um resultado por candidato, na mesma ordem recebida', () => {
    const selected = makeSquareEntity('LOTE', [0, 0], 0.001);
    const near = makeSquareEntity('ONR - matrícula 1', [0, 0], 0.001);
    const far = makeSquareEntity('ONR - matrícula 2', [10, 10], 0.001);

    const matches = describeOnrMatches(selected, [far, near]);

    expect(matches.map((match) => match.candidate.properties.name)).toEqual([
      'ONR - matrícula 2',
      'ONR - matrícula 1',
    ]);
  });
});
