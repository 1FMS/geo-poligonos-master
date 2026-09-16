import { useEffect, useRef } from 'react';
import { usePolygons } from '../../app/PolygonProvider';
import { toHectares } from '../../services/geo/calculateArea';
import type { PolygonEntity } from '../../types/polygon';

const areaFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const squareMetersFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

interface PolygonListProps {
  polygons: PolygonEntity[];
}

export function PolygonList({ polygons }: PolygonListProps) {
  const { selectPolygon, overlappingPolygonIds } = usePolygons();
  const listRef = useRef<HTMLUListElement>(null);
  const emptyRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    (listRef.current ?? emptyRef.current)?.focus();
  }, []);

  if (polygons.length === 0) {
    return (
      <div className="sidebar-empty">
        <p ref={emptyRef} tabIndex={-1} aria-label="Lista de polígonos">
          Nenhum polígono criado ainda.
        </p>
        <p className="sidebar-empty__hint">Use “Criar polígono” no mapa para desenhar o primeiro talhão.</p>
      </div>
    );
  }

  return (
    <ul ref={listRef} tabIndex={-1} className="polygon-list" aria-label="Lista de polígonos">
      {polygons.map((polygon) => (
        <li key={polygon.id}>
          <button type="button" onClick={() => selectPolygon(polygon.id)}>
            <span className="polygon-list__name">{polygon.properties.name || 'Polígono sem nome'}</span>
            <span className="polygon-list__area">
              {squareMetersFormatter.format(polygon.calculated.areaSquareMeters)} m² ·{' '}
              {areaFormatter.format(toHectares(polygon.calculated.areaSquareMeters))} ha
            </span>
            {overlappingPolygonIds.has(polygon.id) && (
              <span className="polygon-list__overlap-badge" title="Este polígono se sobrepõe a outro">
                ⚠ Sobreposição
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
