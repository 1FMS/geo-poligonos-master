import { parseOnrGeoJson, type ParseOnrGeoJsonResult } from './importOnrGeoJson';

export class OnrFetchError extends Error {
  constructor(message = 'Não foi possível buscar o polígono na ONR.') {
    super(message);
    this.name = 'OnrFetchError';
  }
}

const TOKEN_ENDPOINT = '/api/onr-token';
const FEATURE_SERVER_URL =
  'https://gis-mapas.onr.org.br/onrgisserver/rest/services/Hosted/imoveis_georreferenciamento/FeatureServer/0/query';
const DEGREES_PER_METER_LAT = 1 / 111_320;

interface EsriFeature {
  attributes: Record<string, unknown>;
  geometry: { rings: number[][][] };
}

const fetchToken = async (): Promise<string> => {
  const response = await fetch(TOKEN_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  const data = await response.json();
  if (!data.sucesso || !data.token) {
    throw new OnrFetchError(data.mensagem || 'Não foi possível obter o token da ONR.');
  }
  return data.token;
};

const envelopeAround = (lat: number, lon: number, radiusMeters: number) => {
  const dLat = radiusMeters * DEGREES_PER_METER_LAT;
  const dLon = dLat / Math.cos((lat * Math.PI) / 180);
  return { xmin: lon - dLon, ymin: lat - dLat, xmax: lon + dLon, ymax: lat + dLat, spatialReference: { wkid: 4326 } };
};

// Esri's `rings` array is coordinate-for-coordinate the same shape as a
// GeoJSON Polygon's `coordinates` — only the field name differs — so this is
// a relabeling, not a projection or winding-order conversion.
const esriRingsToGeoJsonGeometry = (rings: number[][][]) =>
  rings.length === 1
    ? { type: 'Polygon' as const, coordinates: rings }
    : { type: 'MultiPolygon' as const, coordinates: rings.map((ring) => [ring]) };

const queryFeatures = async (token: string, lat: number, lon: number, radiusMeters: number): Promise<EsriFeature[]> => {
  const params = new URLSearchParams({
    returnGeometry: 'true',
    where: '1=1',
    outSR: '4326',
    outFields: '*',
    inSR: '4326',
    geometry: JSON.stringify(envelopeAround(lat, lon, radiusMeters)),
    geometryType: 'esriGeometryEnvelope',
    spatialRel: 'esriSpatialRelIntersects',
    resultRecordCount: '50',
    f: 'json',
    token,
  });

  const response = await fetch(`${FEATURE_SERVER_URL}?${params}`);
  const data = await response.json();
  if (data.error) {
    throw new OnrFetchError(data.error.message ?? 'A ONR recusou a consulta.');
  }
  return data.features ?? [];
};

/** Fetches the ONR's georeferenced property polygons intersecting a small area around a point. */
export async function fetchOnrPolygonsNear(
  lat: number,
  lon: number,
  radiusMeters: number,
): Promise<ParseOnrGeoJsonResult> {
  const token = await fetchToken();
  const features = await queryFeatures(token, lat, lon, radiusMeters);

  const featureCollection = {
    type: 'FeatureCollection',
    features: features.map((feature) => ({
      type: 'Feature',
      properties: feature.attributes,
      geometry: esriRingsToGeoJsonGeometry(feature.geometry.rings),
    })),
  };

  return parseOnrGeoJson(JSON.stringify(featureCollection));
}
