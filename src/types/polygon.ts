import type * as GeoJSON from 'geojson';

export type PolygonGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;

export interface CustomField {
  id: string;
  key: string;
  label: string;
  value: string;
}

export interface PolygonEntity {
  id: string;
  geometry: PolygonGeometry;
  /** Where this polygon came from, when it isn't user-drawn/imported data — drives map styling (e.g. the ONR comparison overlay renders in blue). */
  source?: 'onr';
  properties: {
    name: string;
    description: string;
    createdAt: string;
    customFields: CustomField[];
  };
  calculated: {
    areaSquareMeters: number;
  };
}

export interface AppState {
  polygons: PolygonEntity[];
  selectedPolygonId: string | null;
  editingPolygonId: string | null;
  drawingMode: boolean;
}
