import L from 'leaflet';
import type { PolygonEntity, PolygonGeometry } from '../../types/polygon';
import { calculateAreaSquareMeters } from '../../services/geo/calculateArea';
import { isValidPolygonGeometry } from '../../services/geo/polygonUtils';

export class InvalidPolygonGeometryError extends Error {
  constructor() {
    super('O polígono precisa manter ao menos três vértices distintos.');
    this.name = 'InvalidPolygonGeometryError';
  }
}

function validateGeometry(geometry: unknown): asserts geometry is PolygonGeometry {
  try {
    const candidate = geometry as PolygonGeometry;
    if (!candidate || !['Polygon', 'MultiPolygon'].includes(candidate.type) || !isValidPolygonGeometry(candidate)) {
      throw new InvalidPolygonGeometryError();
    }
  } catch {
    throw new InvalidPolygonGeometryError();
  }
}

export function layerToGeometry(layer: { toGeoJSON: (precision?: number | false) => { geometry: unknown } }): PolygonGeometry {
  const geometry = layer.toGeoJSON(false).geometry;
  validateGeometry(geometry);
  return geometry;
}

export function createPolygonEntity(geometry: PolygonGeometry): PolygonEntity {
  validateGeometry(geometry);
  return {
    id: crypto.randomUUID(),
    geometry,
    properties: { name: 'Polígono sem nome', description: '', createdAt: new Date().toISOString(), customFields: [] },
    calculated: { areaSquareMeters: calculateAreaSquareMeters(geometry) },
  };
}

/** Layers must be supplied in the original GeoJSON part order. */
export function bindPolygonEditing(
  layers: L.Polygon[],
  geometry: PolygonGeometry,
  commit: (geometry: PolygonGeometry, areaSquareMeters: number) => void,
  onError: (error: InvalidPolygonGeometryError) => void,
): () => void {
  let lastValid = geometry;
  const events = 'pm:edit pm:vertexadded pm:vertexremoved';
  const onEdit = () => {
    try {
      const parts = layers.map(layerToGeometry);
      const next: PolygonGeometry = geometry.type === 'MultiPolygon'
        ? { type: 'MultiPolygon', coordinates: parts.flatMap(part => part.type === 'Polygon' ? [part.coordinates] : part.coordinates) }
        : parts[0];
      validateGeometry(next);
      if (JSON.stringify(next) === JSON.stringify(lastValid)) return;
      const area = calculateAreaSquareMeters(next);
      lastValid = next;
      commit(next, area);
    } catch (error) {
      if (!(error instanceof InvalidPolygonGeometryError)) throw error;
      const parts = lastValid.type === 'Polygon' ? [lastValid.coordinates] : lastValid.coordinates;
      layers.forEach((layer, index) => {
        layer.setLatLngs(L.GeoJSON.coordsToLatLngs(parts[index], 1));
        layer.pm?.disable();
        layer.pm?.enable({ snappable: false, removeLayerBelowMinVertexCount: false });
      });
      onError(error);
    }
  };
  layers.forEach(layer => layer.on(events, onEdit));
  return () => layers.forEach(layer => layer.off(events, onEdit));
}
