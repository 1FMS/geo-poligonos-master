#!/usr/bin/env node
/**
 * Busca, no mapa público da ONR (mapa.onr.org.br), os polígonos de registro
 * de imóveis próximos a um ponto lat/lon e salva o resultado como GeoJSON,
 * pronto para ser importado no sistema como polígono de comparação.
 *
 * Uso:
 *   node scripts/fetch-onr-polygon.mjs <latitude> <longitude> [raioMetros] > lote-onr.geojson
 *
 * Exemplo (coordenadas em graus decimais, negativas para S/O):
 *   node scripts/fetch-onr-polygon.mjs -2.524678 -44.247602 30 > lote-onr.geojson
 */

const TOKEN_ENDPOINT = 'https://mapa.onr.org.br/paginas/mapa/ajax-renovar-token.php';
const FEATURE_SERVER_URL =
  'https://gis-mapas.onr.org.br/onrgisserver/rest/services/Hosted/imoveis_georreferenciamento/FeatureServer/0/query';
const DEFAULT_RADIUS_METERS = 25;
const DEGREES_PER_METER_LAT = 1 / 111_320;

async function fetchToken() {
  const response = await fetch(TOKEN_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  if (!response.ok) {
    throw new Error(`Falha ao obter token da ONR (HTTP ${response.status})`);
  }
  const data = await response.json();
  if (!data.sucesso || !data.token) {
    throw new Error(data.mensagem || 'Falha ao obter token da ONR');
  }
  return data.token;
}

function envelopeAround(lat, lon, radiusMeters) {
  const dLat = radiusMeters * DEGREES_PER_METER_LAT;
  const dLon = dLat / Math.cos((lat * Math.PI) / 180);
  return { xmin: lon - dLon, ymin: lat - dLat, xmax: lon + dLon, ymax: lat + dLat, spatialReference: { wkid: 4326 } };
}

// A ONR guarda os polígonos no formato Esri JSON (`rings`), que é
// estruturalmente idêntico às coordenadas de um GeoJSON Polygon — a única
// diferença de fato é o rótulo do campo.
function esriRingsToGeoJsonGeometry(rings) {
  if (rings.length === 1) {
    return { type: 'Polygon', coordinates: rings };
  }
  return { type: 'MultiPolygon', coordinates: rings.map((ring) => [ring]) };
}

async function queryFeatures(token, geometry) {
  const params = new URLSearchParams({
    returnGeometry: 'true',
    where: '1=1',
    outSR: '4326',
    outFields: '*',
    inSR: '4326',
    geometry: JSON.stringify(geometry),
    geometryType: 'esriGeometryEnvelope',
    spatialRel: 'esriSpatialRelIntersects',
    resultRecordCount: '50',
    f: 'json',
    token,
  });

  const response = await fetch(`${FEATURE_SERVER_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`Falha ao consultar a camada da ONR (HTTP ${response.status})`);
  }
  const data = await response.json();
  if (data.error) {
    throw new Error(`Erro da ONR: ${data.error.message ?? JSON.stringify(data.error)}`);
  }
  return data.features ?? [];
}

async function main() {
  const [latArg, lonArg, radiusArg] = process.argv.slice(2);
  const lat = Number(latArg);
  const lon = Number(lonArg);
  const radiusMeters = radiusArg ? Number(radiusArg) : DEFAULT_RADIUS_METERS;

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    console.error('Uso: node scripts/fetch-onr-polygon.mjs <latitude> <longitude> [raioMetros]');
    process.exit(1);
  }

  const token = await fetchToken();
  const geometry = envelopeAround(lat, lon, radiusMeters);
  const features = await queryFeatures(token, geometry);

  const featureCollection = {
    type: 'FeatureCollection',
    features: features.map((feature) => ({
      type: 'Feature',
      properties: feature.attributes,
      geometry: esriRingsToGeoJsonGeometry(feature.geometry.rings),
    })),
  };

  console.log(JSON.stringify(featureCollection, null, 2));
  console.error(`${features.length} polígono(s) encontrado(s) num raio de ${radiusMeters}m.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
