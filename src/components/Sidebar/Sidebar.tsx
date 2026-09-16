import { usePolygons } from '../../app/PolygonProvider';
import { PolygonDetails } from './PolygonDetails';
import { PolygonList } from './PolygonList';

export function Sidebar() {
  const { polygons, selectedPolygonId } = usePolygons();
  const selected = polygons.find((polygon) => polygon.id === selectedPolygonId) ?? null;

  return selected ? <PolygonDetails polygon={selected} /> : <PolygonList polygons={polygons} />;
}
