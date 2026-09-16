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
