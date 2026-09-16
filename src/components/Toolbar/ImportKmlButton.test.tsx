import JSZip from 'jszip';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ImportKmlButton } from './ImportKmlButton';
import { PolygonProvider, usePolygons } from '../../app/PolygonProvider';

const validKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Talhão importado</name>
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

const mixedKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Talhão importado</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>-46.6,-23.5,0 -46.5,-23.5,0 -46.5,-23.4,0 -46.6,-23.5,0</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
    <Placemark>
      <name>Ponto</name>
      <Point>
        <coordinates>-46.55,-23.45,0</coordinates>
      </Point>
    </Placemark>
  </Document>
</kml>`;

const noPolygonsKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Ponto</name>
      <Point>
        <coordinates>-46.55,-23.45,0</coordinates>
      </Point>
    </Placemark>
  </Document>
</kml>`;

function makeFile(content: string, name = 'arquivo.kml'): File {
  return new File([content], name, { type: 'application/vnd.google-earth.kml+xml' });
}

function PolygonCount() {
  const { polygons } = usePolygons();
  return <span data-testid="count">{polygons.length}</span>;
}

function renderButton() {
  return render(
    <PolygonProvider>
      <ImportKmlButton />
      <PolygonCount />
    </PolygonProvider>,
  );
}

function getFileInput(): HTMLInputElement {
  return screen.getByLabelText('Selecionar arquivo para importar') as HTMLInputElement;
}

describe('ImportKmlButton', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('importa um KML válido e atualiza a contagem de polígonos', async () => {
    renderButton();
    const input = getFileInput();

    fireEvent.change(input, { target: { files: [makeFile(validKml)] } });

    expect(await screen.findByText('1')).toBeInTheDocument();
  });

  it('importa parcialmente e informa quantos elementos foram ignorados', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    renderButton();
    const input = getFileInput();

    fireEvent.change(input, { target: { files: [makeFile(mixedKml)] } });

    await screen.findByText('1');
    expect(alertSpy).toHaveBeenCalledWith('1 elemento(s) incompatível(is) ignorado(s).');
  });

  it('não altera o estado e exibe alerta quando não há geometrias compatíveis', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    renderButton();
    const input = getFileInput();

    fireEvent.change(input, { target: { files: [makeFile(noPolygonsKml)] } });

    await vi.waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('não altera o estado e exibe alerta para arquivo inválido', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    renderButton();
    const input = getFileInput();

    fireEvent.change(input, { target: { files: [makeFile('<kml><Document>')] } });

    await vi.waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('importa um KMZ válido (KML zipado) e atualiza a contagem de polígonos', async () => {
    const zip = new JSZip();
    zip.file('doc.kml', validKml);
    const kmzBlob = await zip.generateAsync({ type: 'blob' });
    const kmzFile = new File([kmzBlob], 'talhao.kmz', { type: 'application/vnd.google-earth.kmz' });

    renderButton();
    fireEvent.change(getFileInput(), { target: { files: [kmzFile] } });

    expect(await screen.findByText('1')).toBeInTheDocument();
  });

  it('importa um DXF automaticamente na Zona UTM 23S, sem pedir confirmação', async () => {
    const dxf = [
      '0', 'SECTION',
      '2', 'ENTITIES',
      '0', 'LWPOLYLINE',
      '8', 'Talhao 1',
      '90', '4',
      '70', '1',
      '10', '500000', '20', '7402000',
      '10', '500100', '20', '7402000',
      '10', '500100', '20', '7402100',
      '10', '500000', '20', '7402100',
      '0', 'ENDSEC',
      '0', 'EOF',
    ].join('\n');
    const dxfFile = new File([dxf], 'talhao.dxf', { type: 'application/dxf' });

    renderButton();
    fireEvent.change(getFileInput(), { target: { files: [dxfFile] } });

    expect(await screen.findByText('1')).toBeInTheDocument();
  });

  it('importa somente as camadas de lote de um DXF com bairro/quadra/lote misturados', async () => {
    const dxf = [
      '0', 'SECTION',
      '2', 'ENTITIES',
      '0', 'LWPOLYLINE',
      '8', 'BAIRRO',
      '90', '4',
      '70', '1',
      '10', '500000', '20', '7402000',
      '10', '500500', '20', '7402000',
      '10', '500500', '20', '7402500',
      '10', '500000', '20', '7402500',
      '0', 'LWPOLYLINE',
      '8', 'LOTES',
      '90', '4',
      '70', '1',
      '10', '500010', '20', '7402010',
      '10', '500050', '20', '7402010',
      '10', '500050', '20', '7402050',
      '10', '500010', '20', '7402050',
      '0', 'ENDSEC',
      '0', 'EOF',
    ].join('\n');
    const dxfFile = new File([dxf], 'bairro-e-lotes.dxf', { type: 'application/dxf' });

    renderButton();
    fireEvent.change(getFileInput(), { target: { files: [dxfFile] } });

    expect(await screen.findByText('1')).toBeInTheDocument();
  });
});
