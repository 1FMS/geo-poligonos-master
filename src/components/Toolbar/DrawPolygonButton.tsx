import { usePolygons } from '../../app/PolygonProvider';

export function DrawPolygonButton() {
  const { drawingMode, editingPolygonId, setDrawing, setEditing } = usePolygons();
  const disabled = !drawingMode && editingPolygonId !== null;
  return (
    <button
      type="button"
      aria-pressed={drawingMode}
      disabled={disabled}
      onClick={() => {
        setEditing(null);
        setDrawing(!drawingMode);
      }}
    >
      {drawingMode ? 'Cancelar desenho' : 'Criar polígono'}
    </button>
  );
}
