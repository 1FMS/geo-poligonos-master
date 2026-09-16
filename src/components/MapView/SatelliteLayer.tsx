import { useRef } from 'react';
import { TileLayer } from 'react-leaflet';

export type SatelliteSource = 'esri' | 'sentinel';

interface SourceConfig {
  url: string;
  attribution: string;
  maxNativeZoom: number;
}

const SOURCES: Record<SatelliteSource, SourceConfig> = {
  esri: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri',
    maxNativeZoom: 19,
  },
  sentinel: {
    url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
    attribution: 'Sentinel-2 cloudless 2020 © EOX IT Services GmbH (contém dados Copernicus Sentinel modificados)',
    maxNativeZoom: 14,
  },
};

interface SatelliteLayerProps {
  source: SatelliteSource;
  onAvailabilityChange: (available: boolean) => void;
}

export function SatelliteLayer({ source, onAvailabilityChange }: SatelliteLayerProps) {
  const loadingCycleHadTileError = useRef(false);
  const config = SOURCES[source];

  return (
    <TileLayer
      key={source}
      attribution={config.attribution}
      maxNativeZoom={config.maxNativeZoom}
      maxZoom={24}
      eventHandlers={{
        loading: () => {
          loadingCycleHadTileError.current = false;
        },
        tileerror: () => {
          loadingCycleHadTileError.current = true;
          onAvailabilityChange(false);
        },
        load: () => {
          if (!loadingCycleHadTileError.current) {
            onAvailabilityChange(true);
          }
        },
      }}
      url={config.url}
    />
  );
}
