import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { PolygonProvider } from '../../app/PolygonProvider';

const leaflet = vi.hoisted(() => ({
  map: { on: vi.fn(), off: vi.fn(), pm: { setLang: vi.fn(), disableDraw: vi.fn() } },
  loading: undefined as undefined | (() => void),
  tileError: undefined as undefined | (() => void),
  tileLoad: undefined as undefined | (() => void),
  mapContainer: undefined as undefined | { center: number[]; zoom: number; minZoom: number },
  tileLayer: undefined as undefined | { url: string; attribution: string },
}));

vi.mock('react-leaflet', () => ({
  useMap: () => leaflet.map,
  useMapEvent: () => leaflet.map,
  MapContainer: ({
    children,
    center,
    zoom,
    minZoom,
  }: {
    children: ReactNode;
    center: number[];
    zoom: number;
    minZoom: number;
  }) => {
    leaflet.mapContainer = { center, zoom, minZoom };
    return <div data-testid="map-container">{children}</div>;
  },
  TileLayer: ({
    url,
    attribution,
    eventHandlers,
  }: {
    url: string;
    attribution: string;
    eventHandlers?: { loading?: () => void; tileerror?: () => void; load?: () => void };
  }) => {
    leaflet.loading = eventHandlers?.loading;
    leaflet.tileError = eventHandlers?.tileerror;
    leaflet.tileLoad = eventHandlers?.load;
    leaflet.tileLayer = { url, attribution };
    return <div data-testid="satellite-tiles" />;
  },
}));

describe('MapView', () => {
  it('mantém a indisponibilidade até uma nova carga limpa depois de um erro de tile', () => {
    render(<PolygonProvider><App /></PolygonProvider>);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByLabelText('Painel de polígonos')).toBeInTheDocument();
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    expect(leaflet.mapContainer).toEqual({ center: [-15.78, -47.93], zoom: 4, minZoom: 2 });
    expect(leaflet.tileLayer).toEqual({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles © Esri',
    });

    act(() => leaflet.tileError?.());

    expect(screen.getByRole('status')).toHaveTextContent('Camada de satélite indisponível.');
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByLabelText('Painel de polígonos')).toBeInTheDocument();

    act(() => leaflet.tileLoad?.());

    expect(screen.getByRole('status')).toHaveTextContent('Camada de satélite indisponível.');

    act(() => {
      leaflet.loading?.();
      leaflet.tileLoad?.();
    });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
