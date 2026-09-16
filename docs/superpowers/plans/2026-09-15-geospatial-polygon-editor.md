# Geospatial Polygon Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir um protótipo web client-side que desenha, edita, importa, analisa e exporta Polygon/MultiPolygon sobre mapa satélite, incluindo relatório PDF individual.

**Architecture:** GeoJSON WGS84 é a única geometria persistida no estado; React Context + `useReducer` mantém as entidades e a seleção, enquanto componentes do mapa traduzem eventos imperativos do Leaflet-Geoman em ações tipadas. Cálculos, conversões, KML e PDF ficam em serviços puros nas bordas, permitindo testes sem mapa ou navegador sempre que possível.

**Tech Stack:** React, TypeScript, Vite, Leaflet, React-Leaflet, Leaflet-Geoman, Turf.js, Proj4js, `@tmcw/togeojson`, `tokml`, jsPDF, jspdf-autotable, Vitest, Testing Library e Playwright.

**Spec:** `spec/2026-09-15-geospatial-polygon-editor-design.md`

## Global Constraints

- Executar integralmente no navegador, sem autenticação, backend, API própria ou banco de dados.
- Usar GeoJSON em WGS84 e ordem `[longitude, latitude]` como fonte de verdade.
- Aceitar e manter `GeoJSON.Polygon | GeoJSON.MultiPolygon`; um MultiPolygon é uma entidade lógica única.
- Recalcular a área com Turf após criação, edição e importação; exibir m² e hectares (`1 ha = 10.000 m²`).
- Manter somente um polígono selecionado por vez e não persistir estado após refresh.
- Importar somente Polygon/MultiPolygon; ignorar e contar outros tipos sem modificar o estado se nada válido for encontrado.
- UTM e nomes de vértices são representações derivadas e nunca substituem WGS84.
- Não incluir imagem do mapa no PDF e não antecipar funcionalidades listadas como evolução futura.
- Usar Esri World Imagery como camada satélite inicial, com atribuição visível e aviso não bloqueante em erro de tiles.
- Todo texto visível ao usuário será em português do Brasil.

---

## File Map

```text
src/
├── app/PolygonProvider.tsx          # estado, reducer e ações públicas
├── components/MapView/              # Leaflet, tiles, desenho, seleção e edição
├── components/Sidebar/              # lista, propriedades, coordenadas e ações individuais
├── components/Toolbar/              # criação e importação
├── services/geo/                    # área, validação, vértices e UTM
├── services/kml/                    # importação e exportação nas bordas
├── services/pdf/                    # modelo e geração do relatório
├── types/polygon.ts                 # contratos de domínio
├── App.tsx                          # composição das três regiões da tela
└── styles.css                       # layout responsivo e estados visuais
tests/fixtures/                      # KMLs válidos, mistos e inválidos
e2e/polygon-editor.spec.ts           # critérios de aceite críticos
```

### Task 1: Bootstrap testável e shell da aplicação

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `index.html`
- Create: `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `src/test/setup.ts`
- Create: `src/App.test.tsx`

**Interfaces:**
- Consumes: nenhuma.
- Produces: `App(): JSX.Element`, ambiente Vitest/jsdom e scripts `dev`, `build`, `test`, `test:run`, `e2e`.

- [ ] **Step 1: Criar o teste falhando do shell**

```tsx
// src/App.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('exibe as três áreas principais do editor', () => {
    render(<App />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByLabelText('Mapa de polígonos')).toBeInTheDocument();
    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Inicializar o repositório e instalar o scaffold/dependências**

Run:
```bash
git init
npm create vite@latest . -- --template react-ts
npm install leaflet react-leaflet @geoman-io/leaflet-geoman-free @turf/area @turf/helpers proj4 @tmcw/togeojson tokml jspdf jspdf-autotable
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/leaflet @types/geojson @types/tokml @playwright/test
```

Expected: `.git/` existe, `package.json` contém somente dependências client-side e o scaffold compila.

