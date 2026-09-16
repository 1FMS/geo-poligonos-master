import proj4 from 'proj4';

import type * as GeoJSON from 'geojson';

export interface UtmCoordinate {
  easting: number;
  northing: number;
  zone: number;
  hemisphere: 'N' | 'S';
}

const utmProjection = (zone: number, hemisphere: 'N' | 'S'): string =>
  `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs${hemisphere === 'S' ? ' +south' : ''}`;

export const toUtm = (position: GeoJSON.Position): UtmCoordinate => {
  const [longitude, latitude] = position;
  const zone = Math.min(60, Math.max(1, Math.floor((longitude + 180) / 6) + 1));
  const hemisphere = latitude < 0 ? 'S' : 'N';
  const [easting, northing] = proj4('EPSG:4326', utmProjection(zone, hemisphere), [longitude, latitude]);

  return { easting, northing, zone, hemisphere };
};

/** Inverse of toUtm: projected UTM (easting, northing) -> WGS84 [longitude, latitude]. */
export const fromUtm = (easting: number, northing: number, zone: number, hemisphere: 'N' | 'S'): GeoJSON.Position =>
  proj4(utmProjection(zone, hemisphere), 'EPSG:4326', [easting, northing]) as GeoJSON.Position;
