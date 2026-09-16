import type * as GeoJSON from 'geojson';

import type { PolygonGeometry } from '../../types/polygon';

export interface Vertex {
  position: GeoJSON.Position;
  partIndex: number;
  ringIndex: number;
  vertexIndex: number;
}

const samePosition = (first: GeoJSON.Position, second: GeoJSON.Position): boolean =>
  first.length === second.length && first.every((coordinate, index) => coordinate === second[index]);

export const hasAtLeastThreeDistinctPositions = (ring: GeoJSON.Position[]): boolean =>
  new Set(ring.slice(0, -1).map((position) => position.join(','))).size >= 3;

const isValidRing = (ring: GeoJSON.Position[]): boolean =>
  ring.length >= 4 && samePosition(ring[0], ring[ring.length - 1]) && hasAtLeastThreeDistinctPositions(ring);

const ringsForGeometry = (geometry: PolygonGeometry): GeoJSON.Position[][][] =>
  geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

export const isValidPolygonGeometry = (geometry: PolygonGeometry): boolean =>
  ringsForGeometry(geometry).length > 0 && ringsForGeometry(geometry).every((polygon) => polygon.length > 0 && polygon.every(isValidRing));

export const listVertices = (geometry: PolygonGeometry): Vertex[] =>
  ringsForGeometry(geometry).flatMap((polygon, partIndex) =>
    polygon.flatMap((ring, ringIndex) =>
      ring.slice(0, -1).map((position, vertexIndex) => ({ position, partIndex, ringIndex, vertexIndex })),
    ),
  );

export const vertexLabel = (index: number): string => {
  let value = index + 1;
  let label = '';

  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }

  return label;
};
