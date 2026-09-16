import { useRef, useState } from 'react';

import { usePolygons } from '../../app/PolygonProvider';
import { requestMapFocus } from '../../app/mapFocusBus';
import { parseKml } from '../../services/kml/importKml';
import { parseKmz } from '../../services/kml/importKmz';
import { listDxfLayers, parseDxf } from '../../services/dxf/importDxf';
import type { PolygonEntity } from '../../types/polygon';

const extensionOf = (fileName: string): string => fileName.slice(fileName.lastIndexOf('.')).toLowerCase();

const looksLikeLotsLayer = (name: string): boolean => /lote/i.test(name);

// Todas as importações de DXF são de talhonamentos do Maranhão em SIRGAS 2000
// / Zona 23S (EPSG:31983), e o interesse é sempre nos lotes individuais, não
// nas camadas de bairro/quadra que os envolvem — então isso é aplicado
// automaticamente, sem perguntar.
const DXF_UTM_ZONE = 23;
const DXF_UTM_HEMISPHERE = 'S' as const;

export function ImportKmlButton() {
  const { importPolygons } = usePolygons();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const finishImport = (polygons: PolygonEntity[], ignoredCount: number) => {
    importPolygons(polygons);
    requestMapFocus(polygons.map((polygon) => polygon.geometry));

    if (ignoredCount > 0) {
      window.alert(`${ignoredCount} elemento(s) incompatível(is) ignorado(s).`);
    }
  };

  const importDxfFile = (text: string) => {
    const layers = listDxfLayers(text);
    const lotLayers = layers.filter((layer) => looksLikeLotsLayer(layer.name));
    const targetLayers = (lotLayers.length > 0 ? lotLayers : layers).map((layer) => layer.name);

    const { polygons, ignoredCount } = parseDxf(text, {
      utmZone: DXF_UTM_ZONE,
      utmHemisphere: DXF_UTM_HEMISPHERE,
      layers: targetLayers,
    });
    finishImport(polygons, ignoredCount);
  };

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    const extension = extensionOf(file.name);

    setIsImporting(true);
    try {
      if (extension === '.dxf') {
        importDxfFile(await file.text());
      } else if (extension === '.kmz') {
        const { polygons, ignoredCount } = await parseKmz(await file.arrayBuffer());
        finishImport(polygons, ignoredCount);
      } else {
        const { polygons, ignoredCount } = parseKml(await file.text());
        finishImport(polygons, ignoredCount);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao importar o arquivo.';
      window.alert(message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <button type="button" onClick={handleClick} disabled={isImporting}>
        {isImporting ? 'Importando…' : 'Importar arquivo'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".kml,.kmz,.dxf,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz"
        onChange={handleChange}
        disabled={isImporting}
        style={{ display: 'none' }}
        aria-label="Selecionar arquivo para importar"
      />
    </>
  );
}
