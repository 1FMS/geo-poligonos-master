import { useRef, useState } from 'react';

import { usePolygons } from '../../app/PolygonProvider';
import { requestMapFocus } from '../../app/mapFocusBus';
import { parseKml } from '../../services/kml/importKml';
import { parseKmz } from '../../services/kml/importKmz';
import { listDxfLayers, parseDxf } from '../../services/dxf/importDxf';
import { parseOnrGeoJson } from '../../services/onr/importOnrGeoJson';
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
    return ignoredCount;
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
    return finishImport(polygons, ignoredCount);
  };

  const importFile = async (file: File): Promise<number> => {
    const extension = extensionOf(file.name);

    if (extension === '.dxf') {
      return importDxfFile(await file.text());
    }
    if (extension === '.kmz') {
      const { polygons, ignoredCount } = await parseKmz(await file.arrayBuffer());
      return finishImport(polygons, ignoredCount);
    }
    if (extension === '.geojson' || extension === '.json') {
      const { polygons, ignoredCount } = parseOnrGeoJson(await file.text());
      return finishImport(polygons, ignoredCount);
    }
    const { polygons, ignoredCount } = parseKml(await file.text());
    return finishImport(polygons, ignoredCount);
  };

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (files.length === 0) {
      return;
    }

    setIsImporting(true);
    let totalIgnored = 0;
    const failedFiles: string[] = [];

    try {
      for (const file of files) {
        try {
          totalIgnored += await importFile(file);
        } catch (error) {
          failedFiles.push(file.name);
        }
      }

      if (failedFiles.length > 0) {
        window.alert(`Falha ao importar: ${failedFiles.join(', ')}`);
      }
      if (totalIgnored > 0) {
        window.alert(`${totalIgnored} elemento(s) incompatível(is) ignorado(s).`);
      }
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
        accept=".kml,.kmz,.dxf,.geojson,.json,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz,application/geo+json"
        multiple
        onChange={handleChange}
        disabled={isImporting}
        style={{ display: 'none' }}
        aria-label="Selecionar arquivo para importar"
      />
    </>
  );
}
