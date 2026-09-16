import { DrawPolygonButton } from './DrawPolygonButton';
import { ImportKmlButton } from './ImportKmlButton';

export function Toolbar() {
  return (
    <div className="toolbar" role="group" aria-label="Ferramentas do mapa">
      <DrawPolygonButton />
      <ImportKmlButton />
    </div>
  );
}
