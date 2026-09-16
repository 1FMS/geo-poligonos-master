import { useRef } from 'react';
import { TileLayer } from 'react-leaflet';

const ESRI_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_ATTRIBUTION = 'Tiles © Esri';
const ESRI_MAX_NATIVE_ZOOM = 19;

interface SatelliteLayerProps {
  onAvailabilityChange: (available: boolean) => void;
}

export function SatelliteLayer({ onAvailabilityChange }: SatelliteLayerProps) {
  const loadingCycleHadTileError = useRef(false);

  return (
    <TileLayer
      attribution={ESRI_ATTRIBUTION}
      maxNativeZoom={ESRI_MAX_NATIVE_ZOOM}
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
      url={ESRI_URL}
    />
  );
}