- [ ] **Step 3: Configurar Vitest e executar o teste vermelho**

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: './src/test/setup.ts' },
});
```

```ts
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
```

Run: `npm run test:run -- src/App.test.tsx`

Expected: FAIL porque as três regiões ainda não existem.

- [ ] **Step 4: Implementar o shell mínimo**

```tsx
// src/App.tsx
export default function App() {
  return (
    <div className="app-shell">
      <header><h1>Editor de Polígonos</h1></header>
      <main aria-label="Mapa de polígonos" />
      <aside aria-label="Painel de polígonos" />
    </div>
  );
}
```

Definir em `styles.css` um grid com toolbar no topo, mapa flexível e sidebar de `minmax(320px, 28vw)`; abaixo de 800 px, empilhar sidebar sob o mapa.

- [ ] **Step 5: Verificar e commitar**

Run: `npm run test:run && npm run build`

Expected: testes e build passam.

```bash
git add package.json package-lock.json vite.config.ts tsconfig*.json index.html src
git commit -m "chore: bootstrap polygon editor"
```

### Task 2: Modelo de domínio e reducer isolado

**Files:**
- Create: `src/types/polygon.ts`
- Create: `src/app/polygonReducer.ts`, `src/app/PolygonProvider.tsx`
- Create: `src/app/polygonReducer.test.ts`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: tipos `GeoJSON.Polygon` e `GeoJSON.MultiPolygon`.
- Produces: `PolygonEntity`, `CustomField`, `AppState`, `polygonReducer(state, action)`, `usePolygons()` com `addPolygon`, `updateProperties`, `updateGeometry`, `selectPolygon`, `setEditing`, `setDrawing`, `deleteSelected`.

- [ ] **Step 1: Escrever testes do reducer**

```ts
it('adiciona e seleciona uma nova entidade sem alterar as existentes', () => {
  const next = polygonReducer(initialState, { type: 'polygon/added', polygon });
  expect(next.polygons).toEqual([polygon]);
  expect(next.selectedPolygonId).toBe(polygon.id);
});

