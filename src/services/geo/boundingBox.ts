import type { PolygonGeometry } from '../../types/polygon';

export type LatLngBounds = [[number, number], [number, number]];

const forEachPosition = (geometry: PolygonGeometry, visit: (lng: number, lat: number) => void): void => {
  const rings = geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat();
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      visit(lng, lat);
    }
  }
};

/** Returns [[south, west], [north, east]] covering every position in the given geometries. */
export function boundsFromGeometries(geometries: PolygonGeometry[]): LatLngBounds | null {
  let south = Infinity;
  let west = Infinity;
  let north = -Infinity;
  let east = -Infinity;

  for (const geometry of geometries) {
    forEachPosition(geometry, (lng, lat) => {
      south = Math.min(south, lat);
      west = Math.min(west, lng);
      north = Math.max(north, lat);
      east = Math.max(east, lng);
    });
  }

  if (!Number.isFinite(south) || !Number.isFinite(west)) {
    return null;
  }

  return [[south, west], [north, east]];
}
