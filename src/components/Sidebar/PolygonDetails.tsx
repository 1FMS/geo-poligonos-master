import { useEffect, useRef, useState } from 'react';
import { usePolygons } from '../../app/PolygonProvider';
import { requestMapFocus } from '../../app/mapFocusBus';
import { toHectares, calculateAreaSquareMeters } from '../../services/geo/calculateArea';
import { downloadPolygonKml } from '../../services/kml/exportKml';
import { generatePolygonReport } from '../../services/pdf/generatePolygonReport';
import { trimPolygonOverlap } from '../../services/geo/trimOverlap';
import type { PolygonEntity } from '../../types/polygon';
import { CoordinatesTable } from './CoordinatesTable';

const numberFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
// Conflict areas can be a fraction of a m² (a real registered overlap can be
// as small as 0.05 m², per land-registry references like mapa.onr.org.br) —
// the standard 2-decimal formatter would round anything under 0.005 down to
// a bare "0", making a genuine small conflict look like it has no area.
const smallAreaFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });
const percentFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

interface PolygonDetailsProps {
  polygon: PolygonEntity;
}

export function PolygonDetails({ polygon }: PolygonDetailsProps) {
  const {
    polygons,
    selectPolygon,
    updateProperties,
    updateGeometry,
    setEditing,
    editingPolygonId,
    deleteSelected,
    overlapDetails,
  } = usePolygons();
  const [name, setName] = useState(polygon.properties.name);
  const [description, setDescription] = useState(polygon.properties.description);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [trimError, setTrimError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Only re-sync local state and reset the confirmation when the *selected
  // polygon itself* changes. Scoping this to polygon.id (instead of also
  // depending on name/description) prevents an in-flight edit — e.g.
  // blurring the Nome/Descrição fields while the delete confirmation is
  // open — from silently dismissing that confirmation via updateProperties
  // re-rendering with new name/description values.
  useEffect(() => {
    setName(polygon.properties.name);
    setDescription(polygon.properties.description);
    setConfirmingDelete(false);
    headingRef.current?.focus();
  }, [polygon.id]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => {
      dialog.close();
    };
  }, [confirmingDelete]);

  const commitName = () => {
    if (name !== polygon.properties.name) {
      updateProperties(polygon.id, { ...polygon.properties, name });
    }
  };

  const commitDescription = () => {
    if (description !== polygon.properties.description) {
      updateProperties(polygon.id, { ...polygon.properties, description });
    }
  };

  const handleDownloadReport = () => {
    try {
      setReportError(null);
      generatePolygonReport(polygon);
    } catch {
      setReportError('Não foi possível gerar o PDF. Tente novamente.');
    }
  };

  // Removes exactly the shared region from this polygon, leaving the
  // neighbor untouched — the smallest possible edit to clear the conflict,
  // as an alternative to manually nudging vertices in the geometry editor.
  const handleTrimOverlap = (otherId: string) => {
    const other = polygons.find((candidate) => candidate.id === otherId);
    if (!other) return;

    try {
      setTrimError(null);
      const geometry = trimPolygonOverlap(polygon.geometry, other.geometry);
      updateGeometry(polygon.id, geometry, calculateAreaSquareMeters(geometry));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível corrigir a sobreposição.';
      setTrimError(message);
    }
  };

  const isEditingGeometry = editingPolygonId === polygon.id;
  const areaSquareMeters = polygon.calculated.areaSquareMeters;
  const areaHectares = toHectares(areaSquareMeters);
  const displayName = polygon.properties.name || 'Polígono sem nome';
  const conflicts = overlapDetails
    .filter((detail) => detail.polygonAId === polygon.id || detail.polygonBId === polygon.id)
    .map((detail) => {
      const otherId = detail.polygonAId === polygon.id ? detail.polygonBId : detail.polygonAId;
      const percentOfThis = detail.polygonAId === polygon.id ? detail.percentOfA : detail.percentOfB;
      const other = polygons.find((candidate) => candidate.id === otherId);
      return {
        otherId,
        otherName: other?.properties.name || 'Polígono sem nome',
        areaSquareMeters: detail.areaSquareMeters,
        percentOfThis,
        geometry: detail.geometry,
      };
    });

  return (
    <div className="polygon-details">
      <button type="button" className="polygon-details__back" onClick={() => selectPolygon(null)}>
        Voltar à lista
      </button>

      <h2 ref={headingRef} tabIndex={-1} className="polygon-details__heading">
        {displayName}
      </h2>

      <p className="polygon-details__area">
        Área: {numberFormatter.format(areaSquareMeters)} m² ({numberFormatter.format(areaHectares)} ha)
      </p>

      {conflicts.length > 0 && (
        <div role="status" className="polygon-details__overlap-warning">
          <p className="polygon-details__overlap-warning-heading">
            ⚠ Sobreposição com {conflicts.length === 1 ? 'outro polígono' : `${conflicts.length} outros polígonos`}:
          </p>
          <ul className="polygon-details__overlap-list">
            {conflicts.map((conflict) => (
              <li key={conflict.otherId}>
                <strong>{conflict.otherName}</strong> — {smallAreaFormatter.format(conflict.areaSquareMeters)} m²
                sobrepostos ({percentFormatter.format(conflict.percentOfThis)}% deste polígono){' '}
                <button
                  type="button"
                  className="polygon-details__overlap-focus"
                  onClick={() => requestMapFocus([conflict.geometry])}
                >
                  Ver no mapa
                </button>{' '}
                <button
                  type="button"
                  className="polygon-details__overlap-trim"
                  disabled={isEditingGeometry}
                  onClick={() => handleTrimOverlap(conflict.otherId)}
                  title="Remove apenas a parte deste polígono que se sobrepõe ao vizinho, sem alterar o resto do contorno"
                >
                  Corrigir sobreposição
                </button>
              </li>
            ))}
          </ul>
          {trimError && (
            <p role="alert" className="polygon-details__overlap-trim-error">
              {trimError}
            </p>
          )}
        </div>
      )}

      <div className="polygon-details__actions">
        <button
          type="button"
          aria-pressed={isEditingGeometry}
          onClick={() => setEditing(isEditingGeometry ? null : polygon.id)}
        >
          {isEditingGeometry ? 'Concluir edição de geometria' : 'Editar geometria'}
        </button>

        <button type="button" onClick={() => downloadPolygonKml(polygon)}>
          Exportar KML
        </button>

        <button type="button" onClick={handleDownloadReport}>
          Baixar relatório PDF
        </button>

        <button type="button" onClick={() => setConfirmingDelete(true)}>
          Excluir polígono
        </button>
      </div>

      {reportError && (
        <p role="alert" className="polygon-details__report-error">
          {reportError}
        </p>
      )}

      <label className="field">
        Nome
        <input type="text" value={name} onChange={(event) => setName(event.target.value)} onBlur={commitName} />
      </label>

      <label className="field">
        Descrição
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          onBlur={commitDescription}
        />
      </label>

      <CoordinatesTable geometry={polygon.geometry} />

      {confirmingDelete && (
        <dialog
          ref={dialogRef}
          aria-label={`Confirmar exclusão de ${displayName}`}
          onClose={() => setConfirmingDelete(false)}
        >
          <p>
            Tem certeza que deseja excluir &quot;{displayName}&quot;? Esta ação não pode ser desfeita.
          </p>
          <div className="polygon-details__confirm-actions">
            <button type="button" onClick={() => setConfirmingDelete(false)}>
              Cancelar
            </button>
            <button type="button" onClick={deleteSelected}>
              Confirmar exclusão
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
