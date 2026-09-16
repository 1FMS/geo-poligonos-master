import { toUtm } from '../geo/coordinateConverter';
import { toHectares } from '../geo/calculateArea';
import { listVertices, vertexLabel } from '../geo/polygonUtils';
import type { PolygonEntity } from '../../types/polygon';

export interface PolygonReportCoordinate {
  point: string;
  latitude: string;
  longitude: string;
  utmZone: string;
  easting: string;
  northing: string;
}

export interface PolygonReportCustomField {
  label: string;
  value: string;
}

export interface PolygonReportModel {
  title: string;
  name: string;
  description: string;
  area: {
    squareMeters: string;
    hectares: string;
  };
  coordinates: PolygonReportCoordinate[];
  customFields: PolygonReportCustomField[];
}

const areaFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

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

/**
 * Builds a pure, DOM-free model of a polygon's PDF report from its entity.
 * Contains everything the renderer needs: title, name, description, area
 * (in both m² and hectares), per-vertex coordinates (WGS84 and UTM), and
 * custom fields ("características").
 */
export function buildPolygonReport(entity: PolygonEntity): PolygonReportModel {
  const isMultiPolygon = entity.geometry.type === 'MultiPolygon';

  const coordinates: PolygonReportCoordinate[] = listVertices(entity.geometry).map((vertex) => {
    const [longitude, latitude] = vertex.position;
    const utm = toUtm(vertex.position);
    const point = isMultiPolygon
      ? `Parte ${vertex.partIndex + 1} — ${vertexLabel(vertex.vertexIndex)}`
      : vertexLabel(vertex.vertexIndex);

    return {
      point,
      latitude: degreeFormatter(latitude, 'N', 'S'),
      longitude: degreeFormatter(longitude, 'L', 'O'),
      utmZone: `${utm.zone} ${utm.hemisphere}`,
      easting: meterFormatter.format(utm.easting),
      northing: meterFormatter.format(utm.northing),
    };
  });

  const customFields: PolygonReportCustomField[] = entity.properties.customFields.map((field) => ({
    label: field.label,
    value: field.value,
  }));

  return {
    title: 'Relatório do Polígono',
    name: entity.properties.name,
    description: entity.properties.description,
    area: {
      squareMeters: areaFormatter.format(entity.calculated.areaSquareMeters),
      hectares: areaFormatter.format(toHectares(entity.calculated.areaSquareMeters)),
    },
    coordinates,
    customFields,
  };
}
