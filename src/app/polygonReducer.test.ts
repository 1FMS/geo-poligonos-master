import { describe, expect, it } from 'vitest';
import type * as GeoJSON from 'geojson';
import type { AppState, PolygonEntity } from '../types/polygon';
import { initialState, polygonReducer } from './polygonReducer';

const polygon: PolygonEntity = {
  id: 'new',
  geometry: {
    type: 'Polygon',
    coordinates: [[[-46.6, -23.5], [-46.5, -23.5], [-46.5, -23.4], [-46.6, -23.5]]],
  },
  properties: {
    name: 'New polygon',
    description: '',
    createdAt: '2026-09-15T12:00:00.000Z',
    customFields: [],
  },
  calculated: { areaSquareMeters: 100 },
};

const otherPolygon: PolygonEntity = {
  ...polygon,
  id: 'other',
  properties: { ...polygon.properties, name: 'Other polygon' },
};

const twoPolygonState: AppState = {
  polygons: [polygon, otherPolygon],
  selectedPolygonId: polygon.id,
  editingPolygonId: polygon.id,
  drawingMode: false,
};

describe('polygonReducer', () => {
  it('adiciona e seleciona uma nova entidade sem alterar as existentes', () => {
    const stateWithExistingPolygon: AppState = {
      ...initialState,
      polygons: [otherPolygon],
    };
    const originalPolygons = stateWithExistingPolygon.polygons;
    const originalEntity = stateWithExistingPolygon.polygons[0];
    const originalEntitySnapshot = structuredClone(originalEntity);
    const next = polygonReducer(stateWithExistingPolygon, { type: 'polygon/added', polygon });

    expect(next.polygons).toEqual([otherPolygon, polygon]);
    expect(next.polygons).not.toBe(originalPolygons);
    expect(next.polygons[0]).toBe(otherPolygon);
    expect(next.selectedPolygonId).toBe(polygon.id);
    expect(stateWithExistingPolygon.polygons).toHaveLength(1);
    expect(stateWithExistingPolygon.polygons).toEqual([originalEntitySnapshot]);
    expect(stateWithExistingPolygon.polygons[0]).toBe(originalEntity);
    expect(originalEntity).toEqual(originalEntitySnapshot);
  });

  it('importa vários polígonos de uma vez sem alterar os existentes', () => {
    const stateWithExistingPolygon: AppState = {
      ...initialState,
      polygons: [otherPolygon],
    };
    const originalPolygons = stateWithExistingPolygon.polygons;
    const originalEntity = stateWithExistingPolygon.polygons[0];
    const originalEntitySnapshot = structuredClone(originalEntity);
    const importedPolygon = { ...polygon, id: 'imported' };

    const next = polygonReducer(stateWithExistingPolygon, {
      type: 'polygons/imported',
      polygons: [importedPolygon, polygon],
    });

    expect(next.polygons).toEqual([otherPolygon, importedPolygon, polygon]);
    expect(next.polygons).not.toBe(originalPolygons);
    expect(next.polygons[0]).toBe(otherPolygon);
    expect(stateWithExistingPolygon.polygons).toHaveLength(1);
    expect(stateWithExistingPolygon.polygons).toEqual([originalEntitySnapshot]);
    expect(stateWithExistingPolygon.polygons[0]).toBe(originalEntity);
  });

  it('exclui somente o selecionado e encerra sua edição', () => {
    const next = polygonReducer(twoPolygonState, { type: 'selected/deleted' });

    expect(next.polygons.map(({ id }) => id)).toEqual(['other']);
    expect(next.selectedPolygonId).toBeNull();
    expect(next.editingPolygonId).toBeNull();
  });

  it('substitui apenas a geometria da entidade alvo', () => {
    const geometry: GeoJSON.MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [[[[ -46.6, -23.5 ], [ -46.5, -23.5 ], [ -46.5, -23.4 ], [ -46.6, -23.5 ]]]],
    };

    const next = polygonReducer(twoPolygonState, {
      type: 'geometry/updated',
      id: polygon.id,
      geometry,
      areaSquareMeters: 200,
    });

    expect(next.polygons).toEqual([
      { ...polygon, geometry, calculated: { areaSquareMeters: 200 } },
      otherPolygon,
    ]);
  });

  it('atualiza as propriedades somente da entidade alvo', () => {
    const properties = {
      ...polygon.properties,
      name: 'Renamed polygon',
      customFields: [{ id: 'field-1', key: 'owner', label: 'Owner', value: 'Ada' }],
    };

    const next = polygonReducer(twoPolygonState, {
      type: 'properties/updated',
      id: polygon.id,
      properties,
    });

    expect(next.polygons).toEqual([{ ...polygon, properties }, otherPolygon]);
  });

  it('seleciona a entidade informada', () => {
    const next = polygonReducer(twoPolygonState, { type: 'selected/set', id: otherPolygon.id });

    expect(next.selectedPolygonId).toBe(otherPolygon.id);
  });

  it('define a entidade em edição', () => {
    const next = polygonReducer(twoPolygonState, { type: 'editing/set', id: otherPolygon.id });

    expect(next.editingPolygonId).toBe(otherPolygon.id);
  });

  it('ativa o modo de desenho', () => {
    const next = polygonReducer(twoPolygonState, { type: 'drawing/set', drawingMode: true });

    expect(next.drawingMode).toBe(true);
  });
});
