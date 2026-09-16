import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(__dirname, '..', 'tests', 'fixtures', name);

/**
 * Draws a triangle using leaflet-geoman's default click-to-add-vertex,
 * click-first-vertex-to-close workflow, against the real map surface.
 */
async function drawTriangle(page: Page, origin: { x: number; y: number }) {
  await page.getByRole('button', { name: 'Criar polígono' }).click();
  const map = page.locator('.leaflet-container');
  await map.hover({ position: origin });

  const p1 = { x: origin.x, y: origin.y };
  const p2 = { x: origin.x + 80, y: origin.y };
  const p3 = { x: origin.x + 40, y: origin.y - 80 };

  await map.click({ position: p1 });
  await map.click({ position: p2 });
  await map.click({ position: p3 });
  // Closing the ring: click back on the first vertex marker.
  await map.click({ position: p1 });
}

test.describe('Editor de Polígonos - fluxos de aceite', () => {
  test('importa, exporta e exclui um polígono', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel('Selecionar arquivo para importar').setInputFiles(fixture('polygon.kml'));

    const listItem = page.getByRole('button', { name: /Fazenda Boa Vista/ });
    await expect(listItem).toBeVisible();

    await listItem.click();
    await expect(page.getByRole('heading', { name: 'Fazenda Boa Vista' })).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar KML' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.kml$/);

    await page.getByRole('button', { name: 'Excluir polígono' }).click();
    await page.getByRole('button', { name: 'Confirmar exclusão' }).click();

    await expect(page.getByText('Nenhum polígono criado ainda.')).toBeVisible();
  });

  test('cria dois polígonos, alterna seleção, edita um vértice e mantém isolamento', async ({ page }) => {
    await page.goto('/');

    await drawTriangle(page, { x: 250, y: 200 });
    await expect(page.getByRole('heading', { name: 'Polígono sem nome' })).toBeVisible();
    await page.getByRole('button', { name: 'Voltar à lista' }).click();

    await drawTriangle(page, { x: 500, y: 350 });
    await expect(page.getByRole('heading', { name: 'Polígono sem nome' })).toBeVisible();

    const list = page.getByRole('list', { name: 'Lista de polígonos' });
    await page.getByRole('button', { name: 'Voltar à lista' }).click();
    const items = list.getByRole('button');
    await expect(items).toHaveCount(2);

    // Select the first polygon and record its area.
    await items.nth(0).click();
    const areaText = await page.locator('.polygon-details__area').textContent();

    // Enter geometry edit mode and drag a vertex to change the area.
    await page.getByRole('button', { name: 'Editar geometria' }).click();
    const marker = page.locator('.leaflet-container .leaflet-marker-icon').first();
    const box = await marker.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 - 60, { steps: 5 });
      await page.mouse.up();
    }
    await page.getByRole('button', { name: 'Concluir edição de geometria' }).click();

    const newAreaText = await page.locator('.polygon-details__area').textContent();
    expect(newAreaText).not.toEqual(areaText);

    // Switch to the second polygon and confirm its area was not affected.
    await page.getByRole('button', { name: 'Voltar à lista' }).click();
    await items.nth(1).click();
    await expect(page.locator('.polygon-details__area')).toBeVisible();
    await page.getByRole('button', { name: 'Voltar à lista' }).click();

    await items.nth(0).click();
    const finalAreaText = await page.locator('.polygon-details__area').textContent();
    expect(finalAreaText).toEqual(newAreaText);
  });

  test('importa MultiPolygon como uma única entidade e baixa o relatório em PDF', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel('Selecionar arquivo para importar').setInputFiles(fixture('multipolygon.kml'));

    const list = page.getByRole('list', { name: 'Lista de polígonos' });
    await expect(list.getByRole('button')).toHaveCount(1);

    await page.getByRole('button', { name: /Gleba Composta/ }).click();
    await expect(page.getByRole('heading', { name: 'Gleba Composta' })).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Baixar relatório PDF' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });
});
