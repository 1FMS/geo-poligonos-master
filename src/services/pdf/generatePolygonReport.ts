import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import { buildPolygonReport } from './buildPolygonReport';
import { safeFilename } from '../files/safeFilename';
import type { PolygonEntity } from '../../types/polygon';

/**
 * Generates and triggers the download of a PDF report for a single polygon
 * entity: title, name, description, area (m² and ha), a characteristics
 * table (custom fields) and a coordinates table. No map image is included.
 */
export function generatePolygonReport(entity: PolygonEntity): void {
  const report = buildPolygonReport(entity);
  const doc = new jsPDF();

  let cursorY = 16;

  doc.setFontSize(18);
  doc.text(report.title, 14, cursorY);
  cursorY += 10;

  doc.setFontSize(12);
  doc.text(`Nome: ${report.name || 'Polígono sem nome'}`, 14, cursorY);
  cursorY += 7;

  doc.text(`Descrição: ${report.description || '-'}`, 14, cursorY);
  cursorY += 7;

  doc.text(`Área: ${report.area.squareMeters} m² (${report.area.hectares} ha)`, 14, cursorY);
  cursorY += 10;

  doc.setFontSize(14);
  doc.text('Características', 14, cursorY);
  cursorY += 4;

  if (report.customFields.length === 0) {
    doc.setFontSize(12);
    doc.text('Nenhuma característica cadastrada', 14, cursorY + 6);
    cursorY += 12;
  } else {
    autoTable(doc, {
      startY: cursorY + 2,
      head: [['Característica', 'Valor']],
      body: report.customFields.map((field) => [field.label, field.value]),
    });
    cursorY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY + 2;
  }

  doc.setFontSize(14);
  doc.text('Coordenadas', 14, cursorY + 10);

  autoTable(doc, {
    startY: cursorY + 14,
    head: [['Ponto', 'Latitude', 'Longitude', 'Zona UTM', 'Easting', 'Northing']],
    body: report.coordinates.map((coordinate) => [
      coordinate.point,
      coordinate.latitude,
      coordinate.longitude,
      coordinate.utmZone,
      coordinate.easting,
      coordinate.northing,
    ]),
  });

  doc.save(`${safeFilename(report.name)}.pdf`);
}
