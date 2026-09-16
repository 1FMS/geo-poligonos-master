import { act, cleanup, render } from '@testing-library/react';
import L from 'leaflet';
import { MapContainer, useMap } from 'react-leaflet';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { PolygonLayer } from './PolygonLayer';
import { PolygonProvider, usePolygons } from '../../app/PolygonProvider';
import type { PolygonEntity } from '../../types/polygon';

let map: L.Map;
let store: ReturnType<typeof usePolygons>;
beforeAll(() => { Object.defineProperty(L.Browser, 'svg', { value: true, configurable: true }); });
afterEach(cleanup);

function Capture() {
  map = useMap();
  store = usePolygons();
  return null;
}

const makeSquare = (id: string, [x, y]: [number, number], size: number): PolygonEntity => ({
  id,
  geometry: {
    type: 'Polygon',
    coordinates: [[[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]],
  },
  properties: { name: id, description: '', createdAt: new Date().toISOString(), customFields: [] },
  calculated: { areaSquareMeters: size * size },
});

const pathFor = (polygonId: string, allEntities: PolygonEntity[]): Element | null => {
  const polygons: L.Polygon[] = [];
  map.eachLayer((layer) => { if (layer instanceof L.Polygon) polygons.push(layer); });
  const index = allEntities.findIndex((entity) => entity.id === polygonId);
  return (polygons[index]?.getElement() as Element | undefined) ?? null;
};

const mapPolygonLayers = (): L.Polygon[] => {
  const polygons: L.Polygon[] = [];
  map.eachLayer((layer) => { if (layer instanceof L.Polygon) polygons.push(layer); });
  return polygons;
};

describe('PolygonLayer overlap styling', () => {
  it('removes the dashed overlap outline once the polygon stops overlapping (not stuck from a stale style merge)', () => {
    const polygon = makeSquare('a', [0, 0], 1);

    const { rerender } = render(
      <PolygonProvider>
        <MapContainer center={[0.5, 0.5]} zoom={5}>
          <Capture />
          <PolygonLayer polygon={polygon} overlapping />
        </MapContainer>
      </PolygonProvider>,
    );

    expect(pathFor('a', [polygon])?.getAttribute('stroke-dasharray')).toBe('8 6');

    act(() => {
      rerender(
        <PolygonProvider>
          <MapContainer center={[0.5, 0.5]} zoom={5}>
            <Capture />
            <PolygonLayer polygon={polygon} overlapping={false} />
          </MapContainer>
        </PolygonProvider>,
      );
    });

    expect(pathFor('a', [polygon])?.hasAttribute('stroke-dasharray')).toBe(false);
  });
});

describe('PolygonLayer selection halo', () => {
  it('moves the selection halo class when selection changes to a different polygon', () => {
    const a = makeSquare('a', [0, 0], 1);
    const b = makeSquare('b', [5, 5], 1);

    render(
      <PolygonProvider>
        <MapContainer center={[2, 2]} zoom={3}>
          <Capture />
          <Scene />
        </MapContainer>
      </PolygonProvider>,
    );

    act(() => { store.addPolygon(a); store.addPolygon(b); store.selectPolygon(a.id); });

    expect(pathFor('a', [a, b])?.classList.contains('polygon-layer--selected')).toBe(true);
    expect(pathFor('b', [a, b])?.classList.contains('polygon-layer--selected')).toBe(false);

    act(() => { store.selectPolygon(b.id); });

    expect(pathFor('a', [a, b])?.classList.contains('polygon-layer--selected')).toBe(false);
    expect(pathFor('b', [a, b])?.classList.contains('polygon-layer--selected')).toBe(true);
  });
});

describe('PolygonLayer during Terra Draw editing', () => {
  it('hides the selected polygon from Leaflet while Terra Draw owns its edit session', () => {
    const polygon = makeSquare('editing', [0, 0], 1);

    render(
      <PolygonProvider>
        <MapContainer center={[0.5, 0.5]} zoom={5}>
          <Capture />
          <PolygonLayer polygon={polygon} />
        </MapContainer>
      </PolygonProvider>,
    );

    act(() => {
      store.selectPolygon(polygon.id);
      store.setEditing(polygon.id);
    });

    expect(mapPolygonLayers()).toHaveLength(0);
  });

  it('restores the Leaflet layer with its normal identity style when editing ends', () => {
    const polygon = makeSquare('editing', [0, 0], 1);

    render(
      <PolygonProvider>
        <MapContainer center={[0.5, 0.5]} zoom={5}>
          <Capture />
          <PolygonLayer polygon={polygon} />
        </MapContainer>
      </PolygonProvider>,
    );

    act(() => {
      store.selectPolygon(polygon.id);
      store.setEditing(polygon.id);
    });
    expect(mapPolygonLayers()).toHaveLength(0);

    act(() => { store.setEditing(null); });

    const path = mapPolygonLayers()[0]?.getElement();
    expect(path).not.toBeNull();
    expect(path?.getAttribute('stroke')).toBe('#f59e0b');
    expect(path?.getAttribute('stroke-width')).toBe('5');
    expect(path?.classList.contains('polygon-layer--selected')).toBe(true);
  });
});

function Scene() {
  const { polygons } = usePolygons();
  return <>{polygons.map((polygon) => <PolygonLayer key={polygon.id} polygon={polygon} />)}</>;
}
