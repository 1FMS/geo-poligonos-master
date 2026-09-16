import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import L from 'leaflet';
import { StrictMode } from 'react';
import { MapContainer, useMap } from 'react-leaflet';
import type { TerraDraw } from 'terra-draw';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PolygonProvider, usePolygons } from '../../app/PolygonProvider';
import { Toolbar } from '../Toolbar/Toolbar';
import { TerraDrawController } from './TerraDrawController';

let draw: TerraDraw;
let map: L.Map;
let store: ReturnType<typeof usePolygons>;

beforeAll(() => {
  Object.defineProperty(L.Browser, 'svg', { value: true, configurable: true });
});
afterEach(cleanup);

function Capture() {
  map = useMap();
  store = usePolygons();
  return null;
}

function Editor({ controller = true }: { controller?: boolean }) {
  return (
    <PolygonProvider>
      <Toolbar />
      <MapContainer center={[0, 0]} zoom={5}>
        <Capture />
        {controller && <TerraDrawController onDrawReady={value => { draw = value; }} />}
      </MapContainer>
    </PolygonProvider>
  );
}

function mapElement(container: HTMLElement) {
  const element = container.querySelector<HTMLElement>('.leaflet-container')!;
  Object.defineProperties(element, {
    getBoundingClientRect: { configurable: true, value: () => ({ x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }) },
    clientWidth: { configurable: true, value: 800 },
    clientHeight: { configurable: true, value: 600 },
    offsetWidth: { configurable: true, value: 800 },
    offsetHeight: { configurable: true, value: 600 },
  });
  act(() => { map.invalidateSize(); });
  return element;
}

const clickMap = (element: HTMLElement, clientX: number, clientY: number) => {
  fireEvent.pointerDown(element, { clientX, clientY, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0 });
  fireEvent.pointerUp(element, { clientX, clientY, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0 });
};

describe('Terra Draw creation with the real Leaflet adapter', () => {
  it('persists only a finished polygon, selects it and removes the transient feature', () => {
    const view = render(<StrictMode><Editor /></StrictMode>);
    const element = mapElement(view.container);
    const instance = draw;
    expect(draw.enabled).toBe(true);
    expect(draw.getMode()).toBe('select');
    fireEvent.click(screen.getByRole('button', { name: 'Criar polígono' }));
    expect(draw.getMode()).toBe('polygon');
    clickMap(element, 200, 300);
    clickMap(element, 300, 300);
    clickMap(element, 250, 200);
    expect(store.polygons).toHaveLength(0);
    expect(draw.getSnapshot().some(feature => feature.properties.currentlyDrawing)).toBe(true);
    clickMap(element, 200, 300);
    expect(store.polygons).toHaveLength(1);
    expect(store.polygons[0].geometry.type).toBe('Polygon');
    expect(store.polygons[0].calculated.areaSquareMeters).toBeGreaterThan(0);
    expect(store.selectedPolygonId).toBe(store.polygons[0].id);
    expect(store.drawingMode).toBe(false);
    expect(draw.getSnapshot()).toHaveLength(0);
    expect(view.container.querySelectorAll('.leaflet-pane path')).toHaveLength(0);
    expect(draw.getMode()).toBe('select');
    expect(draw).toBe(instance);
  });

  it('cancels a provisional drawing without deleting an editing feature', () => {
    const view = render(<Editor />);
    const element = mapElement(view.container);
    act(() => {
      draw.addFeatures([{
        id: 'polygon:existing:part:0', type: 'Feature',
        properties: { mode: 'polygon', source: 'editing', identityColor: '#246abc' },
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]] },
      }]);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar polígono' }));
    clickMap(element, 200, 300);
    clickMap(element, 300, 300);
    expect(draw.getSnapshot().some(feature => feature.properties.currentlyDrawing)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar desenho' }));
    expect(store.polygons).toHaveLength(0);
    expect(store.drawingMode).toBe(false);
    expect(draw.getMode()).toBe('select');
    expect(draw.getSnapshot().map(feature => feature.id)).toEqual(['polygon:existing:part:0']);
    expect(view.container.querySelectorAll('.leaflet-pane path')).toHaveLength(1);
    expect(view.container.querySelector('.leaflet-pane path')).toHaveAttribute('stroke', '#246abc');
  });

  it('rejects Enter with fewer than three committed vertices and clears the error on retry', () => {
    const view = render(<Editor />);
    const element = mapElement(view.container);
    fireEvent.click(screen.getByRole('button', { name: 'Criar polígono' }));
    clickMap(element, 200, 300);
    clickMap(element, 300, 300);
    fireEvent.keyUp(element, { key: 'Enter' });
    expect(screen.getByRole('alert')).toHaveTextContent('ao menos três vértices distintos');
    expect(store.polygons).toHaveLength(0);
    expect(store.drawingMode).toBe(false);
    expect(draw.getMode()).toBe('select');
    expect(draw.getSnapshot()).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Criar polígono' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('handles Enter only for an active map drawing and accepts a valid keyboard finish', () => {
    const view = render(<Editor />);
    const element = mapElement(view.container);
    fireEvent.keyUp(element, { key: 'Enter' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Criar polígono' }));
    fireEvent.keyUp(element, { key: 'Enter' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    clickMap(element, 200, 300);
    clickMap(element, 300, 300);
    fireEvent.keyUp(screen.getByRole('button', { name: 'Cancelar desenho' }), { key: 'Enter' });
    expect(store.drawingMode).toBe(true);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    clickMap(element, 250, 200);
    fireEvent.keyUp(element, { key: 'Enter' });
    expect(store.polygons).toHaveLength(1);
    expect(store.drawingMode).toBe(false);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('clears and stops its instance when the controller unmounts, then remounts without duplicate creation', () => {
    const view = render(<Editor />);
    let element = mapElement(view.container);
    fireEvent.click(screen.getByRole('button', { name: 'Criar polígono' }));
    clickMap(element, 200, 300);
    const previous = draw;
    view.rerender(<Editor controller={false} />);
    expect(previous.enabled).toBe(false);
    expect(previous.getSnapshot()).toEqual([]);
    clickMap(element, 300, 300);
    fireEvent.keyUp(element, { key: 'Enter' });
    expect(store.polygons).toHaveLength(0);
    expect(store.drawingMode).toBe(true);
    view.rerender(<Editor />);
    element = mapElement(view.container);
    expect(draw).not.toBe(previous);
    expect(draw.getMode()).toBe('polygon');
    clickMap(element, 200, 300);
    clickMap(element, 300, 300);
    clickMap(element, 250, 200);
    clickMap(element, 200, 300);
    expect(store.polygons).toHaveLength(1);
  });
});
