import DxfParser from 'dxf-parser';
import type { IEntity } from 'dxf-parser';
import { feature } from '@turf/helpers';
import center from '@turf/center';

import { calculateAreaSquareMeters } from '../geo/calculateArea';
import { isValidPolygonGeometry } from '../geo/polygonUtils';
import { fromUtm } from '../geo/coordinateConverter';
import { geometryHasSelfIntersection, repairSelfIntersectingPolygon } from '../geo/repairSelfIntersection';
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
  if (!isValidPolygonGeometry(geometry)) return null;

  // CAD-digitized lot boundaries occasionally have vertices out of order,
  // producing a "bowtie" (self-intersecting) ring that renders and computes
  // an area fine but that Terra Draw's own geometry validation rejects
  // outright when the entity is later opened for editing. Attempt a
  // conservative repair here, at import time, rather than surfacing an
  // uneditable polygon later with no clear explanation.
  if (geometryHasSelfIntersection(geometry)) {
    return repairSelfIntersectingPolygon(geometry);
  }

  return geometry;
};

// CAD lot drawings commonly repeat a lot's boundary across more than one
// layer (e.g. an outline layer and a separate hatch/fill layer tracing the
// same shape), and the layer-name heuristic above matches every layer
// containing "lote" — so a single physical lot can otherwise be imported
// two or three times, stacked on top of itself. Two entities with the same
// area and centroid to this precision are the same lot traced twice, not
// two distinct (if coincidentally similar) lots.
const DUPLICATE_AREA_PRECISION = 2; // m², i.e. matches to the nearest cm²
const DUPLICATE_CENTROID_PRECISION = 6; // degrees, ~0.1 m

const polygonSignature = (geometry: PolygonGeometry, areaSquareMeters: number): string => {
  const centroid = center(feature(geometry)).geometry.coordinates;
  return [
    areaSquareMeters.toFixed(DUPLICATE_AREA_PRECISION),
    centroid[0].toFixed(DUPLICATE_CENTROID_PRECISION),
    centroid[1].toFixed(DUPLICATE_CENTROID_PRECISION),
  ].join('|');
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
  const seenSignatures = new Set<string>();
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

    const entityToAdd = buildEntity(geometry, entity.layer);
    const signature = polygonSignature(geometry, entityToAdd.calculated.areaSquareMeters);
    if (seenSignatures.has(signature)) {
      ignoredCount += 1;
      continue;
    }
    seenSignatures.add(signature);

    polygons.push(entityToAdd);
  }

  if (polygons.length === 0) {
    throw new NoSupportedGeometryError();
  }

  return { polygons, ignoredCount };
}
