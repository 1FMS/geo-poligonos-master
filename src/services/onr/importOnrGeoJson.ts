import type * as GeoJSON from 'geojson';

import { calculateAreaSquareMeters } from '../geo/calculateArea';
import { isValidPolygonGeometry } from '../geo/polygonUtils';
import type { PolygonEntity, PolygonGeometry } from '../../types/polygon';

export class InvalidOnrGeoJsonError extends Error {
  constructor(message = 'Arquivo GeoJSON da ONR inválido ou corrompido.') {
    super(message);
    this.name = 'InvalidOnrGeoJsonError';
  }
}

export class NoSupportedGeometryError extends Error {
  constructor(message = 'Nenhum polígono compatível foi encontrado no arquivo.') {
    super(message);
    this.name = 'NoSupportedGeometryError';
  }
}

export interface ParseOnrGeoJsonResult {
  polygons: PolygonEntity[];
  ignoredCount: number;
}

const isPolygonGeometry = (geometry: GeoJSON.Geometry): geometry is PolygonGeometry =>
  (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') &&
  isValidPolygonGeometry(geometry as PolygonGeometry);

const ONR_METADATA_FIELDS = ['cartorio', 'cidade', 'uf', 'url_mat'] as const;

const buildEntity = (geometry: PolygonGeometry, properties: Record<string, unknown>): PolygonEntity => {
  const matricula = typeof properties.matricula === 'string' && properties.matricula.trim() !== '' ? properties.matricula : null;
  const name = matricula ? `ONR - matrícula ${matricula}` : 'ONR - sem matrícula';

  const customFields = ONR_METADATA_FIELDS.filter((key) => properties[key] != null).map((key) => ({
    id: crypto.randomUUID(),
    key,
    label: key,
    value: String(properties[key]),
  }));

  return {
    id: crypto.randomUUID(),
    geometry,
    properties: {
      name,
      description: '',
      createdAt: new Date().toISOString(),
      customFields,
    },
    calculated: {
      areaSquareMeters: calculateAreaSquareMeters(geometry),
    },
  };
};

export function parseOnrGeoJson(text: string): ParseOnrGeoJsonResult {
  let featureCollection: GeoJSON.FeatureCollection<GeoJSON.Geometry | null>;

  try {
    featureCollection = JSON.parse(text);
  } catch {
    throw new InvalidOnrGeoJsonError();
  }

  if (!featureCollection || !Array.isArray(featureCollection.features)) {
    throw new InvalidOnrGeoJsonError();
  }

  const polygons: PolygonEntity[] = [];
  let ignoredCount = 0;

  for (const feature of featureCollection.features) {
    const geometry = feature.geometry;

    if (!geometry || !isPolygonGeometry(geometry)) {
      ignoredCount += 1;
      continue;
    }

    polygons.push(buildEntity(geometry, feature.properties ?? {}));
  }

  if (polygons.length === 0) {
    throw new NoSupportedGeometryError();
  }

  return { polygons, ignoredCount };
}
