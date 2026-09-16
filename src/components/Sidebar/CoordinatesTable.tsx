import { useMemo } from 'react';

import { listVertices, vertexLabel } from '../../services/geo/polygonUtils';
import { toUtm } from '../../services/geo/coordinateConverter';
import type { PolygonGeometry } from '../../types/polygon';

interface CoordinatesTableProps {
  geometry: PolygonGeometry;
}

interface CoordinateRow {
  key: string;
  label: string;
  latitude: string;
  longitude: string;
  zoneLabel: string;
  easting: string;
  northing: string;
}

const degreeFormatter = (value: number, positiveHemisphere: string, negativeHemisphere: string): string => {
  const hemisphere = value < 0 ? negativeHemisphere : positiveHemisphere;
  const formatted = Math.abs(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  });
  return `${formatted}° ${hemisphere}`;
};

const meterFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const buildRows = (geometry: PolygonGeometry): CoordinateRow[] => {
  const isMultiPolygon = geometry.type === 'MultiPolygon';

  return listVertices(geometry).map((vertex) => {
    const [longitude, latitude] = vertex.position;
    const utm = toUtm(vertex.position);
    const label = isMultiPolygon
      ? `Parte ${vertex.partIndex + 1} — ${vertexLabel(vertex.vertexIndex)}`
      : vertexLabel(vertex.vertexIndex);

    return {
      key: `${vertex.partIndex}-${vertex.ringIndex}-${vertex.vertexIndex}`,
      label,
      latitude: degreeFormatter(latitude, 'N', 'S'),
      longitude: degreeFormatter(longitude, 'L', 'O'),
      zoneLabel: `${utm.zone} ${utm.hemisphere}`,
      easting: meterFormatter.format(utm.easting),
      northing: meterFormatter.format(utm.northing),
    };
  });
};

export function CoordinatesTable({ geometry }: CoordinatesTableProps) {
  const rows = useMemo(() => buildRows(geometry), [geometry]);

  return (
    <div className="coordinates-table__wrapper">
      <table className="coordinates-table">
        <caption>Coordenadas dos vértices</caption>
        <thead>
          <tr>
            <th scope="col">Vértice</th>
            <th scope="col">Latitude</th>
            <th scope="col">Longitude</th>
            <th scope="col">Zona UTM</th>
            <th scope="col">Este (m)</th>
            <th scope="col">Norte (m)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.label}</th>
              <td>{row.latitude}</td>
              <td>{row.longitude}</td>
              <td>{row.zoneLabel}</td>
              <td>{row.easting}</td>
              <td>{row.northing}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
