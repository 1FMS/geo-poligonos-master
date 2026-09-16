import type { Feature, GeoJsonProperties, Polygon } from 'geojson';
import { calculateAreaSquareMeters } from '../../services/geo/calculateArea';
import { isValidPolygonGeometry } from '../../services/geo/polygonUtils';
import type { PolygonEntity, PolygonGeometry } from '../../types/polygon';
import { colorForPolygonId } from './polygonPalette';

export const INVALID_POLYGON_MESSAGE = 'O polígono precisa manter ao menos três vértices distintos.';

export class InvalidPolygonGeometryError extends Error {
  constructor() {
    super(INVALID_POLYGON_MESSAGE);
    this.name = 'InvalidPolygonGeometryError';
  }
}

type TerraPolygonPropertyBag = Exclude<GeoJsonProperties, null>;

export interface TerraPolygonProperties extends TerraPolygonPropertyBag {
  mode: 'polygon';
  source: 'creation' | 'editing';
  identityColor: string;
  polygonId?: string;
  partIndex?: number;
}

export type TerraPolygonFeature = Feature<Polygon, TerraPolygonProperties>;

export const terraPartId = (polygonId: string, partIndex: number): string =>
  `polygon:${polygonId}:part:${partIndex}`;

function validateGeometry(geometry: unknown): asserts geometry is PolygonGeometry {
  try {
    if (!geometry || typeof geometry !== 'object') throw new InvalidPolygonGeometryError();
    const candidate = geometry as PolygonGeometry;
    if (!['Polygon', 'MultiPolygon'].includes(candidate.type) || !isValidPolygonGeometry(candidate)) {
      throw new InvalidPolygonGeometryError();
    }
  } catch {
    throw new InvalidPolygonGeometryError();
  }
}

export function geometryFromTerraFeature(feature: Feature): PolygonGeometry {
  try {
    if (!feature || feature.type !== 'Feature' || !feature.geometry || feature.geometry.type !== 'Polygon') {
      throw new InvalidPolygonGeometryError();
    }
    validateGeometry(feature.geometry);
    return feature.geometry;
  } catch {
    throw new InvalidPolygonGeometryError();
  }
}

export function createPolygonEntity(geometry: PolygonGeometry): PolygonEntity {
  validateGeometry(geometry);
  return {
    id: crypto.randomUUID(),
    geometry,
    properties: {
      name: 'Polígono sem nome',
      description: '',
      createdAt: new Date().toISOString(),
      customFields: [],
    },
    calculated: { areaSquareMeters: calculateAreaSquareMeters(geometry) },
  };
}

const clonePolygonCoordinates = (coordinates: Polygon['coordinates']): Polygon['coordinates'] =>
  coordinates.map((ring) => ring.map((position) => [...position]));

export function featuresForPolygon(entity: PolygonEntity): TerraPolygonFeature[] {
  const parts = entity.geometry.type === 'Polygon'
    ? [entity.geometry.coordinates]
    : entity.geometry.coordinates;
  const identityColor = colorForPolygonId(entity.id);

  return parts.map((coordinates, partIndex) => ({
    id: terraPartId(entity.id, partIndex),
    type: 'Feature',
    properties: {
      mode: 'polygon',
      source: 'editing',
      polygonId: entity.id,
      partIndex,
      identityColor,
    },
    geometry: { type: 'Polygon', coordinates: clonePolygonCoordinates(coordinates) },
  }));
}

export function geometryFromEditingFeatures(
  original: PolygonGeometry,
  features: TerraPolygonFeature[],
): PolygonGeometry {
  validateGeometry(original);

  const expectedPartCount = original.type === 'Polygon' ? 1 : original.coordinates.length;
  const editingFeatures = features.filter((feature) => feature.properties?.source === 'editing');
  if (editingFeatures.length !== expectedPartCount) throw new InvalidPolygonGeometryError();

  const parts: Array<Polygon['coordinates'] | undefined> = Array.from({ length: expectedPartCount });
  for (const feature of editingFeatures) {
    const partIndex = feature.properties?.partIndex;
    if (typeof partIndex !== 'number' || !Number.isInteger(partIndex) || partIndex < 0 || partIndex >= expectedPartCount || parts[partIndex]) {
      throw new InvalidPolygonGeometryError();
    }
    const partGeometry = geometryFromTerraFeature(feature);
    if (partGeometry.type !== 'Polygon') throw new InvalidPolygonGeometryError();
    parts[partIndex] = partGeometry.coordinates;
  }

  if (parts.some((part) => !part)) throw new InvalidPolygonGeometryError();
  const geometry: PolygonGeometry = original.type === 'Polygon'
    ? { type: 'Polygon', coordinates: parts[0]! }
    : { type: 'MultiPolygon', coordinates: parts as Polygon['coordinates'][] };
  validateGeometry(geometry);
  return geometry;
}
