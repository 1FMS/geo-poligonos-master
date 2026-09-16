import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import L from 'leaflet';
import { MapContainer, useMap } from 'react-leaflet';
import { StrictMode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PolygonProvider, usePolygons } from '../../app/PolygonProvider';
import type { PolygonGeometry } from '../../types/polygon';
import { createPolygonEntity } from './leafletGeometry';
import { GeomanController } from './GeomanController';
import { PolygonLayer } from './PolygonLayer';
import { PolygonPicker } from './PolygonPicker';
import { Toolbar } from '../Toolbar/Toolbar';

let map: L.Map;
let store: ReturnType<typeof usePolygons>;
const triangle: PolygonGeometry = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]] };
beforeAll(() => { Object.defineProperty(L.Browser, 'svg', { value: true, configurable: true }); });
afterEach(cleanup);
function Capture() {
  map = useMap();
  store = usePolygons();
  return <>{store.polygons.map(polygon => <PolygonLayer key={polygon.id} polygon={polygon} />)}</>;
}
function Editor() {
  return (
    <PolygonProvider>
      <Toolbar />
      <MapContainer center={[0, 0]} zoom={5}>
        <Capture />
        <GeomanController />
        <PolygonPicker />
      </MapContainer>
    </PolygonProvider>
  );
}
const polygonLayers = () => {
  const layers: L.Polygon[] = [];
  map.eachLayer(layer => { if (layer instanceof L.Polygon) layers.push(layer); });
  return layers;
};

describe('Geoman integration with real Leaflet layers and provider', () => {
  it('starts drawing, creates and selects one entity, then removes the transient layer and stops drawing', () => {
    render(<StrictMode><Editor /></StrictMode>);
    fireEvent.click(screen.getByRole('button', { name: 'Criar polígono' }));
    expect(map.pm.globalDrawModeEnabled()).toBe(true);
    const layer = L.polygon([[0, 0], [0, 1], [1, 0]]).addTo(map);
    act(() => { map.fire('pm:create', { shape: 'Polygon', layer }); });
    expect(store.polygons).toHaveLength(1);
    expect(store.polygons[0].geometry).toEqual(triangle);
    expect(store.selectedPolygonId).toBe(store.polygons[0].id);
    expect(store.drawingMode).toBe(false);
    expect(map.pm.globalDrawModeEnabled()).toBe(false);
    expect(map.hasLayer(layer)).toBe(false);
    expect(polygonLayers()).toHaveLength(1);
  });

  it('rejects invalid creation with visible feedback and leaves the store unchanged', () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole('button', { name: 'Criar polígono' }));
    const layer = L.polygon([[0, 0], [0, 1]]).addTo(map);
    act(() => { map.fire('pm:create', { shape: 'Polygon', layer }); });
    expect(store.polygons).toHaveLength(0);
    expect(map.hasLayer(layer)).toBe(false);
    expect(screen.getByRole('alert')).toHaveTextContent('ao menos três vértices distintos');
  });

  it('selects entities independently and enables editing only on every selected multipart layer', () => {
    render(<Editor />);
    const first = createPolygonEntity(triangle);
    const second = createPolygonEntity({ type: 'MultiPolygon', coordinates: [triangle.coordinates, [[[5, 5], [8, 5], [5, 8], [5, 5]]]] });
    act(() => { store.addPolygon(first); store.addPolygon(second); store.setEditing(second.id); });
    const layers = polygonLayers();
    expect(layers).toHaveLength(3);
    expect(layers.map(layer => layer.pm.enabled())).toEqual([false, true, true]);
    expect(layers[0].options.color).not.toBe('#f59e0b');
    expect(layers[1].options.color).toBe('#f59e0b');
    // Selection now resolves purely from the map click's coordinates (so the
    // smallest polygon containing the point wins, even when nested), rather
    // than from whichever layer's DOM node happened to receive the event —
    // so the click is simulated on the map itself, as a real click would
    // ultimately be routed regardless of which path was hit.
    act(() => { map.fire('click', { latlng: L.latLng(0.2, 0.2) }); });
    expect(store.selectedPolygonId).toBe(first.id);
    expect(layers.map(layer => layer.pm.enabled())).toEqual([false, false, false]);
    expect(layers[0].options.weight).toBe(5);
  });

  it('updates geometry and area through vertex events and keeps invalid edits out of the store', () => {
    render(<Editor />);
    const entity = createPolygonEntity(triangle);
    act(() => { store.addPolygon(entity); store.setEditing(entity.id); });
    const beforeArea = store.polygons[0].calculated.areaSquareMeters;
    act(() => { const layer = polygonLayers()[0]; layer.setLatLngs([[0, 0], [0, 2], [1, 0]]); layer.fire('pm:edit'); });
    expect(store.polygons[0].calculated.areaSquareMeters).toBeCloseTo(beforeArea * 2, 0);
    const valid = store.polygons[0];
    act(() => { const layer = polygonLayers()[0]; layer.setLatLngs([[0, 0], [0, 2]]); layer.fire('pm:vertexremoved'); });
    expect(store.polygons[0]).toBe(valid);
    expect(polygonLayers()[0].toGeoJSON(false).geometry).toEqual(valid.geometry);
    expect(screen.getByRole('alert')).toHaveTextContent('ao menos três vértices distintos');
  });

  it('cancels drawing from the button and removes event listeners on unmount', () => {
    const view = render(<Editor />);
    fireEvent.click(screen.getByRole('button', { name: 'Criar polígono' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar desenho' }));
    expect(store.drawingMode).toBe(false);
    expect(map.pm.globalDrawModeEnabled()).toBe(false);
    view.unmount();
    const listens = map.listens as (event: string) => boolean;
    expect(listens.call(map, 'pm:create')).toBe(false);
  });

  it('explains why a real Geoman marker cannot remove the third vertex', () => {
    render(<Editor />);
    const entity = createPolygonEntity(triangle);
    act(() => { store.addPolygon(entity); store.setEditing(entity.id); });
    let vertex: L.Marker | undefined;
    map.eachLayer(layer => {
      if (layer instanceof L.Marker && layer.getLatLng().equals([0, 0])) vertex = layer;
    });
    expect(vertex).toBeDefined();
    act(() => { vertex!.fire('contextmenu'); });
    expect(store.polygons[0]).toBe(entity);
    expect(polygonLayers()[0].toGeoJSON(false).geometry).toEqual(triangle);
    expect(screen.getByRole('alert')).toHaveTextContent('ao menos três vértices distintos');
  });
});
