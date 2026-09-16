import { act, render, screen, within } from '@testing-library/react';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';
import { PolygonProvider, usePolygons } from './app/PolygonProvider';
import type { PolygonEntity } from './types/polygon';

// Mirrors the mocking approach used in MapView.test.tsx: react-leaflet is mocked
// entirely so the map renders without a real Leaflet/DOM canvas, and geometry
// changes are driven directly through the store (as GeomanController.test.tsx
// does with `store.updateGeometry`) instead of simulating real Geoman drawing.
const leaflet = vi.hoisted(() => ({
  map: { on: vi.fn(), off: vi.fn(), pm: { setLang: vi.fn(), disableDraw: vi.fn(), enableDraw: vi.fn() } },
}));

vi.mock('react-leaflet', () => ({
  useMap: () => leaflet.map,
  useMapEvent: () => leaflet.map,
  MapContainer: ({ children }: { children: ReactNode }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="satellite-tiles" />,
  GeoJSON: () => <div data-testid="polygon-layer" />,
}));

function buildPolygon(id: string, name: string): PolygonEntity {
  return {
    id,
    geometry: {
      type: 'Polygon',
      coordinates: [[[-46.6, -23.5], [-46.5, -23.5], [-46.5, -23.4], [-46.6, -23.5]]],
    },
    properties: {
      name,
      description: '',
      createdAt: '2026-09-15T12:00:00.000Z',
      customFields: [],
    },
    calculated: { areaSquareMeters: 10_000 },
  };
}

function Seed({ polygons }: { polygons: PolygonEntity[] }) {
  const store = usePolygons();
  // Expose the store on window so the test can drive geometry updates
  // directly, standing in for a real Geoman edit event.
  (window as unknown as { __store: ReturnType<typeof usePolygons> }).__store = store;

  useEffect(() => {
    polygons.forEach((polygon) => store.addPolygon(polygon));
    // addPolygon auto-selects the newly created entity; clear that so the
    // test starts from a clean "nothing selected" state.
    store.selectPolygon(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

function renderApp(polygons: PolygonEntity[]) {
  return render(
    <PolygonProvider>
      <Seed polygons={polygons} />
      <App />
    </PolygonProvider>,
  );
}

function getStore() {
  return (window as unknown as { __store: ReturnType<typeof usePolygons> }).__store;
}

describe('App integration', () => {
  it('coordena criação, seleção, edição, atualização geométrica e exclusão sem ações órfãs', () => {
    renderApp([buildPolygon('a', 'Fazenda Alfa'), buildPolygon('b', 'Fazenda Beta')]);

    // Nothing selected yet: no per-polygon action should be present.
    expect(screen.queryByRole('button', { name: 'Editar geometria' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Excluir polígono' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Exportar KML' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adicionar campo' })).not.toBeInTheDocument();

    // Select A.
    act(() => {
      screen.getByRole('button', { name: /Fazenda Alfa/ }).click();
    });

    const nameInput = screen.getByLabelText('Nome') as HTMLInputElement;
    expect(nameInput).toHaveValue('Fazenda Alfa');

    // Focus should move to the details heading after selection.
    expect(document.activeElement).toHaveTextContent('Fazenda Alfa');

    // Edit properties.
    act(() => {
      nameInput.focus();
    });
    (nameInput as HTMLInputElement).value = 'Fazenda Alfa Renomeada';
    act(() => {
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      nameInput.blur();
    });
    expect(screen.getByLabelText('Nome')).toHaveValue('Fazenda Alfa Renomeada');

    // Simulate a geometry update (standing in for a real Geoman edit).
    act(() => {
      getStore().updateGeometry(
        'a',
        { type: 'Polygon', coordinates: [[[-46.6, -23.5], [-46.4, -23.5], [-46.4, -23.3], [-46.6, -23.5]]] },
        50_000,
      );
    });

    expect(screen.getByText(/50\.000.*m²/)).toBeInTheDocument();

    // Delete A.
    act(() => {
      screen.getByRole('button', { name: 'Excluir polígono' }).click();
    });
    const dialog = screen.getByRole('dialog');
    act(() => {
      within(dialog).getByRole('button', { name: 'Confirmar exclusão' }).click();
    });

    // B remains, A is gone, and we're back at the list with no orphaned actions.
    expect(screen.getByRole('button', { name: /Fazenda Beta/ })).toBeInTheDocument();
    expect(screen.queryByText(/Fazenda Alfa/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar geometria' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Excluir polígono' })).not.toBeInTheDocument();

    // Focus should move to the list after the deletion.
    expect(document.activeElement).toHaveAttribute('aria-label', 'Lista de polígonos');
  });
});
