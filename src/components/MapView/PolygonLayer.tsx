import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { GeoJSON } from 'react-leaflet';
import type { FeatureCollection, Polygon } from 'geojson';
import { usePolygons } from '../../app/PolygonProvider';
import type { PolygonEntity } from '../../types/polygon';
import { bindPolygonEditing, InvalidPolygonGeometryError } from './leafletGeometry';
import { hasAtLeastThreeDistinctPositions } from '../../services/geo/polygonUtils';
import { colorForPolygonId } from './polygonPalette';

export function PolygonLayer({ polygon, overlapping = false }: { polygon: PolygonEntity; overlapping?: boolean }) {
  const { selectedPolygonId, editingPolygonId, drawingMode, updateGeometry } = usePolygons();
  const ref = useRef<L.GeoJSON>(null);
  const [error, setError] = useState<string | null>(null);
  const selected = selectedPolygonId === polygon.id;
  const editing = selected && editingPolygonId === polygon.id && !drawingMode;
  const parts = polygon.geometry.type === 'Polygon' ? [polygon.geometry.coordinates] : polygon.geometry.coordinates;
  const data: FeatureCollection<Polygon> = {
    type: 'FeatureCollection',
    features: parts.map(coordinates => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates } })),
  };

  // Geometry read at bind-time only: the layer's own edits (pm:edit/vertexadded/
  // vertexremoved) already mutate these exact Leaflet layer instances, so this
  // effect intentionally does NOT depend on polygon.geometry. Re-running
  // pm.enable()/disable() on every committed vertex — which a geometry
  // dependency would cause — tears down and rebuilds Geoman's edit handles
  // after each vertex, letting the user move only one vertex before having to
  // re-enter edit mode. Binding once per edit session keeps all handles live
  // for the whole multi-vertex edit.
  const geometryRef = useRef(polygon.geometry);
  geometryRef.current = polygon.geometry;

  useEffect(() => {
    const layers = (ref.current?.getLayers() ?? []).filter((layer): layer is L.Polygon => layer instanceof L.Polygon);
    if (!editing) {
      layers.forEach(layer => layer.pm?.disable());
      return;
    }
    layers.forEach(layer => layer.pm?.enable({
      snappable: false,
      removeLayerBelowMinVertexCount: false,
      removeVertexValidation: ({ marker }) => {
        const rings = layer.getLatLngs() as L.LatLng[][];
        const position = marker.getLatLng();
        const ring = rings.find(vertices => vertices.includes(position))
          ?? rings.find(vertices => vertices.some(vertex => vertex.equals(position)));
        if (!ring) return false;
        const index = ring.findIndex(vertex => vertex.equals(position));
        const remaining = ring.filter((_, vertexIndex) => vertexIndex !== index);
        const remainingPositions = remaining.map((vertex): [number, number] => [vertex.lng, vertex.lat]);
        const closedRing = remainingPositions.length > 0 ? [...remainingPositions, remainingPositions[0]] : remainingPositions;
        if (!hasAtLeastThreeDistinctPositions(closedRing)) {
          setError(new InvalidPolygonGeometryError().message);
          return false;
        }
        return true;
      },
    }));
    const unbind = bindPolygonEditing(layers, geometryRef.current, (geometry, area) => {
      setError(null);
      updateGeometry(polygon.id, geometry, area);
    }, cause => setError(cause.message));
    return () => {
      unbind();
      layers.forEach(layer => layer.pm?.disable());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, polygon.id, updateGeometry]);

  // Stroke color always identifies the polygon itself (stable per id), so
  // polygons stay distinguishable from one another regardless of state.
  // Selection and overlap are conveyed independently — weight/glow for
  // selection, dash pattern for overlap — so all three signals can combine
  // without one erasing another.
  const identityColor = colorForPolygonId(polygon.id);
  const color = selected ? '#f59e0b' : identityColor;
  const style: L.PathOptions = {
    color,
    fillColor: color,
    weight: selected ? 5 : overlapping ? 3 : 2,
    fillOpacity: selected ? 0.34 : overlapping ? 0.22 : 0.18,
    // Leaflet's setStyle merges options in (Util.setOptions only assigns keys
    // present in the new object) rather than replacing them — an omitted key
    // keeps its previous value. dashArray must always be set explicitly
    // (including to undefined) or a polygon that stops overlapping keeps
    // rendering dashed forever.
    dashArray: overlapping ? '8 6' : undefined,
  };

  // className is applied only once, when Leaflet first creates the path DOM
  // element (_initPath) — later setStyle() calls never touch it. Selection
  // can happen long after that, so the halo class is toggled by hand on the
  // real path elements instead of being passed through the style prop.
  useEffect(() => {
    const layers = (ref.current?.getLayers() ?? []).filter((layer): layer is L.Polygon => layer instanceof L.Polygon);
    layers.forEach(layer => {
      const element = layer.getElement();
      element?.classList.toggle('polygon-layer--selected', selected);
    });
  }, [selected, polygon.id]);

  return <>
    <GeoJSON
      key={polygon.id}
      ref={ref}
      data={data}
      style={style}
    />
    {error && <p className="map-status" role="alert">{error}</p>}
  </>;
}
