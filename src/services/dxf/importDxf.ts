import DxfParser from 'dxf-parser';
import type { IEntity } from 'dxf-parser';

import { calculateAreaSquareMeters } from '../geo/calculateArea';
import { isValidPolygonGeometry } from '../geo/polygonUtils';
import { fromUtm } from '../geo/coordinateConverter';
import { NoSupportedGeometryError } from '../kml/importKml';
import type { PolygonEntity, PolygonGeometry } from '../../types/polygon';

export class InvalidDxfError extends Error {
  constructor(message = 'Arquivo DXF inválido ou corrompido.') {
    super(message);
    this.name = 'InvalidDxfError';
  }
}

export interface ParseDxfOptions {
  /** UTM zone (1-60) the DXF's planar X/Y coordinates are assumed to be in. */
  utmZone: number;
  utmHemisphere: 'N' | 'S';
  /** When set, only closed polylines on one of these DXF layers are imported. */
  layers?: string[];
}

export interface DxfLayerSummary {
  name: string;
  polygonCount: number;
}

export interface ParseDxfResult {
  polygons: PolygonEntity[];
  ignoredCount: number;
}

interface ClosedPolylineEntity extends IEntity {
  vertices: { x: number; y: number }[];
  shape?: boolean;
  closed?: boolean;
}

const isClosedPolylineEntity = (entity: IEntity): entity is ClosedPolylineEntity => {
  if (entity.type !== 'LWPOLYLINE' && entity.type !== 'POLYLINE') return false;
  const candidate = entity as ClosedPolylineEntity;
  return Array.isArray(candidate.vertices) && Boolean(candidate.shape || candidate.closed);
};

const toPolygonGeometry = (
  entity: ClosedPolylineEntity,
  { utmZone, utmHemisphere }: ParseDxfOptions,
): PolygonGeometry | null => {
  const positions = entity.vertices.map((vertex) => fromUtm(vertex.x, vertex.y, utmZone, utmHemisphere));
  const ring = [...positions, positions[0]];
  const geometry: PolygonGeometry = { type: 'Polygon', coordinates: [ring] };
  return isValidPolygonGeometry(geometry) ? geometry : null;
};

let importCounter = 0;

const buildEntity = (geometry: PolygonGeometry, layerName: string | undefined): PolygonEntity => {
  importCounter += 1;
  const name = layerName && layerName.trim() !== '' ? layerName : `Polígono importado ${importCounter}`;

  return {
    id: crypto.randomUUID(),
    geometry,
    properties: { name, description: '', createdAt: new Date().toISOString(), customFields: [] },
    calculated: { areaSquareMeters: calculateAreaSquareMeters(geometry) },
  };
};

const parseDocument = (text: string): ReturnType<DxfParser['parseSync']> => {
  let dxf: ReturnType<DxfParser['parseSync']>;

  try {
    dxf = new DxfParser().parseSync(text);
  } catch {
    throw new InvalidDxfError();
  }

  if (!dxf || !Array.isArray(dxf.entities)) {
    throw new InvalidDxfError();
  }

  return dxf;
};

/** Lists the DXF layers that contain at least one closed, importable polygon, with a count each. */
export function listDxfLayers(text: string): DxfLayerSummary[] {
  const dxf = parseDocument(text);
  const counts = new Map<string, number>();

  for (const entity of dxf!.entities) {
    if (!isClosedPolylineEntity(entity) || entity.vertices.length < 3) continue;
    const name = entity.layer && entity.layer.trim() !== '' ? entity.layer : '(sem camada)';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return Array.from(counts, ([name, polygonCount]) => ({ name, polygonCount }));
}

export function parseDxf(text: string, options: ParseDxfOptions): ParseDxfResult {
  const dxf = parseDocument(text);
  const allowedLayers = options.layers ? new Set(options.layers) : null;

  importCounter = 0;
  const polygons: PolygonEntity[] = [];
  let ignoredCount = 0;

  for (const entity of dxf!.entities) {
    if (!isClosedPolylineEntity(entity) || entity.vertices.length < 3) {
      ignoredCount += 1;
      continue;
    }

    if (allowedLayers && !allowedLayers.has(entity.layer ?? '(sem camada)')) {
      ignoredCount += 1;
      continue;
    }

    const geometry = toPolygonGeometry(entity, options);
    if (!geometry) {
      ignoredCount += 1;
      continue;
    }

    polygons.push(buildEntity(geometry, entity.layer));
  }

  if (polygons.length === 0) {
    throw new NoSupportedGeometryError();
  }

  return { polygons, ignoredCount };
}
