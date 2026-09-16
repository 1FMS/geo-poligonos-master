import { useState } from 'react';
import { MapContainer } from 'react-leaflet';
import { MapStatus } from './MapStatus';
import { SatelliteLayer } from './SatelliteLayer';
import { usePolygons } from '../../app/PolygonProvider';
import { PolygonLayer } from './PolygonLayer';
import { TerraDrawController } from './TerraDrawController';
import { MapFocusController } from './MapFocusController';
import { PolygonPicker } from './PolygonPicker';
import { OverlapHighlight } from './OverlapHighlight';

export function MapView() {
  const { polygons, overlappingPolygonIds } = usePolygons();
  const [satelliteAvailable, setSatelliteAvailable] = useState(true);

  return (
    <section className="map-view" aria-label="Mapa de satélite">
      <MapContainer
        center={[-15.78, -47.93]}
        zoom={4}
        minZoom={2}
        maxZoom={24}
        zoomSnap={0.25}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={90}
        className="map"
      >
        <SatelliteLayer onAvailabilityChange={setSatelliteAvailable} />
        {polygons.map(polygon => (
          <PolygonLayer key={polygon.id} polygon={polygon} overlapping={overlappingPolygonIds.has(polygon.id)} />
        ))}
        <OverlapHighlight />
        <TerraDrawController />
        <MapFocusController />
        <PolygonPicker />
      </MapContainer>
      <MapStatus satelliteAvailable={satelliteAvailable} />
    </section>
  );
}
