import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import type { FeatureId, TerraDraw, TerraDrawEventListeners } from 'terra-draw';
import { usePolygons } from '../../app/PolygonProvider';
import { calculateAreaSquareMeters } from '../../services/geo/calculateArea';
import { createTerraDraw } from './createTerraDraw';
import {
  createPolygonEntity,
  featuresForPolygon,
  geometryFromEditingFeatures,
  geometryFromTerraFeature,
  INVALID_POLYGON_MESSAGE,
  InvalidPolygonGeometryError,
  type TerraPolygonFeature,
} from './terraDrawGeometry';

export interface TerraDrawControllerProps {
  onDrawReady?: (draw: TerraDraw) => void;
}

interface EditingSession {
  polygonId: string;
  featureIds: FeatureId[];
}

const isEditingFeatureFor = (polygonId: string) => (feature: TerraPolygonFeature): boolean =>
  feature.properties?.polygonId === polygonId && feature.properties?.source === 'editing';

export function TerraDrawController({ onDrawReady }: TerraDrawControllerProps) {
  const map = useMap();
  const actions = usePolygons();
  const current = useRef(actions);
  current.current = actions;
  const ready = useRef(onDrawReady);
  ready.current = onDrawReady;
  const instance = useRef<TerraDraw | null>(null);
  const editingSessionRef = useRef<EditingSession | null>(null);
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
      // Editing sync runs ahead of the creation-flow filter below: a
      // committed part edit can arrive either through a real drag (no
      // "origin" on its context) or through the public updateFeatureGeometry
      // API (origin "api", used by tests and any other programmatic caller),
      // and both must be persisted. Only a properties-only change (e.g. a
      // part becoming selected) is not a geometry edit and must be ignored.
      const session = editingSessionRef.current;
      if (session && type === 'update' && (!context || context.target !== 'properties')) {
        const stringIds = ids.map(String);
        if (session.featureIds.some(id => stringIds.includes(String(id)))) {
          const entity = current.current.polygons.find(item => item.id === session.polygonId);
          if (entity) {
            try {
              const features = draw.getSnapshot().filter(isEditingFeatureFor(session.polygonId)) as TerraPolygonFeature[];
              const geometry = geometryFromEditingFeatures(entity.geometry, features);
              current.current.updateGeometry(entity.id, geometry, calculateAreaSquareMeters(geometry));
              setError(null);
            } catch (cause) {
              if (!(cause instanceof InvalidPolygonGeometryError)) throw cause;
              // Terra Draw's own mode validation (createTerraDraw.ts) already
              // rejected the underlying store mutation and surfaced the
              // error via onInvalidGeometry; nothing further to persist.
            }
          }
          return;
        }
      }
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

  useEffect(() => {
    const draw = instance.current;
    if (!draw) return;

    const previousSession = editingSessionRef.current;
    if (previousSession) {
      draw.removeFeatures(previousSession.featureIds);
      editingSessionRef.current = null;
      // Only reassert "select" here when there is no new session to load:
      // leaving edit mode should not fight the drawing-mode effect (e.g. on
      // remount, when drawingMode may legitimately still be true).
      if (!actions.editingPolygonId && draw.getMode() !== 'select') draw.setMode('select');
    }

    const polygonId = actions.editingPolygonId;
    if (!polygonId) return;

    const entity = current.current.polygons.find(item => item.id === polygonId);
    if (!entity) return;

    const features = featuresForPolygon(entity);
    const results = draw.addFeatures(features);
    if (results.some(result => !result.valid)) {
      const addedIds = features
        .filter((_feature, index) => results[index]?.valid)
        .map(feature => feature.id)
        .filter((id): id is FeatureId => id !== undefined);
      if (addedIds.length) draw.removeFeatures(addedIds);
      setError(INVALID_POLYGON_MESSAGE);
      return;
    }

    editingSessionRef.current = {
      polygonId,
      featureIds: features.map(feature => feature.id).filter((id): id is FeatureId => id !== undefined),
    };
    if (draw.getMode() !== 'select') draw.setMode('select');
  }, [map, actions.editingPolygonId]);

  return error ? <p className="map-status" role="alert">{error}</p> : null;
}
