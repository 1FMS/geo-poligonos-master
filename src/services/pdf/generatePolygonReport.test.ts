import { beforeEach, describe, expect, it, vi } from 'vitest';

const { textMock, saveMock, setFontSizeMock, autoTableMock } = vi.hoisted(() => ({
  textMock: vi.fn(),
  saveMock: vi.fn(),
  setFontSizeMock: vi.fn(),
  autoTableMock: vi.fn(),
}));

vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation(function jsPDFMock(this: Record<string, unknown>) {
    this.text = textMock;
    this.save = saveMock;
    this.setFontSize = setFontSizeMock;
  }),
}));

vi.mock('jspdf-autotable', () => ({
  default: autoTableMock,
}));

import { generatePolygonReport } from './generatePolygonReport';
import type { PolygonEntity } from '../../types/polygon';

const polygonEntity: PolygonEntity = {
  id: 'p1',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-46.6, -23.5],
        [-46.5, -23.5],
        [-46.5, -23.4],
        [-46.6, -23.5],
      ],
    ],
  },
  properties: {
    name: 'Fazenda Boa Vista',
    description: 'Área de teste',
    createdAt: '2026-01-01T00:00:00.000Z',
    customFields: [{ id: 'f1', key: 'proprietario', label: 'Proprietário', value: 'Ana' }],
  },
  calculated: {
    areaSquareMeters: 999999,
  },
};

describe('generatePolygonReport', () => {
  beforeEach(() => {
    textMock.mockClear();
    saveMock.mockClear();
    setFontSizeMock.mockClear();
    autoTableMock.mockClear();
  });

  it('escreve o título, nome, descrição e área no documento', () => {
    generatePolygonReport(polygonEntity);

    const texts = textMock.mock.calls.map((call) => call[0]);
    expect(texts).toContain('Relatório do Polígono');
    expect(texts.some((text) => text.includes('Fazenda Boa Vista'))).toBe(true);
    expect(texts.some((text) => text.includes('Área de teste'))).toBe(true);
    expect(texts.some((text) => text.includes('m²') && text.includes('ha'))).toBe(true);
  });

  it('cria a tabela de características com o rótulo e valor do campo personalizado', () => {
    generatePolygonReport(polygonEntity);

    const characteristicsCall = autoTableMock.mock.calls.find((call) =>
      call[1].head[0].includes('Característica'),
    );
    expect(characteristicsCall).toBeDefined();
    expect(characteristicsCall![1].body).toEqual([['Proprietário', 'Ana']]);
  });

  it('exibe mensagem de ausência de características quando não há campos personalizados', () => {
    generatePolygonReport({ ...polygonEntity, properties: { ...polygonEntity.properties, customFields: [] } });

    const texts = textMock.mock.calls.map((call) => call[0]);
    expect(texts).toContain('Nenhuma característica cadastrada');

    const characteristicsCall = autoTableMock.mock.calls.find((call) =>
      call[1].head[0].includes('Característica'),
    );
    expect(characteristicsCall).toBeUndefined();
  });

  it('cria a tabela de coordenadas com as colunas esperadas', () => {
    generatePolygonReport(polygonEntity);

    const coordinatesCall = autoTableMock.mock.calls.find((call) => call[1].head[0].includes('Ponto'));
    expect(coordinatesCall).toBeDefined();
    expect(coordinatesCall![1].head[0]).toEqual(['Ponto', 'Latitude', 'Longitude', 'Zona UTM', 'Easting', 'Northing']);
    expect(coordinatesCall![1].body).toHaveLength(3);
  });

  it('salva o arquivo usando o nome sanitizado do polígono com extensão .pdf', () => {
    generatePolygonReport(polygonEntity);

    expect(saveMock).toHaveBeenCalledWith('Fazenda_Boa_Vista.pdf');
  });
});
