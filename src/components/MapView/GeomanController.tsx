import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import { usePolygons } from '../../app/PolygonProvider';
import { createPolygonEntity, InvalidPolygonGeometryError, layerToGeometry } from './leafletGeometry';

export function GeomanController() {
  const map = useMap();
  const actions = usePolygons();
  const current = useRef(actions);
  current.current = actions;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    map.pm.setLang('pt_br');
    const onCreate = (event: L.LeafletEvent & { layer: L.Layer }) => {
      try {
        if (!(event.layer instanceof L.Polygon)) throw new InvalidPolygonGeometryError();
        current.current.addPolygon(createPolygonEntity(layerToGeometry(event.layer)));
        setError(null);
      } catch (cause) {
        if (!(cause instanceof InvalidPolygonGeometryError)) throw cause;
        setError(cause.message);
      } finally {
        map.removeLayer(event.layer);
        map.pm.disableDraw();
        current.current.setDrawing(false);
      }
    };
    const onDrawToggle: L.PM.GlobalDrawModeToggledEventHandler = (event) => {
      if (!event.enabled) current.current.setDrawing(false);
    };
    map.on('pm:create', onCreate);
    map.on('pm:globaldrawmodetoggled', onDrawToggle);
    return () => {
      map.off('pm:create', onCreate);
      map.off('pm:globaldrawmodetoggled', onDrawToggle);
      map.pm.disableDraw();
    };
  }, [map]);

  useEffect(() => {
    if (actions.drawingMode) {
      setError(null);
      map.pm.enableDraw('Polygon', { snappable: false });
    } else {
      map.pm.disableDraw();
    }
  }, [map, actions.drawingMode]);

  return error ? <p className="map-status" role="alert">{error}</p> : null;
}
