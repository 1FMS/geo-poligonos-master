import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { parseKmz } from './importKmz';
import { InvalidKmlError } from './importKml';

const validKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Fazenda Zipada</name>
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

describe('parseKmz', () => {
  it('extrai e importa o KML contido em um KMZ válido', async () => {
    const zip = new JSZip();
    zip.file('doc.kml', validKml);
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });

    const result = await parseKmz(buffer);

    expect(result.polygons).toHaveLength(1);
    expect(result.polygons[0].properties.name).toBe('Fazenda Zipada');
  });

  it('lança InvalidKmlError quando o arquivo não é um zip válido', async () => {
    const notAZip = new TextEncoder().encode('não é um zip').buffer;

    await expect(parseKmz(notAZip)).rejects.toThrow(InvalidKmlError);
  });

  it('lança InvalidKmlError quando o zip não contém nenhum .kml', async () => {
    const zip = new JSZip();
    zip.file('leia-me.txt', 'sem kml aqui');
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });

    await expect(parseKmz(buffer)).rejects.toThrow(InvalidKmlError);
  });
});
