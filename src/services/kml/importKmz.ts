import JSZip from 'jszip';

import { InvalidKmlError, parseKml, type ParseKmlResult } from './importKml';

export async function parseKmz(data: ArrayBuffer): Promise<ParseKmlResult> {
  let zip: JSZip;

  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new InvalidKmlError('Arquivo KMZ inválido ou corrompido.');
  }

  const kmlEntry = Object.values(zip.files).find(
    (entry) => !entry.dir && entry.name.toLowerCase().endsWith('.kml'),
  );

  if (!kmlEntry) {
    throw new InvalidKmlError('O arquivo KMZ não contém nenhum KML.');
  }

  const text = await kmlEntry.async('text');
  return parseKml(text);
}
