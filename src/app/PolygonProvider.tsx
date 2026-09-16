import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';
import { initialState, polygonReducer } from './polygonReducer';
import { findOverlaps, overlappingPolygonIdsFrom, type OverlapDetail } from '../services/geo/detectOverlaps';
import type { AppState, PolygonEntity, PolygonGeometry } from '../types/polygon';

interface PolygonContextValue extends AppState {
  /**
   * Computed once here per `polygons` change (not per full state change, so
   * selecting/editing don't retrigger it) instead of separately in every
   * consumer — the map view and the sidebar both need it, and each pairwise
   * check runs a real polygon-clipping operation, so doing it twice per edit
   * doubles the cost for no benefit.
   */
  overlappingPolygonIds: Set<string>;
  /** Per-pair conflict details: overlap area/percentage and the overlapping region's geometry. */
  overlapDetails: OverlapDetail[];
  addPolygon: (polygon: PolygonEntity) => void;
  importPolygons: (polygons: PolygonEntity[]) => void;
  updateProperties: (id: string, properties: PolygonEntity['properties']) => void;
  updateGeometry: (id: string, geometry: PolygonGeometry, areaSquareMeters: number) => void;
  selectPolygon: (id: string | null) => void;
  setEditing: (id: string | null) => void;
  setDrawing: (drawingMode: boolean) => void;
  deleteSelected: () => void;
}

const PolygonContext = createContext<PolygonContextValue | null>(null);

export function PolygonProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(polygonReducer, initialState);
  const overlapDetails = useMemo(() => findOverlaps(state.polygons), [state.polygons]);
  const overlappingPolygonIds = useMemo(() => overlappingPolygonIdsFrom(overlapDetails), [overlapDetails]);

  const value = useMemo<PolygonContextValue>(
    () => ({
      ...state,
      overlappingPolygonIds,
      overlapDetails,
      addPolygon: (polygon) => dispatch({ type: 'polygon/added', polygon }),
      importPolygons: (polygons) => dispatch({ type: 'polygons/imported', polygons }),
      updateProperties: (id, properties) => dispatch({ type: 'properties/updated', id, properties }),
      updateGeometry: (id, geometry, areaSquareMeters) =>
        dispatch({ type: 'geometry/updated', id, geometry, areaSquareMeters }),
      selectPolygon: (id) => dispatch({ type: 'selected/set', id }),
      setEditing: (id) => dispatch({ type: 'editing/set', id }),
      setDrawing: (drawingMode) => dispatch({ type: 'drawing/set', drawingMode }),
      deleteSelected: () => dispatch({ type: 'selected/deleted' }),
    }),
    [state, overlappingPolygonIds, overlapDetails],
  );

  return <PolygonContext.Provider value={value}>{children}</PolygonContext.Provider>;
}

export function usePolygons(): PolygonContextValue {
  const context = useContext(PolygonContext);

  if (!context) {
    throw new Error('usePolygons must be used within a PolygonProvider');
  }

  return context;
}