it('exclui somente o selecionado e encerra sua edição', () => {
  const next = polygonReducer(twoPolygonState, { type: 'selected/deleted' });
  expect(next.polygons.map(({ id }) => id)).toEqual(['other']);
  expect(next.selectedPolygonId).toBeNull();
  expect(next.editingPolygonId).toBeNull();
});
```

- [ ] **Step 2: Confirmar falha por contratos ausentes**

Run: `npm run test:run -- src/app/polygonReducer.test.ts`

Expected: FAIL ao importar `polygonReducer`.

- [ ] **Step 3: Definir contratos e ações discriminadas**

```ts
export interface CustomField { id: string; key: string; label: string; value: string }
export interface PolygonEntity {
  id: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  properties: { name: string; description: string; createdAt: string; customFields: CustomField[] };
  calculated: { areaSquareMeters: number };
}
export interface AppState {
  polygons: PolygonEntity[];
  selectedPolygonId: string | null;
  editingPolygonId: string | null;
  drawingMode: boolean;
}
```

Implementar ações imutáveis; em `geometry/updated`, substituir somente a entidade alvo; em `selected/deleted`, filtrar somente `selectedPolygonId`. O Provider deve lançar erro claro quando `usePolygons()` for usado fora dele.

- [ ] **Step 4: Verificar reducer e integração do Provider**

Run: `npm run test:run -- src/app/polygonReducer.test.ts && npm run build`

Expected: PASS; TypeScript não permite geometria Point/LineString.

- [ ] **Step 5: Commit**

```bash
git add src/app src/types src/main.tsx
git commit -m "feat: add polygon domain state"
```

### Task 3: Serviços geoespaciais puros

**Files:**
- Create: `src/services/geo/calculateArea.ts`
- Create: `src/services/geo/polygonUtils.ts`
- Create: `src/services/geo/coordinateConverter.ts`
- Create: `src/services/geo/*.test.ts`

**Interfaces:**
- Consumes: `GeoJSON.Polygon | GeoJSON.MultiPolygon`, posições `[longitude, latitude]`.
- Produces: `calculateAreaSquareMeters(geometry): number`, `toHectares(m2): number`, `isValidPolygonGeometry(geometry): boolean`, `listVertices(geometry): Vertex[]`, `vertexLabel(index): string`, `toUtm(position): UtmCoordinate`.

- [ ] **Step 1: Cobrir área, validade, rótulos e UTM com testes falhando**

```ts
expect(toHectares(25_000)).toBe(2.5);
expect(vertexLabel(0)).toBe('A');
expect(vertexLabel(25)).toBe('Z');
expect(vertexLabel(26)).toBe('AA');
expect(isValidPolygonGeometry(validTriangle)).toBe(true);
expect(isValidPolygonGeometry(repeatedTwoPointRing)).toBe(false);
expect(toUtm([-46.6333, -23.5505])).toMatchObject({ zone: 23, hemisphere: 'S' });
```

Adicionar teste de `listVertices` que omite a coordenada de fechamento repetida e identifica partes/anéis em MultiPolygon sem misturá-los.

- [ ] **Step 2: Executar o conjunto vermelho**

Run: `npm run test:run -- src/services/geo`

Expected: FAIL por módulos ausentes.

- [ ] **Step 3: Implementar cálculos e normalização**

```ts
export const calculateAreaSquareMeters = (geometry: PolygonGeometry) =>
  area(feature(geometry));
export const toHectares = (squareMeters: number) => squareMeters / 10_000;
export const vertexLabel = (index: number) => {
  let n = index + 1, label = '';
  while (n > 0) { n--; label = String.fromCharCode(65 + (n % 26)) + label; n = Math.floor(n / 26); }
  return label;
};
```

Validar cada anel com fechamento, quatro posições e pelo menos três posições distintas. Para UTM, usar `zone = Math.floor((longitude + 180) / 6) + 1`, limitar a 1–60, escolher `+south` quando latitude `< 0` e converter de `EPSG:4326` com Proj4.

- [ ] **Step 4: Verificar resultados numéricos**

Run: `npm run test:run -- src/services/geo`

Expected: PASS; teste UTM usa tolerância de 2 m para Easting/Northing e área usa tolerância relativa, não igualdade exata.

- [ ] **Step 5: Commit**

```bash
git add src/services/geo
git commit -m "feat: add polygon geometry calculations"
```

### Task 4: Mapa satélite e feedback de tiles

**Files:**
- Create: `src/components/MapView/MapView.tsx`, `SatelliteLayer.tsx`, `MapStatus.tsx`
- Create: `src/components/MapView/MapView.test.tsx`
- Modify: `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `usePolygons()` para renderização futura.
- Produces: mapa navegável, `SatelliteLayer({ onAvailabilityChange })` e alerta `Camada de satélite indisponível.`.

- [ ] **Step 1: Testar estado de falha sem depender da rede**

Mockar `react-leaflet` e disparar `tileerror`; verificar `role="status"` com a mensagem de indisponibilidade e que o shell/sidebar permanecem renderizados.

- [ ] **Step 2: Executar teste vermelho**

Run: `npm run test:run -- src/components/MapView/MapView.test.tsx`

Expected: FAIL porque `MapView` não existe.

- [ ] **Step 3: Implementar mapa e camada**

```tsx
<MapContainer center={[-15.78, -47.93]} zoom={4} minZoom={2} className="map">
  <TileLayer
    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    attribution="Tiles &copy; Esri"
    eventHandlers={{ tileerror: () => onAvailabilityChange(false), load: () => onAvailabilityChange(true) }}
  />
</MapContainer>
```

Importar CSS do Leaflet e Geoman em `main.tsx`. Garantir altura real do container (`100%`, mínimo 420 px) e foco visível nos controles.

- [ ] **Step 4: Verificar**

Run: `npm run test:run -- src/components/MapView && npm run build`

Expected: PASS e nenhuma dependência do tile remoto durante os testes.

- [ ] **Step 5: Commit**

```bash
git add src/components/MapView src/App.tsx src/main.tsx src/styles.css
git commit -m "feat: add satellite map"
```

### Task 5: Desenho, renderização, seleção e edição Geoman

**Files:**
- Create: `src/components/MapView/PolygonLayer.tsx`, `GeomanController.tsx`, `leafletGeometry.ts`
- Create: `src/components/MapView/leafletGeometry.test.ts`, `GeomanController.test.tsx`
- Create: `src/components/Toolbar/DrawPolygonButton.tsx`, `Toolbar.tsx`
- Modify: `src/components/MapView/MapView.tsx`, `src/App.tsx`

**Interfaces:**
- Consumes: `isValidPolygonGeometry`, `calculateAreaSquareMeters`, store actions.
- Produces: `layerToGeometry(layer): PolygonGeometry`, `createPolygonEntity(geometry): PolygonEntity`; eventos `pm:create`, `pm:edit`, `pm:vertexadded`, `pm:vertexremoved` atualizam o store.

- [ ] **Step 1: Testar adaptação e criação**

```ts
it('cria entidade com id, data, área e seleção', () => {
  vi.stubGlobal('crypto', { randomUUID: () => 'polygon-1' });
  const entity = createPolygonEntity(triangle);
  expect(entity).toMatchObject({ id: 'polygon-1', properties: { name: 'Polígono sem nome' } });
  expect(entity.calculated.areaSquareMeters).toBeGreaterThan(0);
});
```

Testar que geometria inválida retorna erro tipado `InvalidPolygonGeometryError` e não despacha atualização.

- [ ] **Step 2: Confirmar falha**

Run: `npm run test:run -- src/components/MapView`

Expected: FAIL nos adaptadores ausentes.

- [ ] **Step 3: Implementar controlador imperativo**

No clique em “Criar polígono”, chamar `map.pm.enableDraw('Polygon', { snappable: false })`. Em `pm:create`, converter `layer.toGeoJSON().geometry`, validar, calcular, adicionar e desativar desenho. Em edição, ativar apenas layers da entidade selecionada; para MultiPolygon, editar todas as partes e remontá-las na ordem original antes de uma única ação `geometry/updated`.

```ts
const commitGeometry = (id: string, geometry: PolygonGeometry) => {
  if (!isValidPolygonGeometry(geometry)) throw new InvalidPolygonGeometryError();
  updateGeometry(id, geometry, calculateAreaSquareMeters(geometry));
};
```

Reverter para a última geometria válida em erro de remoção e exibir `O polígono precisa manter ao menos três vértices distintos.`.

- [ ] **Step 4: Implementar renderização/seleção**

Renderizar `GeoJSON` por entidade com estilo selecionado `{ color: '#f59e0b', weight: 4, fillOpacity: .28 }` e normal `{ color: '#2563eb', weight: 2, fillOpacity: .18 }`; clique chama `selectPolygon(id)`. Usar `key` derivada de `id` e geometria para atualizar layers após edição.

- [ ] **Step 5: Verificar e commitar**

Run: `npm run test:run -- src/components/MapView && npm run build`

Expected: PASS; listeners são removidos no cleanup e não duplicam após rerender.

```bash
git add src/components/MapView src/components/Toolbar src/App.tsx
git commit -m "feat: draw select and edit polygons"
```

### Task 6: Sidebar, propriedades e campos personalizados

**Files:**
- Create: `src/components/Sidebar/Sidebar.tsx`, `PolygonList.tsx`, `PolygonDetails.tsx`, `CustomFieldsEditor.tsx`
- Create: `src/components/Sidebar/Sidebar.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: entidade selecionada e ações `updateProperties`, `selectPolygon`, `deleteSelected`, `setEditing`.
- Produces: formulários acessíveis; `CustomField` recebe `crypto.randomUUID()` e chaves são normalizadas apenas para exportação, sem apagar o rótulo original.

- [ ] **Step 1: Testar os dois estados da sidebar**

Testar lista quando não há seleção; detalhes quando há; edição de nome/descrição; inclusão/remoção de campo; confirmação antes da exclusão; e que excluir A mantém B intacto.

- [ ] **Step 2: Executar teste vermelho**

Run: `npm run test:run -- src/components/Sidebar/Sidebar.test.tsx`

Expected: FAIL por componentes ausentes.

- [ ] **Step 3: Implementar lista e formulário controlado**

Usar `<button>` para cada item da lista, `<label>` real para todos os inputs e salvar no `onBlur`/submit. Exibir área via `Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })`; hectares usa `toHectares`.

```tsx
<button type="button" onClick={() => addField({
  id: crypto.randomUUID(), key: '', label: '', value: ''
})}>Adicionar campo</button>
```

- [ ] **Step 4: Implementar ações individuais**

“Editar geometria” alterna somente `editingPolygonId`; “Excluir” abre `<dialog>`/confirmação acessível com nome da entidade e só então chama `deleteSelected`.

- [ ] **Step 5: Verificar e commitar**

Run: `npm run test:run -- src/components/Sidebar && npm run build`

Expected: PASS; navegação por teclado alcança lista, campos e ações.

```bash
git add src/components/Sidebar src/styles.css
git commit -m "feat: add polygon properties sidebar"
```

### Task 7: Tabela de coordenadas WGS84 e UTM

**Files:**
- Create: `src/components/Sidebar/CoordinatesTable.tsx`
- Create: `src/components/Sidebar/CoordinatesTable.test.tsx`
- Modify: `src/components/Sidebar/PolygonDetails.tsx`

**Interfaces:**
- Consumes: `listVertices`, `vertexLabel`, `toUtm`.
- Produces: linhas `{ label, latitude, longitude, zoneLabel, easting, northing }`; em MultiPolygon, prefixo visual `Parte N — A` reinicia por anel externo.

- [ ] **Step 1: Testar ordem e formatação**

```tsx
expect(screen.getByRole('columnheader', { name: 'Latitude' })).toBeVisible();
expect(screen.getByText('23,550500° S')).toBeVisible();
expect(screen.getByText('46,633300° O')).toBeVisible();
expect(screen.getByText('23 S')).toBeVisible();
```

Cobrir Polygon com furo e MultiPolygon; não repetir o ponto de fechamento.

- [ ] **Step 2: Executar teste vermelho**

Run: `npm run test:run -- src/components/Sidebar/CoordinatesTable.test.tsx`

Expected: FAIL por tabela ausente.

- [ ] **Step 3: Implementar tabela derivada**

Calcular linhas com `useMemo([geometry])`; mostrar seis casas em graus e duas em metros; incluir caption “Coordenadas dos vértices” e wrapper com overflow horizontal.

- [ ] **Step 4: Verificar e commitar**

Run: `npm run test:run -- src/components/Sidebar/CoordinatesTable.test.tsx`

Expected: PASS.

```bash
git add src/components/Sidebar
git commit -m "feat: show WGS84 and UTM coordinates"
```

### Task 8: Importação KML transacional

**Files:**
- Create: `src/services/kml/importKml.ts`, `src/services/kml/importKml.test.ts`
- Create: `src/components/Toolbar/ImportKmlButton.tsx`, `ImportKmlButton.test.tsx`
- Create: `tests/fixtures/polygon.kml`, `mixed.kml`, `invalid.kml`, `no-polygons.kml`
- Modify: `src/components/Toolbar/Toolbar.tsx`

**Interfaces:**
- Consumes: `@tmcw/togeojson.kml`, validação, cálculo de área e `PolygonEntity`.
- Produces: `parseKml(text): { polygons: PolygonEntity[]; ignoredCount: number }`; erros `InvalidKmlError` e `NoSupportedGeometryError`.

- [ ] **Step 1: Testar entradas válidas, mistas e inválidas**

```ts
expect(parseKml(polygonKml).polygons).toHaveLength(1);
expect(parseKml(mixedKml)).toMatchObject({ ignoredCount: 2 });
expect(() => parseKml(invalidXml)).toThrow(InvalidKmlError);
expect(() => parseKml(pointOnlyKml)).toThrow(NoSupportedGeometryError);
```

Cobrir `GeometryCollection`: extrair Polygon/MultiPolygon compatíveis e contar membros restantes como ignorados.

- [ ] **Step 2: Executar testes vermelhos**

Run: `npm run test:run -- src/services/kml src/components/Toolbar/ImportKmlButton.test.tsx`

Expected: FAIL por importador ausente.

- [ ] **Step 3: Implementar parser sem efeitos colaterais**

Usar `DOMParser`, rejeitar `parsererror`, converter o documento inteiro e montar todas as entidades em memória antes de retornar. Nome vem de `feature.properties.name` ou `Polígono importado`; descrição e propriedades extras viram campos personalizados com ids novos; área sempre é recalculada.

- [ ] **Step 4: Implementar seleção de arquivo e commit atômico**

Aceitar `.kml,application/vnd.google-earth.kml+xml`; ler `file.text()`. Somente após `parseKml` retornar, despachar cada entidade. Em erro, mostrar alerta e não despachar nada; em sucesso misto, informar `N elemento(s) incompatível(is) ignorado(s)`.

- [ ] **Step 5: Verificar e commitar**

Run: `npm run test:run -- src/services/kml src/components/Toolbar && npm run build`

Expected: PASS; invalid/no-polygons preserva a referência do array anterior do store.

```bash
git add src/services/kml src/components/Toolbar tests/fixtures
git commit -m "feat: import polygon KML files"
```

### Task 9: Exportação KML individual

**Files:**
- Create: `src/services/kml/exportKml.ts`, `exportKml.test.ts`
- Modify: `src/components/Sidebar/PolygonDetails.tsx`

**Interfaces:**
- Consumes: `PolygonEntity` selecionada e `tokml`.
- Produces: `serializePolygonKml(entity): string`, `downloadPolygonKml(entity): void`, `safeFilename(name): string`.

- [ ] **Step 1: Escrever round-trip test**

Serializar uma entidade Polygon e uma MultiPolygon, reimportar via `parseKml` e comparar geometria, nome, descrição e campos personalizados; conferir que área reimportada foi recalculada.

- [ ] **Step 2: Executar teste vermelho**

Run: `npm run test:run -- src/services/kml/exportKml.test.ts`

Expected: FAIL por exportador ausente.

- [ ] **Step 3: Implementar Feature e download**

```ts
const feature = {
  type: 'Feature', geometry: entity.geometry,
  properties: {
    name: entity.properties.name,
    description: entity.properties.description,
    areaSquareMeters: entity.calculated.areaSquareMeters,
    ...Object.fromEntries(entity.properties.customFields.map(f => [f.key || f.label, f.value])),
  },
} satisfies GeoJSON.Feature<PolygonGeometry>;
```

Gerar Blob `application/vnd.google-earth.kml+xml;charset=utf-8`, URL temporária, clique e `URL.revokeObjectURL`. Sanitizar nome, com fallback `poligono.kml`.

- [ ] **Step 4: Verificar e commitar**

Run: `npm run test:run -- src/services/kml && npm run build`

Expected: PASS e botão só aparece habilitado quando há seleção.

```bash
git add src/services/kml src/components/Sidebar/PolygonDetails.tsx
git commit -m "feat: export selected polygon as KML"
```

### Task 10: Relatório PDF individual

**Files:**
- Create: `src/services/pdf/buildPolygonReport.ts`, `generatePolygonReport.ts`
- Create: `src/services/pdf/*.test.ts`
- Modify: `src/components/Sidebar/PolygonDetails.tsx`

**Interfaces:**
- Consumes: entidade, `listVertices`, `toUtm`, jsPDF e `jspdf-autotable`.
- Produces: `buildPolygonReport(entity): PolygonReportModel` puro e `generatePolygonReport(entity): void`.

- [ ] **Step 1: Testar o modelo do relatório**

```ts
const report = buildPolygonReport(polygon);
expect(report.title).toBe('Relatório do Polígono');
expect(report.area).toEqual({ squareMeters: expect.any(String), hectares: expect.any(String) });
expect(report.coordinates[0]).toEqual(expect.objectContaining({ point: 'A', utmZone: '23 S' }));
expect(report.customFields).toEqual([{ label: 'Proprietário', value: 'Ana' }]);
```

- [ ] **Step 2: Executar teste vermelho**

Run: `npm run test:run -- src/services/pdf`

Expected: FAIL por serviços ausentes.

- [ ] **Step 3: Implementar modelo e renderização**

Montar modelo sem acessar DOM. No gerador, escrever cabeçalho, nome, descrição, áreas; criar tabela de características (ou “Nenhuma característica cadastrada”) e tabela `Ponto | Latitude | Longitude | Zona UTM | Easting | Northing`. Usar `doc.save(`${safeFilename(name)}.pdf`)` e paginação automática do AutoTable.

- [ ] **Step 4: Tratar falha sem mutar estado**

No clique, envolver geração em `try/catch`, exibir `Não foi possível gerar o PDF. Tente novamente.` e manter entidade/seleção. Mockar `jsPDF` para verificar títulos, colunas e `save` sem comparar bytes instáveis.

- [ ] **Step 5: Verificar e commitar**

Run: `npm run test:run -- src/services/pdf src/components/Sidebar && npm run build`

Expected: PASS.

```bash
git add src/services/pdf src/components/Sidebar/PolygonDetails.tsx
git commit -m "feat: generate polygon PDF report"
```

### Task 11: Estados de interação, acessibilidade e acabamento funcional

**Files:**
- Modify: `src/App.tsx`, `src/styles.css`
- Modify: `src/components/Toolbar/*.tsx`, `src/components/Sidebar/*.tsx`, `src/components/MapView/*.tsx`
- Create: `src/App.integration.test.tsx`

**Interfaces:**
- Consumes: todos os fluxos anteriores.
- Produces: feedback unificado `role="status"`/`role="alert"`, foco previsível, botões bloqueados em estados incompatíveis e layout utilizável em desktop/mobile.

- [ ] **Step 1: Escrever teste de integração do fluxo principal**

Com mapa/Geoman mockados: criar A e B; selecionar A; editar propriedades; simular atualização geométrica; confirmar área nova; excluir A; verificar que B permaneceu e nenhum botão individual atua sem seleção.

- [ ] **Step 2: Executar teste vermelho**

Run: `npm run test:run -- src/App.integration.test.tsx`

Expected: FAIL nos estados/feedback ainda não coordenados.

- [ ] **Step 3: Consolidar regras de interação**

Desabilitar importar enquanto o arquivo é lido; desabilitar novo desenho durante edição; encerrar edição ao trocar seleção; focar o título de detalhes após seleção; focar a lista após exclusão. Alertas de KML/PDF/tiles não podem desmontar mapa nem sidebar.

- [ ] **Step 4: Finalizar estilos sem alterar escopo**

Definir contraste AA, estados hover/focus/disabled, seleção inequívoca no mapa e lista, tabelas legíveis, sidebar rolável e controles com alvo mínimo de 44 px. Não adicionar dashboard, persistência, busca ou imagem no PDF.

- [ ] **Step 5: Verificar e commitar**

Run: `npm run test:run && npm run build`

Expected: PASS sem warnings de `act`, keys duplicadas ou listeners pendentes.

```bash
git add src
git commit -m "feat: polish polygon editor interactions"
```

### Task 12: E2E dos critérios de aceite e documentação de operação

**Files:**
- Create: `playwright.config.ts`, `e2e/polygon-editor.spec.ts`
- Create: `README.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: aplicação completa e fixtures KML.
- Produces: evidência automatizada para CA-01–CA-13 e instruções locais.

- [ ] **Step 1: Configurar Playwright e escrever cenários críticos**

```ts
test('importa, isola, exporta e exclui polígonos', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Importar KML').setInputFiles('tests/fixtures/polygon.kml');
  await expect(page.getByText('Polígono importado')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar KML' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.kml$/);
  await page.getByRole('button', { name: 'Excluir' }).click();
  await page.getByRole('button', { name: 'Confirmar exclusão' }).click();
  await expect(page.getByText('Nenhum polígono cadastrado')).toBeVisible();
});
```

Adicionar cenário Geoman para criar dois triângulos, alternar seleção e mover um vértice; comparar a área antes/depois e confirmar isolamento. Adicionar cenário MultiPolygon importado com uma única entrada lógica e relatório PDF baixado.

- [ ] **Step 2: Executar E2E e corrigir somente falhas observadas**

Run:
```bash
npx playwright install chromium
npm run e2e
```

Expected: todos os cenários passam em Chromium; downloads são capturados pelo teste.

- [ ] **Step 3: Documentar execução e limitações**

No README incluir `npm install`, `npm run dev`, `npm run test:run`, `npm run e2e`, `npm run build`; listar ausência de persistência/backend, suporte apenas a Polygon/MultiPolygon, dependência online dos tiles e atribuição Esri.

- [ ] **Step 4: Rodar a verificação final completa**

Run:
```bash
npm run test:run
npm run build
npm run e2e
```

Expected: unitários, integração, TypeScript/build e E2E passam; validar manualmente pan/zoom, adição/remoção de vértices e legibilidade do PDF aberto.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e README.md package.json package-lock.json
git commit -m "test: cover polygon editor acceptance flows"
```

## Acceptance Traceability

| Critério | Cobertura principal |
|---|---|
| CA-01 mapa, zoom e pan | Tasks 4 e 12 |
| CA-02 criação | Tasks 5 e 12 |
| CA-03 múltiplas geometrias | Tasks 2, 5, 11 e 12 |
| CA-04 edição de vértices | Tasks 5 e 12 |
| CA-05 recálculo de área | Tasks 3, 5 e 12 |
| CA-06 propriedades/campos | Tasks 6 e 11 |
| CA-07 WGS84/UTM | Tasks 3 e 7 |
| CA-08/09 importação e incompatíveis | Task 8 |
| CA-10 exportação | Tasks 9 e 12 |
| CA-11 PDF | Tasks 10 e 12 |
| CA-12 isolamento | Tasks 2, 6, 11 e 12 |
| CA-13 sem backend | Tasks 1 e 12 |
