import { kml } from '@tmcw/togeojson';
import type * as GeoJSON from 'geojson';

import { calculateAreaSquareMeters } from '../geo/calculateArea';
import { isValidPolygonGeometry } from '../geo/polygonUtils';
import type { PolygonEntity, PolygonGeometry } from '../../types/polygon';

export class InvalidKmlError extends Error {
  constructor(message = 'Arquivo KML inválido ou corrompido.') {
    super(message);
    this.name = 'InvalidKmlError';
  }
}

export class NoSupportedGeometryError extends Error {
  constructor(message = 'Nenhum polígono compatível foi encontrado no arquivo.') {
    super(message);
    this.name = 'NoSupportedGeometryError';
  }
}

export interface ParseKmlResult {
  polygons: PolygonEntity[];
  ignoredCount: number;
}

const isPolygonGeometry = (geometry: GeoJSON.Geometry): geometry is PolygonGeometry =>
  (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') &&
  isValidPolygonGeometry(geometry as PolygonGeometry);

const KML_STYLE_PROPERTY_KEYS = new Set([
  'name',
  'description',
  'styleUrl',
  'styleHash',
  'styleMapHash',
  'visibility',
  'open',
  'address',
  'phoneNumber',
  'snippet',
  'tessellate',
  'extrude',
  'altitudeMode',
  'marker-color',
  'marker-size',
  'marker-symbol',
]);

// Matches every property key `@tmcw/togeojson` derives from a KML <Style>
// (PolyStyle/LineStyle/LabelStyle/IconStyle): fill(-opacity), stroke(-color|
// -opacity|-width), icon(-color|-scale|-heading|-offset|-offset-units) and
// label(-color|-scale). None of these are user data, so none belong as
// custom fields.
const KML_STYLE_PROPERTY_PATTERN = /^(fill|stroke|icon|label)(-.*)?$/;

const isKmlStyleProperty = (key: string): boolean =>
  KML_STYLE_PROPERTY_KEYS.has(key) || KML_STYLE_PROPERTY_PATTERN.test(key);

const buildEntity = (geometry: PolygonGeometry, properties: Record<string, unknown>): PolygonEntity => {
  const name = typeof properties.name === 'string' && properties.name.trim() !== '' ? properties.name : 'Polígono importado';
  const description = typeof properties.description === 'string' ? properties.description : '';
  const customFields = Object.entries(properties)
    .filter(([key]) => !isKmlStyleProperty(key))
    .map(([key, value]) => ({
      id: crypto.randomUUID(),
      key,
      label: key,
      value: String(value),
    }));

  return {
    id: crypto.randomUUID(),
    geometry,
    properties: {
      name,
      description,
      createdAt: new Date().toISOString(),
      customFields,
    },
    calculated: {
      areaSquareMeters: calculateAreaSquareMeters(geometry),
    },
  };
};

export function parseKml(text: string): ParseKmlResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/xml');

  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new InvalidKmlError();
  }

  let featureCollection: GeoJSON.FeatureCollection<GeoJSON.Geometry | null>;

  try {
    featureCollection = kml(doc);
  } catch {
    throw new InvalidKmlError();
  }

  const polygons: PolygonEntity[] = [];
  let ignoredCount = 0;

  for (const feature of featureCollection.features) {
    const geometry = feature.geometry;

    if (!geometry) {
      ignoredCount += 1;
      continue;
    }

    if (geometry.type === 'GeometryCollection') {
      for (const member of geometry.geometries) {
        if (isPolygonGeometry(member)) {
          polygons.push(buildEntity(member, feature.properties ?? {}));
        } else {
          ignoredCount += 1;
        }
      }
      continue;
    }

    if (isPolygonGeometry(geometry)) {
      polygons.push(buildEntity(geometry, feature.properties ?? {}));
    } else {
      ignoredCount += 1;
    }
  }

  if (polygons.length === 0) {
    throw new NoSupportedGeometryError();
  }

  return { polygons, ignoredCount };
}
