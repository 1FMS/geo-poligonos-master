import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

import { onMapFocusRequest } from '../../app/mapFocusBus';
import { boundsFromGeometries } from '../../services/geo/boundingBox';
import type { PolygonGeometry } from '../../types/polygon';

export function MapFocusController() {
  const map = useMap();

  useEffect(() => {
    return onMapFocusRequest((geometries: PolygonGeometry[]) => {
      const bounds = boundsFromGeometries(geometries);
      if (!bounds) return;
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 19 });
    });
  }, [map]);

  return null;
}
