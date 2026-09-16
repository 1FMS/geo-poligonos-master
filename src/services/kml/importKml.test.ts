import { describe, expect, it } from 'vitest';

import { InvalidKmlError, NoSupportedGeometryError, parseKml } from './importKml';
import polygonKml from '../../../tests/fixtures/polygon.kml?raw';
import mixedKml from '../../../tests/fixtures/mixed.kml?raw';
import invalidKml from '../../../tests/fixtures/invalid.kml?raw';
import noPolygonsKml from '../../../tests/fixtures/no-polygons.kml?raw';

const fixtures: Record<string, string> = {
  'polygon.kml': polygonKml,
  'mixed.kml': mixedKml,
  'invalid.kml': invalidKml,
  'no-polygons.kml': noPolygonsKml,
};

const readFixture = (name: string): string => fixtures[name];

const geometryCollectionKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Composto</name>
      <MultiGeometry>
        <Polygon>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>-46.6,-23.5,0 -46.5,-23.5,0 -46.5,-23.4,0 -46.6,-23.5,0</coordinates>
            </LinearRing>
          </outerBoundaryIs>
        </Polygon>
        <Point>
          <coordinates>-46.55,-23.45,0</coordinates>
        </Point>
        <LineString>
          <coordinates>-46.6,-23.5,0 -46.5,-23.4,0</coordinates>
        </LineString>
      </MultiGeometry>
    </Placemark>
  </Document>
</kml>`;

describe('parseKml', () => {
  it('importa um polígono válido com nome e área recalculada', () => {
    const result = parseKml(readFixture('polygon.kml'));

    expect(result.polygons).toHaveLength(1);
    expect(result.ignoredCount).toBe(0);
    expect(result.polygons[0].properties.name).toBe('Fazenda Boa Vista');
    expect(result.polygons[0].properties.description).toBe('Área de teste');
    expect(result.polygons[0].calculated.areaSquareMeters).toBeGreaterThan(0);
    expect(result.polygons[0].geometry.type).toBe('Polygon');
  });

  it('importa apenas geometrias compatíveis e conta as ignoradas em um KML misto', () => {
    const result = parseKml(readFixture('mixed.kml'));

    expect(result).toMatchObject({ ignoredCount: 2 });
    expect(result.polygons).toHaveLength(1);
    expect(result.polygons[0].properties.name).toBe('Talhão 1');
  });

  it('extrai polígonos de dentro de um GeometryCollection e ignora os membros restantes', () => {
    const result = parseKml(geometryCollectionKml);

    expect(result.polygons).toHaveLength(1);
    expect(result.ignoredCount).toBe(2);
  });

  it('funde várias partes Polygon de um MultiGeometry em uma única entidade MultiPolygon', () => {
    const multiPolygonKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Gleba Composta</name>
      <MultiGeometry>
        <Polygon>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>-46.6,-23.5,0 -46.5,-23.5,0 -46.5,-23.4,0 -46.6,-23.5,0</coordinates>
            </LinearRing>
          </outerBoundaryIs>
        </Polygon>
        <Polygon>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>-46.3,-23.2,0 -46.2,-23.2,0 -46.2,-23.1,0 -46.3,-23.2,0</coordinates>
            </LinearRing>
          </outerBoundaryIs>
        </Polygon>
      </MultiGeometry>
    </Placemark>
  </Document>
</kml>`;

    const result = parseKml(multiPolygonKml);

    expect(result.polygons).toHaveLength(1);
    expect(result.ignoredCount).toBe(0);
    expect(result.polygons[0].geometry.type).toBe('MultiPolygon');
    expect(result.polygons[0].geometry.type === 'MultiPolygon' && result.polygons[0].geometry.coordinates).toHaveLength(2);
  });

  it('lança InvalidKmlError para XML malformado', () => {
    expect(() => parseKml(readFixture('invalid.kml'))).toThrow(InvalidKmlError);
  });

  it('lança NoSupportedGeometryError quando não há polígonos no arquivo', () => {
    expect(() => parseKml(readFixture('no-polygons.kml'))).toThrow(NoSupportedGeometryError);
  });

  it('atribui nome padrão quando o placemark não possui nome', () => {
    const kmlWithoutName = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>-46.6,-23.5,0 -46.5,-23.5,0 -46.5,-23.4,0 -46.6,-23.5,0</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;

    const result = parseKml(kmlWithoutName);

    expect(result.polygons[0].properties.name).toBe('Polígono importado');
  });

  it('descarta propriedades técnicas de estilo do KML e mantém campos personalizados reais', () => {
    const kmlWithStyleProperties = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Talhão com estilo</name>
      <styleUrl>#estilo1</styleUrl>
      <ExtendedData>
        <Data name="proprietario"><value>Ana</value></Data>
      </ExtendedData>
      <Style>
        <PolyStyle>
          <fill>1</fill>
          <color>ff0000ff</color>
        </PolyStyle>
      </Style>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>-46.6,-23.5,0 -46.5,-23.5,0 -46.5,-23.4,0 -46.6,-23.5,0</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;

    const result = parseKml(kmlWithStyleProperties);
    const fieldKeys = result.polygons[0].properties.customFields.map(field => field.key);

    expect(fieldKeys).not.toContain('styleUrl');
    expect(fieldKeys).not.toContain('fill');
    expect(fieldKeys).not.toContain('fill-opacity');
    expect(fieldKeys).not.toContain('stroke');
    expect(fieldKeys).toContain('proprietario');
  });

  it('descarta propriedades derivadas de IconStyle/LabelStyle mesmo com sufixos compostos', () => {
    const kmlWithIconAndLabelStyle = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Com ícone</name>
      <Style>
        <IconStyle>
          <scale>1.2</scale>
          <heading>45</heading>
          <hotSpot x="0.5" y="0" xunits="fraction" yunits="fraction"/>
          <Icon><href>http://example.com/icon.png</href></Icon>
        </IconStyle>
        <LabelStyle>
          <scale>1</scale>
          <color>ff00ff00</color>
        </LabelStyle>
      </Style>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>-46.6,-23.5,0 -46.5,-23.5,0 -46.5,-23.4,0 -46.6,-23.5,0</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;

    const result = parseKml(kmlWithIconAndLabelStyle);
    const fieldKeys = result.polygons[0].properties.customFields.map(field => field.key);

    expect(fieldKeys).not.toContain('icon');
    expect(fieldKeys).not.toContain('icon-scale');
    expect(fieldKeys).not.toContain('icon-heading');
    expect(fieldKeys).not.toContain('icon-offset');
    expect(fieldKeys).not.toContain('icon-offset-units');
    expect(fieldKeys).not.toContain('label-color');
    expect(fieldKeys).not.toContain('label-scale');
  });
});
