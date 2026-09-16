import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CoordinatesTable } from './CoordinatesTable';
import type { PolygonGeometry } from '../../types/polygon';

describe('CoordinatesTable', () => {
  it('mostra latitude, longitude e zona UTM formatadas para um polígono com furo', () => {
    const geometryWithHole: PolygonGeometry = {
      type: 'Polygon',
      coordinates: [
        [
          [-46.6333, -23.5505],
          [-46.6, -23.5505],
          [-46.6, -23.52],
          [-46.6333, -23.52],
          [-46.6333, -23.5505],
        ],
        [
          [-46.62, -23.54],
          [-46.61, -23.54],
          [-46.61, -23.53],
          [-46.62, -23.54],
        ],
      ],
    };

    render(<CoordinatesTable geometry={geometryWithHole} />);

    expect(screen.getByText('Coordenadas dos vértices')).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Latitude' })).toBeVisible();
    expect(screen.getAllByText('23,550500° S').length).toBeGreaterThan(0);
    expect(screen.getAllByText('46,633300° O').length).toBeGreaterThan(0);
    expect(screen.getAllByText('23 S').length).toBeGreaterThan(0);

    // Exterior ring has 4 distinct vertices, hole ring has 3 — closing point not repeated.
    expect(screen.getAllByRole('rowheader', { name: 'A' }).length).toBe(2);
    expect(screen.getByRole('rowheader', { name: 'D' })).toBeVisible();
    expect(screen.queryByRole('rowheader', { name: 'E' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(1 + 4 + 3);
  });

  it('reinicia a numeração de vértices por parte em um MultiPolygon, com prefixo "Parte N"', () => {
    const multiPolygon: PolygonGeometry = {
      type: 'MultiPolygon',
      coordinates: [
        [[[-46.7, -23.6], [-46.6, -23.6], [-46.65, -23.5], [-46.7, -23.6]]],
        [[[-47.7, -24.6], [-47.6, -24.6], [-47.65, -24.5], [-47.7, -24.6]]],
      ],
    };

    render(<CoordinatesTable geometry={multiPolygon} />);

    expect(screen.getByRole('rowheader', { name: 'Parte 1 — A' })).toBeVisible();
    expect(screen.getByRole('rowheader', { name: 'Parte 2 — A' })).toBeVisible();
    expect(screen.queryByRole('rowheader', { name: 'A' })).not.toBeInTheDocument();
  });
});
