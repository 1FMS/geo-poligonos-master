import { cleanup, render, waitFor } from '@testing-library/react';
import L from 'leaflet';
import { useEffect } from 'react';
import { MapContainer, useMap } from 'react-leaflet';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { TerraDraw, TerraDrawPolygonMode } from 'terra-draw';
import { TerraDrawLeafletAdapter } from 'terra-draw-leaflet-adapter';

let draw: TerraDraw | undefined;

beforeAll(() => {
  Object.defineProperty(L.Browser, 'svg', { value: true, configurable: true });
});

afterEach(() => {
  draw?.stop();
  draw = undefined;
  cleanup();
});

function Probe() {
  const map = useMap();

  useEffect(() => {
    draw = new TerraDraw({
      adapter: new TerraDrawLeafletAdapter({ lib: L, map }),
      modes: [new TerraDrawPolygonMode()],
      idStrategy: {
        isValidId: (id) => typeof id === 'string',
        getId: () => crypto.randomUUID(),
      },
    });
    draw.start();
    draw.addFeatures([{
      id: 'probe',
      type: 'Feature',
      properties: { mode: 'polygon' },
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]] },
    }]);

    return () => draw?.stop();
  }, [map]);

  return null;
}

describe('TerraDrawLeafletAdapter compatibility', () => {
  it('stores and renders a real polygon under jsdom', async () => {
    const view = render(<MapContainer center={[0, 0]} zoom={5}><Probe /></MapContainer>);

    await waitFor(() => expect(draw?.getSnapshotFeature('probe')).toBeDefined());

    expect(view.container.querySelector('.leaflet-pane path')).not.toBeNull();
    const adapterPane = [...view.container.querySelectorAll<HTMLElement>('.leaflet-pane')]
      .find((pane) => [...pane.classList].some((name) => /^leaflet-\d+-pane$/.test(name)));
    expect(adapterPane?.querySelector('path')).not.toBeNull();
  });
});
