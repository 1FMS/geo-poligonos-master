import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page, type Locator } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(__dirname, '..', 'tests', 'fixtures', name);

/**
 * Draws a triangle with Terra Draw against the real Leaflet map. Terra Draw's
 * polygon mode closes the ring on a click back on the *first* vertex marker
 * (its own on-map tooltip says "Clique no primeiro marcador para finalizar") —
 * unlike Geoman, it does not close on a double-click of the last point.
 */
async function drawTriangle(page: Page, origin: { x: number; y: number }) {
  await page.getByRole('button', { name: 'Criar polígono' }).click();
  const map = page.locator('.leaflet-container');
  const p1 = { x: origin.x, y: origin.y };
  const p2 = { x: origin.x + 80, y: origin.y };
  const p3 = { x: origin.x + 40, y: origin.y - 80 };
  await map.click({ position: p1 });
  await map.click({ position: p2 });
  await map.click({ position: p3 });
  await map.click({ position: p1 });
}

/**
 * Terra Draw's Leaflet adapter does not render features in `.leaflet-overlay-
 * pane` like the app's own read-only `PolygonLayer`: it creates its own
 * numbered custom panes (e.g. `.leaflet-10-pane`, `.leaflet-30-pane`, ...)
 * whose z-index comes from each mode's style `zIndex`. All of them still
 * carry the shared `leaflet-pane` class, so `.leaflet-pane path` reaches
 * Terra Draw's shapes regardless of which numbered pane they land in.
 *
 * A selected feature's real, draggable vertices render as SVG circle paths
 * (`"M<cx>,<cy>a6,6 0 1,0 12,0 a6,6 0 1,0 -12,0 "`, radius 6) — distinct
 * from the smaller midpoint-insertion handles (radius 4, `a4,4`). Neither
 * carries a stable class name, so the arc radius in `d` is the stable
 * signal for "this is a real vertex handle".
 */
function vertexHandle(page: Page): Locator {
  return page.locator('.leaflet-pane path[d*="a6,6"]');
}

/** Terra Draw's own polygon fill/outline paths (editing or "currently drawing"), excluding the app's read-only PolygonLayer paths (which carry Leaflet's own `leaflet-interactive` class). */
function terraDrawPolygonPaths(page: Page): Locator {
  return page.locator('.leaflet-pane path[d*="L"]:not(.leaflet-interactive)');
}

function pointAtFraction(d: string, t: number): { x: number; y: number } {
  const numbers = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
  const [x0, y0, x1, y1] = numbers;
  return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t };
}

/**
 * Selects a Terra Draw polygon feature by clicking on its rendered outline.
 * Terra Draw's own click-to-select hit test is not a simple point-in-polygon
 * (a true centroid click reliably misses) nor a uniform along-the-edge
 * distance test (the exact midpoint of one polygon's edge works, another's
 * doesn't, and it varies by geometry/zoom) — empirically confirmed across
 * hand-drawn and KML-imported polygons at several zoom levels. Sampling a
 * handful of points along the feature's first edge and clicking until a
 * selection lands (visible vertex handles appear) is the reliable, real-DOM
 * interaction that works everywhere it was tried.
 *
 * `d` must be captured *before* any selection happens in the surrounding
 * test: once a feature is selected, Terra Draw's own pane can reorder its
 * rendered paths, so re-querying `nth(index)` after a selection can silently
 * target the wrong (already-selected) feature.
 */
async function selectPolygonPath(page: Page, d: string) {
  const fractions = [0.5, 0.65, 0.35, 0.75, 0.25, 0.85, 0.15];
  for (const t of fractions) {
    const point = pointAtFraction(d, t);
    await page.mouse.click(point.x, point.y);
    if (await vertexHandle(page).count() > 0) return;
  }
  throw new Error('selectPolygonPath: no sampled point along the first edge selected the feature');
}

async function dragHandle(page: Page, handle: Locator, dx: number, dy: number) {
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx, cy + dy, { steps: 8 });
  await page.mouse.up();
}

