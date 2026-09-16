import tokml from 'tokml';
import type * as GeoJSON from 'geojson';

import { safeFilename } from '../files/safeFilename';
import type { PolygonEntity, PolygonGeometry } from '../../types/polygon';

/**
 * Serializes a single polygon entity as KML text, encoding its geometry,
 * name, description and custom fields as a GeoJSON Feature and converting
 * that via `tokml`.
 */
export function serializePolygonKml(entity: PolygonEntity): string {
  const feature: GeoJSON.Feature<PolygonGeometry> = {
    type: 'Feature',
    geometry: entity.geometry,
    properties: {
      name: entity.properties.name,
      description: entity.properties.description,
      areaSquareMeters: entity.calculated.areaSquareMeters,
      ...Object.fromEntries(entity.properties.customFields.map((field) => [field.key || field.label, field.value])),
    },
  };

  const featureCollection: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [feature],
  };

  return tokml(featureCollection);
}

/**
 * Triggers a browser download of the given polygon entity as a KML file,
 * using a sanitized version of the polygon's name as the filename.
 */
export function downloadPolygonKml(entity: PolygonEntity): void {
  const kmlText = serializePolygonKml(entity);
  const blob = new Blob([kmlText], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFilename(entity.properties.name)}.kml`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
