import type { AppState, PolygonEntity, PolygonGeometry } from '../types/polygon';

export const initialState: AppState = {
  polygons: [],
  selectedPolygonId: null,
  editingPolygonId: null,
  drawingMode: false,
};

export type PolygonAction =
  | { type: 'polygon/added'; polygon: PolygonEntity }
  | { type: 'polygons/imported'; polygons: PolygonEntity[] }
  | { type: 'properties/updated'; id: string; properties: PolygonEntity['properties'] }
  | { type: 'geometry/updated'; id: string; geometry: PolygonGeometry; areaSquareMeters: number }
  | { type: 'selected/set'; id: string | null }
  | { type: 'editing/set'; id: string | null }
  | { type: 'drawing/set'; drawingMode: boolean }
  | { type: 'selected/deleted' };

export function polygonReducer(state: AppState, action: PolygonAction): AppState {
  switch (action.type) {
    case 'polygon/added':
      return {
        ...state,
        polygons: [...state.polygons, action.polygon],
        selectedPolygonId: action.polygon.id,
      };
    case 'polygons/imported':
      return {
        ...state,
        polygons: [...state.polygons, ...action.polygons],
      };
    case 'properties/updated':
      return {
        ...state,
        polygons: state.polygons.map((polygon) =>
          polygon.id === action.id ? { ...polygon, properties: action.properties } : polygon,
        ),
      };
    case 'geometry/updated':
      return {
        ...state,
        polygons: state.polygons.map((polygon) =>
          polygon.id === action.id
            ? {
                ...polygon,
                geometry: action.geometry,
                calculated: { ...polygon.calculated, areaSquareMeters: action.areaSquareMeters },
              }
            : polygon,
        ),
      };
    case 'selected/set':
      return { ...state, selectedPolygonId: action.id, editingPolygonId: null };
    case 'editing/set':
      return { ...state, editingPolygonId: action.id };
    case 'drawing/set':
      return { ...state, drawingMode: action.drawingMode };
    case 'selected/deleted':
      return {
        ...state,
        polygons: state.polygons.filter((polygon) => polygon.id !== state.selectedPolygonId),
        selectedPolygonId: null,
        editingPolygonId: null,
      };
  }
}
