import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { GeoJSON } from 'react-leaflet';
import type { FeatureCollection, Polygon } from 'geojson';
import { usePolygons } from '../../app/PolygonProvider';
import type { PolygonEntity } from '../../types/polygon';

// Color communicates polygon status at a glance: green means no conflict,
// a strong orange flags an overlap, and selection (amber) always wins since
// it's the user's current focus regardless of status.
const STATUS_OK_COLOR = '#16a34a';
const STATUS_OVERLAP_COLOR = '#ea580c';
const SELECTED_COLOR = '#f59e0b';
// A polygon fetched from the ONR for comparison isn't the user's own lot
// data, so it gets a fixed identity color instead of the green/orange
// conflict signal — that distinction matters more here than whether it
// happens to overlap something.
const ONR_COMPARISON_COLOR = '#2563eb';

export function PolygonLayer({ polygon, overlapping = false }: { polygon: PolygonEntity; overlapping?: boolean }) {
  const { selectedPolygonId, editingPolygonId, drawingMode } = usePolygons();
  const selected = selectedPolygonId === polygon.id;
  const editing = selectedPolygonId === polygon.id
    && editingPolygonId === polygon.id
    && !drawingMode;

  if (editing) return null;

  return <PolygonGeometryLayer polygon={polygon} overlapping={overlapping} selected={selected} />;
}

function PolygonGeometryLayer({
  polygon,
  overlapping,
  selected,
}: {
  polygon: PolygonEntity;
  overlapping: boolean;
  selected: boolean;
}) {
  const ref = useRef<L.GeoJSON>(null);
  const parts = polygon.geometry.type === 'Polygon' ? [polygon.geometry.coordinates] : polygon.geometry.coordinates;
  const data: FeatureCollection<Polygon> = {
    type: 'FeatureCollection',
    features: parts.map(coordinates => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates } })),
  };

  // Color communicates status: green for a clean polygon, strong orange for
  // one in conflict. Selection (amber) always takes priority since it marks
  // the user's current focus regardless of status.
  const statusColor = polygon.source === 'onr'
    ? ONR_COMPARISON_COLOR
    : overlapping ? STATUS_OVERLAP_COLOR : STATUS_OK_COLOR;
  const color = selected ? SELECTED_COLOR : statusColor;
  const style: L.PathOptions = {
    color,
    fillColor: color,
    weight: selected ? 5 : overlapping ? 3 : 2,
    fillOpacity: selected ? 0.34 : overlapping ? 0.3 : 0.18,
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

  return (
    <GeoJSON
      key={polygon.id}
      ref={ref}
      data={data}
      style={style}
    />
  );
}