/**
 * Drags the first vertex handle onto the second, attempting to collapse two
 * distinct vertices into one — which the app rejects (three-distinct-vertex
 * floor) via its own Terra Draw mode validation, surfacing the alert and
 * leaving the geometry unchanged. Landing the drag on the *exact* target
 * coordinate (not just visually on top of it) is sensitive to floating-point
 * rounding through the map's current projection/zoom, so this retries a
 * handful of times against the same handles until the alert appears.
 */
async function collapseFirstVertexOntoSecond(page: Page) {
  const handles = vertexHandle(page);
  for (let attempt = 0; attempt < 6; attempt++) {
    if (await page.getByRole('alert').count() > 0) return;
    const from = await handles.nth(0).boundingBox();
    const to = await handles.nth(1).boundingBox();
    expect(from).not.toBeNull();
    expect(to).not.toBeNull();
    await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
    await page.mouse.down();
    await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 20 });
    await page.mouse.up();
    await page.waitForTimeout(150);
  }
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

    // Enter geometry edit mode, select the feature and drag a vertex to change the area.
    await page.getByRole('button', { name: 'Editar geometria' }).click();
    const d = (await terraDrawPolygonPaths(page).first().getAttribute('d'))!;
    await selectPolygonPath(page, d);
    await dragHandle(page, vertexHandle(page).first(), 60, -60);
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

  test('importa MultiPolygon como uma única entidade, edita uma parte por vez e baixa o relatório em PDF', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel('Selecionar arquivo para importar').setInputFiles(fixture('multipolygon.kml'));

    const list = page.getByRole('list', { name: 'Lista de polígonos' });
    await expect(list.getByRole('button')).toHaveCount(1);

    await page.getByRole('button', { name: /Gleba Composta/ }).click();
    await expect(page.getByRole('heading', { name: 'Gleba Composta' })).toBeVisible();

    // Enter geometry edit mode: both parts are loaded, but only one is
    // ever selected/editable at a time ("uma parte por vez").
    await page.getByRole('button', { name: 'Editar geometria' }).click();
    const parts = terraDrawPolygonPaths(page);
    const part0d = (await parts.nth(0).getAttribute('d'))!;
    const part1d = (await parts.nth(1).getAttribute('d'))!;

    await selectPolygonPath(page, part0d);
    const part0Handles = vertexHandle(page);
    await expect(part0Handles).toHaveCount(3);
    const part0Boxes = await Promise.all(
      (await part0Handles.all()).map((handle) => handle.boundingBox()),
    );

    // Selecting the second part moves the selection: only its handles remain.
    await selectPolygonPath(page, part1d);
    const part1Handles = vertexHandle(page);
    await expect(part1Handles).toHaveCount(3);
    const part1Boxes = await Promise.all(
      (await part1Handles.all()).map((handle) => handle.boundingBox()),
    );
    expect(part1Boxes).not.toEqual(part0Boxes);

    // Edit a vertex of the second part and finish: still a single entity.
    await dragHandle(page, part1Handles.first(), 15, -15);
    await page.getByRole('button', { name: 'Concluir edição de geometria' }).click();
    await page.getByRole('button', { name: 'Voltar à lista' }).click();
    await expect(list.getByRole('button')).toHaveCount(1);

    // Re-enter edit mode and try to push a part below the three-distinct-
    // vertex floor: the app rejects the collapse, surfaces the alert, and
    // the entity (and its vertex count) survive untouched.
    await list.getByRole('button').first().click();
    await page.getByRole('button', { name: 'Editar geometria' }).click();
    const retryPart0d = (await terraDrawPolygonPaths(page).nth(0).getAttribute('d'))!;
    await selectPolygonPath(page, retryPart0d);
    await expect(vertexHandle(page)).toHaveCount(3);

    await collapseFirstVertexOntoSecond(page);
    await expect(page.getByRole('alert')).toContainText('ao menos três vértices distintos');
    await expect(vertexHandle(page)).toHaveCount(3);

    await page.getByRole('button', { name: 'Concluir edição de geometria' }).click();
    await page.getByRole('button', { name: 'Voltar à lista' }).click();
    await expect(list.getByRole('button')).toHaveCount(1);

    await page.getByRole('button', { name: /Gleba Composta/ }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Baixar relatório PDF' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });
});
