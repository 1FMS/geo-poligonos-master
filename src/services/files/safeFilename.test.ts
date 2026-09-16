import { describe, expect, it } from 'vitest';

import { safeFilename } from './safeFilename';

describe('safeFilename', () => {
  it('mantém nomes já seguros, trocando espaços por underscore', () => {
    expect(safeFilename('Fazenda Boa Vista')).toBe('Fazenda_Boa_Vista');
  });

  it('remove caracteres inválidos de nome de arquivo', () => {
    expect(safeFilename('Talhão 1: Área/Norte*?"<>|')).toBe('Talhão_1_Área_Norte');
  });

  it('usa fallback "poligono" para nome vazio', () => {
    expect(safeFilename('')).toBe('poligono');
  });

  it('usa fallback "poligono" quando só há caracteres inválidos', () => {
    expect(safeFilename('***///???')).toBe('poligono');
  });

  it('usa fallback "poligono" para string apenas com espaços', () => {
    expect(safeFilename('   ')).toBe('poligono');
  });
});
