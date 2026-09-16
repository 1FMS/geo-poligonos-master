import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import type { TerraDraw, TerraDrawEventListeners } from 'terra-draw';
import { usePolygons } from '../../app/PolygonProvider';
import { createTerraDraw } from './createTerraDraw';
import { createPolygonEntity, geometryFromTerraFeature, InvalidPolygonGeometryError } from './terraDrawGeometry';

export interface TerraDrawControllerProps {
  onDrawReady?: (draw: TerraDraw) => void;
}

export function TerraDrawController({ onDrawReady }: TerraDrawControllerProps) {
  const map = useMap();
  const actions = usePolygons();
  const current = useRef(actions);
  current.current = actions;
  const ready = useRef(onDrawReady);
  ready.current = onDrawReady;
  const instance = useRef<TerraDraw | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const draw = createTerraDraw(map, {
      onInvalidGeometry: message => {
        setError(message);
        if (current.current.drawingMode) current.current.setDrawing(false);
      },
    });
    instance.current = draw;
    let creationId: string | number | undefined;
    const onFinish: TerraDrawEventListeners['finish'] = (id, context) => {
      if (context.action !== 'draw') return;
      try {
        const feature = draw.getSnapshotFeature(id);
        if (!feature) throw new InvalidPolygonGeometryError();
        const entity = createPolygonEntity(geometryFromTerraFeature(feature));
        draw.removeFeatures([id]);
        current.current.addPolygon(entity);
        setError(null);
      } catch (cause) {
        if (!(cause instanceof InvalidPolygonGeometryError)) throw cause;
        if (draw.hasFeature(id)) draw.removeFeatures([id]);
        setError(cause.message);
      } finally {
        current.current.setDrawing(false);
      }
    };
    const onChange: TerraDrawEventListeners['change'] = (ids, type, context) => {
      if (context && 'origin' in context && context.origin === 'api') return;
      if (type !== 'create') return;
      for (const id of ids) {
        const feature = draw.getSnapshotFeature(id);
        if (feature?.geometry.type === 'Polygon' && feature.properties.currentlyDrawing) {
          // Do not mutate the store inside change/create: the adapter has not
          // rendered yet and a nested styling event would leak a duplicate layer.
          creationId = id;
        }
      }
    };
    const onSelectionChange = () => setError(null);
    draw.on('finish', onFinish);
    draw.on('change', onChange);
    draw.on('select', onSelectionChange);
    draw.on('deselect', onSelectionChange);
    draw.start();
    draw.setMode('select');
    const container = map.getContainer();
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.target !== container || !current.current.drawingMode || creationId === undefined) return;
      const feature = draw.getSnapshotFeature(creationId);
      // Terra Draw ignores incomplete Enter attempts before invoking validation.
      // Only committed vertices count; the cursor preview is not a third vertex.
      if (feature?.properties.currentlyDrawing && Number(feature.properties.committedCoordinateCount) < 3) {
        setError(new InvalidPolygonGeometryError().message);
        current.current.setDrawing(false);
      }
    };
    container.addEventListener('keyup', onKeyUp);
    ready.current?.(draw);

    return () => {
      draw.off('finish', onFinish);
      draw.off('change', onChange);
      draw.off('select', onSelectionChange);
      draw.off('deselect', onSelectionChange);
      container.removeEventListener('keyup', onKeyUp);
      draw.clear();
      draw.stop();
      instance.current = null;
    };
  }, [map]);

  useEffect(() => {
    const draw = instance.current;
    if (!draw) return;
    if (actions.drawingMode) {
      setError(null);
      draw.setMode('polygon');
    } else {
      draw.setMode('select');
      const transient = draw.getSnapshot().filter(feature =>
        feature.properties.source === 'creation' || feature.properties.currentlyDrawing);
      const transientIds = transient.flatMap(feature => feature.id === undefined ? [] : [feature.id]);
      if (transientIds.length) draw.removeFeatures(transientIds);
    }
  }, [map, actions.drawingMode]);

  return error ? <p className="map-status" role="alert">{error}</p> : null;
}
