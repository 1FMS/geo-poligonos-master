import { useEffect } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';
import { PolygonProvider, usePolygons } from '../../app/PolygonProvider';
import { generatePolygonReport } from '../../services/pdf/generatePolygonReport';
import { fetchOnrPolygonsNear } from '../../services/onr/fetchOnrPolygon';
import { NoSupportedGeometryError } from '../../services/onr/importOnrGeoJson';
import type { PolygonEntity } from '../../types/polygon';

vi.mock('../../services/pdf/generatePolygonReport', () => ({
  generatePolygonReport: vi.fn(),
}));

vi.mock('../../services/onr/fetchOnrPolygon', () => ({
  fetchOnrPolygonsNear: vi.fn(),
}));

function buildOnrPolygon(matricula: string, cartorio = '3º Registro de Imóveis de São Luis'): PolygonEntity {
  return {
    id: `onr-${matricula}`,
    // Same geometry as `buildPolygon`'s "Fazenda Alfa" square, so tests that
    // want a real match get one instead of two coincidentally-nearby shapes.
    geometry: {
      type: 'Polygon',
      coordinates: [[[-46.6, -23.5], [-46.5, -23.5], [-46.5, -23.4], [-46.6, -23.5]]],
    },
    source: 'onr',
    properties: {
      name: `ONR - matrícula ${matricula}`,
      description: '',
      createdAt: '2026-09-16T12:00:00.000Z',
      customFields: [{ id: 'cartorio-field', key: 'cartorio', label: 'cartorio', value: cartorio }],
    },
    calculated: { areaSquareMeters: 500 },
  };
}

function buildPolygon(id: string, name: string): PolygonEntity {
  return {
    id,
    geometry: {
      type: 'Polygon',
      coordinates: [[[-46.6, -23.5], [-46.5, -23.5], [-46.5, -23.4], [-46.6, -23.5]]],
    },
    properties: {
      name,
      description: '',
      createdAt: '2026-09-15T12:00:00.000Z',
      customFields: [],
    },
    calculated: { areaSquareMeters: 12_345 },
  };
}

