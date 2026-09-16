import type { PolygonGeometry } from '../types/polygon';

type Listener = (geometries: PolygonGeometry[]) => void;

const listeners = new Set<Listener>();

/** Ephemeral UI signal (not domain state): asks the map to fit these geometries in view. */
export function requestMapFocus(geometries: PolygonGeometry[]): void {
  if (geometries.length === 0) return;
  listeners.forEach((listener) => listener(geometries));
}

export function onMapFocusRequest(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
