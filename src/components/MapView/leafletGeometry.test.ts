import L from 'leaflet';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PolygonGeometry } from '../../types/polygon';
import { bindPolygonEditing, createPolygonEntity, InvalidPolygonGeometryError, layerToGeometry } from './leafletGeometry';

const triangle: PolygonGeometry = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]] };
const makeLayer = (geometry: PolygonGeometry) => L.geoJSON(geometry).getLayers()[0] as L.Polygon;
afterEach(() => vi.unstubAllGlobals());

describe('Leaflet geometry adapter', () => {
  it('creates an entity with an id, date, defaults and calculated area', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'polygon-1' });
    const entity = createPolygonEntity(triangle);
    expect(entity).toMatchObject({ id: 'polygon-1', geometry: triangle, properties: { name: 'Polígono sem nome', description: '', customFields: [] } });
    expect(Number.isNaN(Date.parse(entity.properties.createdAt))).toBe(false);
    expect(entity.calculated.areaSquareMeters).toBeCloseTo(6181859072.59, 0);
  });

  it('preserves longitude/latitude, holes and multipolygon parts through real Leaflet conversion', () => {
    const geometry: PolygonGeometry = { type: 'MultiPolygon', coordinates: [triangle.coordinates, [[[5, 5], [8, 5], [5, 8], [5, 5]], [[5.2, 5.2], [5.4, 5.2], [5.2, 5.4], [5.2, 5.2]]]] };
    expect(layerToGeometry(makeLayer(geometry))).toEqual(geometry);
  });

  it('rejects invalid rings and unsupported geometry with the typed error', () => {
    expect(() => createPolygonEntity({ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [0, 0]]] })).toThrow(InvalidPolygonGeometryError);
    expect(() => layerToGeometry(L.marker([0, 0]))).toThrow(InvalidPolygonGeometryError);
  });

  it('rebuilds multipart edits in original order with holes and commits only once for repeated events', () => {
    const geometry: PolygonGeometry = { type: 'MultiPolygon', coordinates: [triangle.coordinates, [[[5, 5], [8, 5], [5, 8], [5, 5]], [[5.2, 5.2], [5.4, 5.2], [5.2, 5.4], [5.2, 5.2]]]] };
    const layers = geometry.coordinates.map(coordinates => makeLayer({ type: 'Polygon', coordinates }));
    const commit = vi.fn();
    const cleanup = bindPolygonEditing(layers, geometry, commit, vi.fn());
    layers[1].setLatLngs([[[5, 5], [5, 9], [8, 5]], [[5.2, 5.2], [5.2, 5.4], [5.4, 5.2]]]);
    layers[1].fire('pm:vertexadded');
    layers[1].fire('pm:edit');
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0][0]).toEqual({ type: 'MultiPolygon', coordinates: [triangle.coordinates, [[[5, 5], [9, 5], [5, 8], [5, 5]], [[5.2, 5.2], [5.4, 5.2], [5.2, 5.4], [5.2, 5.2]]]] });
    expect(commit.mock.calls[0][1]).toBeGreaterThan(70000000000);
    cleanup();
    layers[0].fire('pm:edit');
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('restores the latest valid geometry after invalid vertex removal without committing', () => {
    const layer = makeLayer(triangle);
    const commit = vi.fn();
    const error = vi.fn();
    const cleanup = bindPolygonEditing([layer], triangle, commit, error);
    layer.setLatLngs([[0, 0], [0, 2], [1, 0]]);
    layer.fire('pm:edit');
    layer.setLatLngs([[0, 0], [0, 2]]);
    layer.fire('pm:vertexremoved');
    expect(commit).toHaveBeenCalledTimes(1);
    expect(layer.toGeoJSON().geometry.coordinates).toEqual([[[0, 0], [2, 0], [0, 1], [0, 0]]]);
    expect(error.mock.calls[0][0]).toBeInstanceOf(InvalidPolygonGeometryError);
    cleanup();
  });
});
