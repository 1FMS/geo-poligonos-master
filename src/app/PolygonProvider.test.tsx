import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PolygonProvider, usePolygons } from './PolygonProvider';
import { calculateAreaSquareMeters } from '../services/geo/calculateArea';
import type { PolygonEntity } from '../types/polygon';

const polygonGeometry = {
  type: 'Polygon' as const,
  coordinates: [[[-46.6, -23.5], [-46.5, -23.5], [-46.5, -23.4], [-46.6, -23.5]]],
};

const polygon: PolygonEntity = {
  id: 'new',
  geometry: polygonGeometry,
  properties: {
    name: 'New polygon',
    description: '',
    createdAt: '2026-09-15T12:00:00.000Z',
    customFields: [],
  },
  // Real area (not a placeholder): the overlap detector's containment-ratio
  // check compares the overlap area against this value, so it must match
  // the actual geometry for "add overlapping" below to behave correctly.
  calculated: { areaSquareMeters: calculateAreaSquareMeters(polygonGeometry) },
};

// A rectangle straddling the right half of `polygon`'s (a triangle)
// bounding box, so a genuine, substantial-width overlap exists.
const overlappingGeometry = {
  type: 'Polygon' as const,
  coordinates: [[[-46.55, -23.5], [-46.45, -23.5], [-46.45, -23.4], [-46.55, -23.4], [-46.55, -23.5]]],
};

const overlappingPolygon: PolygonEntity = {
  id: 'overlapping',
  geometry: overlappingGeometry,
  properties: { name: 'Overlapping polygon', description: '', createdAt: '2026-09-15T12:00:00.000Z', customFields: [] },
  calculated: { areaSquareMeters: calculateAreaSquareMeters(overlappingGeometry) },
};

function PolygonControls() {
  const {
    polygons,
    selectedPolygonId,
    editingPolygonId,
    drawingMode,
    overlappingPolygonIds,
    addPolygon,
    updateProperties,
    updateGeometry,
    selectPolygon,
    setEditing,
    setDrawing,
    deleteSelected,
  } = usePolygons();

  return (
    <>
      <output data-testid="polygons">{polygons.map(({ id }) => id).join(',')}</output>
      <output data-testid="name">{polygons[0]?.properties.name ?? ''}</output>
      <output data-testid="geometry">{polygons[0]?.geometry.type ?? ''}</output>
      <output data-testid="selected">{selectedPolygonId ?? ''}</output>
      <output data-testid="editing">{editingPolygonId ?? ''}</output>
      <output data-testid="drawing">{String(drawingMode)}</output>
      <output data-testid="overlapping">{Array.from(overlappingPolygonIds).sort().join(',')}</output>
      <button onClick={() => addPolygon(overlappingPolygon)}>add overlapping</button>
      <button onClick={() => addPolygon(polygon)}>add</button>
      <button
        onClick={() =>
          updateProperties(polygon.id, { ...polygon.properties, name: 'Renamed polygon' })
        }
      >
        update properties
      </button>
      <button
        onClick={() =>
          updateGeometry(
            polygon.id,
            {
              type: 'MultiPolygon',
              coordinates: [[[[ -46.6, -23.5 ], [ -46.5, -23.5 ], [ -46.5, -23.4 ], [ -46.6, -23.5 ]]]],
            },
            200,
          )
        }
      >
        update geometry
      </button>
      <button onClick={() => selectPolygon(null)}>clear selection</button>
      <button onClick={() => selectPolygon(polygon.id)}>select</button>
      <button onClick={() => setEditing(polygon.id)}>edit</button>
      <button onClick={() => setDrawing(true)}>draw</button>
      <button onClick={deleteSelected}>delete</button>
    </>
  );
}

function OutsideProviderConsumer() {
  usePolygons();
  return null;
}

describe('PolygonProvider', () => {
  it('integra todos os helpers ao estado do domínio', () => {
    render(
      <PolygonProvider>
        <PolygonControls />
      </PolygonProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'add' }));
    expect(screen.getByTestId('polygons')).toHaveTextContent('new');
    expect(screen.getByTestId('selected')).toHaveTextContent('new');
    expect(screen.getByTestId('overlapping')).toBeEmptyDOMElement();

    fireEvent.click(screen.getByRole('button', { name: 'add overlapping' }));
    expect(screen.getByTestId('overlapping')).toHaveTextContent('new,overlapping');

    // "overlapping" was just added, so it's the current selection — remove
    // it now so the rest of this flow (which exercises "new") ends with an
    // empty store, as asserted below.
    fireEvent.click(screen.getByRole('button', { name: 'delete' }));
    expect(screen.getByTestId('polygons')).toHaveTextContent('new');
    expect(screen.getByTestId('overlapping')).toBeEmptyDOMElement();

    fireEvent.click(screen.getByRole('button', { name: 'update properties' }));
    expect(screen.getByTestId('name')).toHaveTextContent('Renamed polygon');

    fireEvent.click(screen.getByRole('button', { name: 'update geometry' }));
    expect(screen.getByTestId('geometry')).toHaveTextContent('MultiPolygon');

    fireEvent.click(screen.getByRole('button', { name: 'clear selection' }));
    expect(screen.getByTestId('selected')).toBeEmptyDOMElement();

    fireEvent.click(screen.getByRole('button', { name: 'select' }));
    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'draw' }));
    expect(screen.getByTestId('editing')).toHaveTextContent('new');
    expect(screen.getByTestId('drawing')).toHaveTextContent('true');

    fireEvent.click(screen.getByRole('button', { name: 'delete' }));
    expect(screen.getByTestId('polygons')).toBeEmptyDOMElement();
    expect(screen.getByTestId('selected')).toBeEmptyDOMElement();
    expect(screen.getByTestId('editing')).toBeEmptyDOMElement();
  });

  it('lança erro claro quando usado fora do provider', () => {
    expect(() => render(<OutsideProviderConsumer />)).toThrow(
      'usePolygons must be used within a PolygonProvider',
    );
  });
});