function Seed({ polygons, selectedId }: { polygons: PolygonEntity[]; selectedId: string | null }) {
  const { addPolygon, selectPolygon } = usePolygons();

  useEffect(() => {
    polygons.forEach((polygon) => addPolygon(polygon));
    selectPolygon(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Sidebar />;
}

function renderSidebar(polygons: PolygonEntity[], selectedId: string | null = null) {
  return render(
    <PolygonProvider>
      <Seed polygons={polygons} selectedId={selectedId} />
    </PolygonProvider>,
  );
}

describe('Sidebar', () => {
  it('exibe a lista de polígonos quando não há seleção', () => {
    renderSidebar([buildPolygon('a', 'Fazenda Alfa'), buildPolygon('b', 'Fazenda Beta')]);

    expect(screen.getByRole('button', { name: /Fazenda Alfa/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fazenda Beta/ })).toBeInTheDocument();
  });

  it('exibe mensagem quando não há polígonos', () => {
    renderSidebar([]);

    expect(screen.getByText('Nenhum polígono criado ainda.')).toBeInTheDocument();
  });

  it('exibe os detalhes do polígono selecionado, incluindo área em m² e ha', () => {
    renderSidebar([buildPolygon('a', 'Fazenda Alfa')], 'a');

    expect(screen.getByLabelText('Nome')).toHaveValue('Fazenda Alfa');
    expect(screen.getByText(/12\.345.*m²/)).toBeInTheDocument();
    expect(screen.getByText(/1,23.*ha/)).toBeInTheDocument();
  });

  it('permite selecionar um polígono a partir da lista', () => {
    renderSidebar([buildPolygon('a', 'Fazenda Alfa')]);

    fireEvent.click(screen.getByRole('button', { name: /Fazenda Alfa/ }));

    expect(screen.getByLabelText('Nome')).toHaveValue('Fazenda Alfa');
  });

  it('salva edições de nome e descrição ao sair do campo', () => {
    renderSidebar([buildPolygon('a', 'Fazenda Alfa')], 'a');

    const nameInput = screen.getByLabelText('Nome');
    fireEvent.change(nameInput, { target: { value: 'Fazenda Alfa Renomeada' } });
    fireEvent.blur(nameInput);

    const descriptionInput = screen.getByLabelText('Descrição');
    fireEvent.change(descriptionInput, { target: { value: 'Área de plantio' } });
    fireEvent.blur(descriptionInput);

    expect(screen.getByLabelText('Nome')).toHaveValue('Fazenda Alfa Renomeada');
    expect(screen.getByLabelText('Descrição')).toHaveValue('Área de plantio');
  });

  it('alterna apenas a edição de geometria ao clicar em "Editar geometria"', () => {
    renderSidebar([buildPolygon('a', 'Fazenda Alfa')], 'a');

    const editButton = screen.getByRole('button', { name: 'Editar geometria' });
    fireEvent.click(editButton);

    expect(screen.getByRole('button', { name: 'Concluir edição de geometria' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveValue('Fazenda Alfa');
  });

  it('pede confirmação antes de excluir e nomeia a entidade', () => {
    renderSidebar([buildPolygon('a', 'Fazenda Alfa')], 'a');

    fireEvent.click(screen.getByRole('button', { name: 'Excluir polígono' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Fazenda Alfa/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveValue('Fazenda Alfa');
  });

  it('exclui apenas o polígono selecionado, mantendo os demais intactos', () => {
    renderSidebar([buildPolygon('a', 'Fazenda Alfa'), buildPolygon('b', 'Fazenda Beta')], 'a');

    fireEvent.click(screen.getByRole('button', { name: 'Excluir polígono' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar exclusão' }));

    expect(screen.queryByText('Fazenda Alfa')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fazenda Beta/ })).toBeInTheDocument();
  });

  it('baixa o relatório PDF do polígono selecionado', () => {
    renderSidebar([buildPolygon('a', 'Fazenda Alfa')], 'a');

    fireEvent.click(screen.getByRole('button', { name: 'Baixar relatório PDF' }));

    expect(generatePolygonReport).toHaveBeenCalledTimes(1);
    expect(generatePolygonReport).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
  });

  it('exibe mensagem de erro e mantém entidade/seleção intactas quando a geração do PDF falha', () => {
    vi.mocked(generatePolygonReport).mockImplementationOnce(() => {
      throw new Error('falha simulada');
    });

    renderSidebar([buildPolygon('a', 'Fazenda Alfa')], 'a');

    fireEvent.click(screen.getByRole('button', { name: 'Baixar relatório PDF' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível gerar o PDF. Tente novamente.');
    expect(screen.getByLabelText('Nome')).toHaveValue('Fazenda Alfa');
  });

  describe('busca de polígono na ONR', () => {
    afterEach(() => {
      vi.mocked(fetchOnrPolygonsNear).mockReset();
    });

    it('mostra a % de sobreposição e o cartório de um candidato forte, e o importa como polígono de comparação', async () => {
      vi.mocked(fetchOnrPolygonsNear).mockResolvedValueOnce({
        polygons: [buildOnrPolygon('8207', '3º Registro de Imóveis de São Luis')],
        ignoredCount: 0,
      });

      renderSidebar([buildPolygon('a', 'Fazenda Alfa')], 'a');

      fireEvent.click(screen.getByRole('button', { name: 'Buscar na ONR' }));

      const result = await screen.findByRole('status');
      expect(within(result).getByText(/ONR - matrícula 8207/)).toBeInTheDocument();
      expect(within(result).getByText(/3º Registro de Imóveis de São Luis/)).toBeInTheDocument();
      expect(within(result).getByText(/de sobreposição com este lote/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Voltar à lista' }));
      expect(screen.getByRole('button', { name: /ONR - matrícula 8207/ })).toBeInTheDocument();
    });

    it('não mostra nem importa candidatos com sobreposição abaixo de 60%', async () => {
      const weakCandidate = buildOnrPolygon('9999', 'Outro cartório');
      weakCandidate.geometry = {
        type: 'Polygon',
        coordinates: [[[-46.6, -23.5], [-46.599, -23.5], [-46.599, -23.499], [-46.6, -23.5]]],
      };
      vi.mocked(fetchOnrPolygonsNear).mockResolvedValueOnce({ polygons: [weakCandidate], ignoredCount: 0 });

      renderSidebar([buildPolygon('a', 'Fazenda Alfa')], 'a');

      fireEvent.click(screen.getByRole('button', { name: 'Buscar na ONR' }));

      expect(await screen.findByText(/Nenhum polígono da ONR/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Voltar à lista' }));
      expect(screen.queryByRole('button', { name: /ONR - matrícula 9999/ })).not.toBeInTheDocument();
    });

    it('mostra mensagem de "nenhum encontrado" quando a busca não acha candidatos', async () => {
      vi.mocked(fetchOnrPolygonsNear).mockRejectedValueOnce(new NoSupportedGeometryError());

      renderSidebar([buildPolygon('a', 'Fazenda Alfa')], 'a');

      fireEvent.click(screen.getByRole('button', { name: 'Buscar na ONR' }));

      expect(await screen.findByText(/Nenhum polígono da ONR/)).toBeInTheDocument();
    });

    it('exibe mensagem de erro quando a busca na ONR falha', async () => {
      vi.mocked(fetchOnrPolygonsNear).mockRejectedValueOnce(new Error('indisponível'));

      renderSidebar([buildPolygon('a', 'Fazenda Alfa')], 'a');

      fireEvent.click(screen.getByRole('button', { name: 'Buscar na ONR' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('indisponível');
    });
  });

  describe('modal semantics do diálogo de exclusão', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('abre o diálogo de confirmação com showModal() e o fecha com close() ao cancelar', () => {
      const showModalSpy = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
      const closeSpy = vi.spyOn(HTMLDialogElement.prototype, 'close');

      renderSidebar([buildPolygon('a', 'Fazenda Alfa')], 'a');

      fireEvent.click(screen.getByRole('button', { name: 'Excluir polígono' }));
      expect(showModalSpy).toHaveBeenCalledTimes(1);

      const dialog = screen.getByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

      expect(closeSpy).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('fecha via evento nativo "close" (ex.: Escape) e sincroniza o estado React', () => {
      renderSidebar([buildPolygon('a', 'Fazenda Alfa')], 'a');

      fireEvent.click(screen.getByRole('button', { name: 'Excluir polígono' }));
      const dialog = screen.getByRole('dialog');

      // Simula o navegador fechando o <dialog> nativamente (ex.: tecla Escape),
      // o que dispara o evento "close" sem que nenhum botão React seja clicado.
      fireEvent(dialog, new Event('close'));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('não fecha a confirmação de exclusão ao editar e sair do campo Nome/Descrição enquanto o diálogo está aberto', () => {
      renderSidebar([buildPolygon('a', 'Fazenda Alfa')], 'a');

      fireEvent.click(screen.getByRole('button', { name: 'Excluir polígono' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      const nameInput = screen.getByLabelText('Nome');
      fireEvent.change(nameInput, { target: { value: 'Fazenda Alfa Renomeada' } });
      fireEvent.blur(nameInput);

      expect(screen.getByRole('dialog')).toBeInTheDocument();

      const descriptionInput = screen.getByLabelText('Descrição');
      fireEvent.change(descriptionInput, { target: { value: 'Área de plantio' } });
      fireEvent.blur(descriptionInput);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
