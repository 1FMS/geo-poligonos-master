import { useEffect } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';
import { PolygonProvider, usePolygons } from '../../app/PolygonProvider';
import { generatePolygonReport } from '../../services/pdf/generatePolygonReport';
import type { PolygonEntity } from '../../types/polygon';

vi.mock('../../services/pdf/generatePolygonReport', () => ({
  generatePolygonReport: vi.fn(),
}));

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
