# Terra Draw Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir completamente Leaflet-Geoman por Terra Draw na criação e edição de polígonos, preservando `PolygonProvider`, o modelo GeoJSON e os demais fluxos da aplicação.

**Architecture:** Uma única instância de `TerraDraw` será criada por `MapView` pelo novo `TerraDrawController`. Funções puras converterão `PolygonEntity` em features `Polygon` do store e recomporão `Polygon`/`MultiPolygon`; durante uma sessão de edição, o Terra Draw renderiza todas as partes e o `PolygonLayer` omite a entidade para impedir duplicação. Criações são confirmadas no evento `finish`, enquanto alterações geométricas existentes são persistidas no evento `change/update`.

**Tech Stack:** React 19, TypeScript 7, Leaflet 1.9, React-Leaflet 5, Terra Draw, `terra-draw-leaflet-adapter`, Turf.js, Vitest/jsdom, Testing Library e Playwright.

**Spec:** `docs/superpowers/specs/2026-09-16-terra-draw-migration-design.md`

## Global Constraints

- A migração cobre criação e edição; não manter dois motores ativos.
- Não alterar `PolygonProvider`, `polygonReducer`, Sidebar, KML, KMZ, DXF, PDF, sobreposições ou `PolygonPicker` além de remover referências textuais/mocks do Geoman.
- `PolygonGeometry` continua sendo `GeoJSON.Polygon | GeoJSON.MultiPolygon` em WGS84.
- Terra Draw recebe apenas features `Polygon`; um `MultiPolygon` é dividido em N features e recomposto antes de `updateGeometry`.
- A edição de `MultiPolygon` é de uma parte por vez, usando o `TerraDrawSelectMode` nativo, sem multi-seleção customizada.
- Uma geometria precisa manter pelo menos três posições distintas.
- A mensagem de erro permanece `O polígono precisa manter ao menos três vértices distintos.` em `<p className="map-status" role="alert">`.
- Manter cor de identidade via `colorForPolygonId`, seleção `#f59e0b` e a semântica visual de espessura/opacidade existente.
- Não mockar Terra Draw no teste de compatibilidade; usar instância e adapter reais.
- Se o adapter real não funcionar em jsdom, manter testes puros no Vitest e mover os testes de interação real para Playwright, conforme a decisão explícita da spec.
- Usar o evento `finish` com `context.action === 'draw'` para confirmar a criação concluída; `change/create` pode ocorrer enquanto a feature ainda é provisória.
- Ignorar eventos `change` cujo `context.origin === 'api'` para não persistir `addFeatures`/`removeFeatures` usados na sincronização.

---

## Estrutura de arquivos

### Criar

- `src/components/MapView/terraDrawGeometry.ts`: conversão, identificação de partes, validação e recomposição GeoJSON sem React/Leaflet.
- `src/components/MapView/terraDrawGeometry.test.ts`: testes unitários das conversões e do `MultiPolygon`.
- `src/components/MapView/createTerraDraw.ts`: factory da instância, adapter, modos, estilos e validação de coordenadas.
- `src/components/MapView/TerraDrawController.tsx`: ciclo de vida React, criação, edição, sincronização com o provider e alerta.
- `src/components/MapView/TerraDrawController.test.tsx`: integração real entre React, Leaflet, Terra Draw e provider quando jsdom suportar o adapter.
- `src/components/MapView/TerraDrawCompatibility.test.tsx`: probe mínimo e isolado do adapter real em jsdom.

### Modificar

- `package.json` e `package-lock.json`: adicionar Terra Draw/adaptador e, ao final, remover Geoman.
- `src/components/MapView/MapView.tsx`: montar `TerraDrawController` no lugar de `GeomanController`.
- `src/components/MapView/PolygonLayer.tsx`: remover edição Geoman e omitir a entidade durante a sessão Terra Draw.
- `src/components/MapView/PolygonLayer.test.tsx`: cobrir ocultação durante edição e preservar estilos normais.
- `src/components/MapView/MapView.test.tsx`: remover shape `map.pm` do mock.
- `src/App.integration.test.tsx`: remover referências e mock `pm` do Geoman.
- `src/main.tsx`: remover CSS do Geoman.
- `e2e/polygon-editor.spec.ts`: adaptar desenho e edição aos elementos renderizados pelo Terra Draw.
- `README.md`: atualizar somente a descrição factual da biblioteca usada pelo protótipo.

### Excluir ao final

- `src/components/MapView/GeomanController.tsx`
- `src/components/MapView/GeomanController.test.tsx`
- `src/components/MapView/leafletGeometry.ts`
- `src/components/MapView/leafletGeometry.test.ts`

---

### Task 1: Instalar Terra Draw e validar o adapter real em jsdom

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/components/MapView/TerraDrawCompatibility.test.tsx`

**Interfaces:**
- Consumes: `L.Map` criado por `react-leaflet` e SVG habilitado com `L.Browser.svg = true`.
- Produces: decisão comprovada de executar integração real no Vitest ou transferi-la ao Playwright; dependências Terra Draw instaladas e compiláveis.

- [ ] **Step 1: Instalar as novas dependências sem remover Geoman ainda**

Run:

```bash
npm install terra-draw terra-draw-leaflet-adapter
```

Expected: `package.json` e `package-lock.json` passam a registrar os dois pacotes; Geoman permanece até o fluxo novo estar verde.

- [ ] **Step 2: Escrever o probe real de compatibilidade**

Crie `TerraDrawCompatibility.test.tsx` sem mocks de Terra Draw:

```tsx
import { cleanup, render, waitFor } from '@testing-library/react';
import L from 'leaflet';
import { useEffect } from 'react';
import { MapContainer, useMap } from 'react-leaflet';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { TerraDraw, TerraDrawPolygonMode } from 'terra-draw';
import { TerraDrawLeafletAdapter } from 'terra-draw-leaflet-adapter';

let draw: TerraDraw | undefined;

beforeAll(() => {
  Object.defineProperty(L.Browser, 'svg', { value: true, configurable: true });
});
afterEach(() => {
  draw?.stop();
  draw = undefined;
  cleanup();
});

function Probe() {
  const map = useMap();
  useEffect(() => {
    draw = new TerraDraw({
      adapter: new TerraDrawLeafletAdapter({ lib: L, map }),
      modes: [new TerraDrawPolygonMode()],
    });
    draw.start();
    draw.addFeatures([{
      id: 'probe',
      type: 'Feature',
      properties: { mode: 'polygon' },
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]] },
    }]);
    return () => draw?.stop();
  }, [map]);
  return null;
}

describe('TerraDrawLeafletAdapter compatibility', () => {
  it('stores and renders a real polygon under jsdom', async () => {
    const view = render(<MapContainer center={[0, 0]} zoom={5}><Probe /></MapContainer>);
    await waitFor(() => expect(draw?.getSnapshotFeature('probe')).toBeDefined());
    expect(view.container.querySelector('.leaflet-overlay-pane path')).not.toBeNull();
  });
});
```

- [ ] **Step 3: Executar o probe isolado**

Run:

```bash
npx vitest run src/components/MapView/TerraDrawCompatibility.test.tsx
```

Expected: PASS com snapshot e path SVG reais. Se falhar por ausência de API DOM/canvas não corrigível com o setup existente, registre o erro no relatório da tarefa, exclua este teste e aplique a decisão já aprovada: integração real em `e2e/polygon-editor.spec.ts`, mantendo no Vitest apenas os testes puros das Tasks 2 e 4.

- [ ] **Step 4: Confirmar que a instalação não quebrou a suíte existente**

Run:

```bash
npm run test:run
npm run build
```

Expected: 104 testes existentes passam e o build conclui; o novo probe adiciona um teste quando jsdom for compatível.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/components/MapView/TerraDrawCompatibility.test.tsx
git commit -m "test: verify Terra Draw Leaflet adapter compatibility"
```

Se o probe tiver sido movido para E2E, não adicione o arquivo excluído; registre a cobertura equivalente na Task 6.

---

### Task 2: Implementar o adaptador GeoJSON puro

**Files:**
- Create: `src/components/MapView/terraDrawGeometry.ts`
- Create: `src/components/MapView/terraDrawGeometry.test.ts`
- Reference: `src/services/geo/polygonUtils.ts`
- Reference: `src/services/geo/calculateArea.ts`
- Reference: `src/types/polygon.ts`

**Interfaces:**
- Consumes: `PolygonEntity`, `PolygonGeometry`, `Feature<Polygon, TerraPolygonProperties>`.
- Produces: `InvalidPolygonGeometryError`, `createPolygonEntity`, `geometryFromTerraFeature`, `featuresForPolygon`, `geometryFromEditingFeatures`, `terraPartId`.

- [ ] **Step 1: Escrever testes falhando para criação e validação**

Em `terraDrawGeometry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  createPolygonEntity,
  geometryFromTerraFeature,
  InvalidPolygonGeometryError,
} from './terraDrawGeometry';

const triangleFeature = {
  id: 'created',
  type: 'Feature' as const,
  properties: { mode: 'polygon' as const, source: 'creation' as const, identityColor: '#f59e0b' },
  geometry: { type: 'Polygon' as const, coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]] },
};

it('converts a valid Terra Draw feature and derives a complete entity', () => {
  expect(geometryFromTerraFeature(triangleFeature)).toEqual(triangleFeature.geometry);
  const entity = createPolygonEntity(triangleFeature.geometry);
  expect(entity.properties.name).toBe('Polígono sem nome');
  expect(entity.calculated.areaSquareMeters).toBeGreaterThan(0);
});

it('rejects a Terra Draw polygon with fewer than three distinct positions', () => {
  expect(() => geometryFromTerraFeature({
    ...triangleFeature,
    geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [0, 0]]] },
  })).toThrow(InvalidPolygonGeometryError);
});
```

- [ ] **Step 2: Escrever testes falhando para divisão e recomposição de MultiPolygon**

```ts
import { featuresForPolygon, geometryFromEditingFeatures, terraPartId } from './terraDrawGeometry';

it('splits and recomposes a MultiPolygon in stable part order', () => {
  const entity = createPolygonEntity({
    type: 'MultiPolygon',
    coordinates: [
      [[[0, 0], [1, 0], [0, 1], [0, 0]]],
      [[[5, 5], [8, 5], [5, 8], [5, 5]]],
    ],
  });
  entity.id = 'multi';
  const features = featuresForPolygon(entity);
  expect(features.map(feature => feature.id)).toEqual([
    terraPartId('multi', 0),
    terraPartId('multi', 1),
  ]);
  features[1].geometry.coordinates[0][1] = [9, 5];
  expect(geometryFromEditingFeatures(entity.geometry, features)).toEqual({
    type: 'MultiPolygon',
    coordinates: [entity.geometry.coordinates[0], features[1].geometry.coordinates],
  });
});

it('rejects a missing or duplicated multipart index', () => {
  const entity = createPolygonEntity({
    type: 'MultiPolygon',
    coordinates: [
      [[[0, 0], [1, 0], [0, 1], [0, 0]]],
      [[[5, 5], [8, 5], [5, 8], [5, 5]]],
    ],
  });
  const [first] = featuresForPolygon(entity);
  expect(() => geometryFromEditingFeatures(entity.geometry, [first])).toThrow(InvalidPolygonGeometryError);
});
```

- [ ] **Step 3: Executar os testes para confirmar falha**

Run:

```bash
npx vitest run src/components/MapView/terraDrawGeometry.test.ts
```

Expected: FAIL porque `terraDrawGeometry.ts` ainda não existe.

- [ ] **Step 4: Implementar contratos e validação**

Crie `terraDrawGeometry.ts` com estas assinaturas e propriedades exatas:

```ts
import type { Feature, GeoJsonProperties, Polygon } from 'geojson';
import { calculateAreaSquareMeters } from '../../services/geo/calculateArea';
import { isValidPolygonGeometry } from '../../services/geo/polygonUtils';
import type { PolygonEntity, PolygonGeometry } from '../../types/polygon';

export const INVALID_POLYGON_MESSAGE = 'O polígono precisa manter ao menos três vértices distintos.';

export class InvalidPolygonGeometryError extends Error {
  constructor() {
    super(INVALID_POLYGON_MESSAGE);
    this.name = 'InvalidPolygonGeometryError';
  }
}

export interface TerraPolygonProperties extends GeoJsonProperties {
  mode: 'polygon';
  source: 'creation' | 'editing';
  identityColor: string;
  polygonId?: string;
  partIndex?: number;
}

export type TerraPolygonFeature = Feature<Polygon, TerraPolygonProperties>;

export const terraPartId = (polygonId: string, partIndex: number): string =>
  `polygon:${polygonId}:part:${partIndex}`;

export function geometryFromTerraFeature(feature: Feature): PolygonGeometry;
export function createPolygonEntity(geometry: PolygonGeometry): PolygonEntity;
export function featuresForPolygon(entity: PolygonEntity): TerraPolygonFeature[];
export function geometryFromEditingFeatures(
  original: PolygonGeometry,
  features: TerraPolygonFeature[],
): PolygonGeometry;
```

Regras da implementação:

- `geometryFromTerraFeature` aceita somente `geometry.type === 'Polygon'` e usa `isValidPolygonGeometry`.
- `featuresForPolygon` preserva anéis internos, atribui `mode`, `source`, `polygonId`, `partIndex` e `identityColor: colorForPolygonId(entity.id)`.
- `geometryFromEditingFeatures` filtra por `source === 'editing'`, ordena por `partIndex`, exige exatamente uma feature por parte e valida o resultado.
- `createPolygonEntity` mantém o contrato atual de nome/data/campos e calcula área com `calculateAreaSquareMeters`.

- [ ] **Step 5: Executar os testes unitários**

Run:

```bash
npx vitest run src/components/MapView/terraDrawGeometry.test.ts
```

Expected: PASS para conversão, rejeição, ids, ordem e recomposição.

- [ ] **Step 6: Commit**

```bash
git add src/components/MapView/terraDrawGeometry.ts src/components/MapView/terraDrawGeometry.test.ts
git commit -m "feat: add Terra Draw geometry adapters"
```

---

### Task 3: Criar a instância única e migrar o fluxo de criação

**Files:**
- Create: `src/components/MapView/createTerraDraw.ts`
- Create: `src/components/MapView/TerraDrawController.tsx`
- Create: `src/components/MapView/TerraDrawController.test.tsx`
- Modify: `src/components/MapView/MapView.tsx`

**Interfaces:**
- Consumes: `L.Map`, handlers de criação/atualização/erro, `usePolygons()` e helpers da Task 2.
- Produces: `createTerraDraw(map, handlers): TerraDraw`, `TerraDrawController`, uma instância iniciada/parada por montagem e criação confirmada em `finish`.

- [ ] **Step 1: Escrever o teste falhando do lifecycle e criação**

O teste deve montar `MapContainer`, `PolygonProvider`, Toolbar e controller real. Use uma prop de observação restrita ao componente interno:

```tsx
export interface TerraDrawControllerProps {
  onDrawReady?: (draw: TerraDraw) => void;
}
```

Teste essencial:

```tsx
const clickMap = (element: HTMLElement, clientX: number, clientY: number) => {
  fireEvent.pointerDown(element, { clientX, clientY, pointerId: 1, button: 0 });
  fireEvent.pointerUp(element, { clientX, clientY, pointerId: 1, button: 0 });
};

it('creates one entity on draw finish, removes the transient feature and returns to select', async () => {
  const view = render(<Editor onDrawReady={value => { draw = value; }} />);
  const mapElement = view.container.querySelector('.leaflet-container') as HTMLElement;
  Object.defineProperty(mapElement, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }),
  });
  fireEvent.click(screen.getByRole('button', { name: 'Criar polígono' }));
  expect(draw.getMode()).toBe('polygon');

  clickMap(mapElement, 200, 300);
  clickMap(mapElement, 300, 300);
  clickMap(mapElement, 250, 200);
  clickMap(mapElement, 200, 300);

  expect(store.polygons).toHaveLength(1);
  expect(store.selectedPolygonId).toBe(store.polygons[0].id);
  expect(store.drawingMode).toBe(false);
  expect(draw.getSnapshot().filter(feature => feature.properties.source === 'creation')).toHaveLength(0);
  expect(draw.getMode()).toBe('select');
});
```

Não acesse campos privados do Terra Draw. Se a Task 1 determinou Playwright, mova essa asserção integral para a Task 6 e mantenha aqui testes da factory e de funções puras.

- [ ] **Step 2: Executar para confirmar falha**

Run:

```bash
npx vitest run src/components/MapView/TerraDrawController.test.tsx
```

Expected: FAIL porque controller/factory ainda não existem.

- [ ] **Step 3: Implementar a factory**

Em `createTerraDraw.ts`, exponha:

```ts
import L from 'leaflet';
import {
  TerraDraw,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
} from 'terra-draw';
import { TerraDrawLeafletAdapter } from 'terra-draw-leaflet-adapter';
import { INVALID_POLYGON_MESSAGE } from './terraDrawGeometry';

export interface TerraDrawHandlers {
  onInvalidGeometry: (message: string) => void;
}

export function createTerraDraw(map: L.Map, handlers: TerraDrawHandlers): TerraDraw {
  return new TerraDraw({
    adapter: new TerraDrawLeafletAdapter({
      lib: L,
      map,
      ignoreMismatchedPointerEvents: true,
    }),
    modes: [
      new TerraDrawPolygonMode({
        styles: {
          fillColor: '#f59e0b',
          outlineColor: '#f59e0b',
          fillOpacity: 0.34,
          outlineWidth: 5,
        },
        validation: feature =>
          isValidPolygonFeature(feature)
            ? { valid: true }
            : { valid: false, reason: INVALID_POLYGON_MESSAGE },
      }),
      new TerraDrawSelectMode({
        allowManualSelection: true,
        allowManualDeselection: true,
        flags: {
          polygon: {
            feature: {
              draggable: false,
              coordinates: {
                midpoints: true,
                draggable: true,
                deletable: true,
                validation: feature => {
                  const valid = isValidPolygonFeature(feature);
                  if (!valid) handlers.onInvalidGeometry(INVALID_POLYGON_MESSAGE);
                  return valid
                    ? { valid: true }
                    : { valid: false, reason: INVALID_POLYGON_MESSAGE };
                },
              },
            },
          },
        },
        styles: {
          fillColor: ({ properties }) => String(properties.identityColor ?? '#f59e0b'),
          outlineColor: ({ properties }) => String(properties.identityColor ?? '#f59e0b'),
          fillOpacity: ({ properties }) => properties.selected ? 0.34 : 0.18,
          outlineWidth: ({ properties }) => properties.selected ? 5 : 2,
        },
      }),
    ],
  });
}
```

Implemente `isValidPolygonFeature` dentro do arquivo usando `geometryFromTerraFeature` em `try/catch`. Ajuste somente nomes de opções se o compilador da versão instalada indicar a assinatura oficial equivalente; não reduza as regras.

- [ ] **Step 4: Implementar lifecycle e criação no controller**

`TerraDrawController` deve:

- criar a instância uma vez por `map`;
- chamar `draw.start()` e iniciar em `select`;
- registrar `finish`, `change`, `select` e `deselect` uma única vez;
- em `finish` com `action === 'draw'`, buscar `getSnapshotFeature(id)`, criar entidade, remover a feature, adicionar ao provider, limpar erro e `setDrawing(false)`;
- em erro de criação, remover a feature, mostrar a mensagem e `setDrawing(false)`;
- quando `drawingMode` mudar, usar `polygon` ou `select`;
- ao cancelar desenho, remover somente features `source === 'creation'`/`currentlyDrawing`, sem remover features de edição;
- no cleanup, remover listeners, limpar o store e chamar `draw.stop()`.

Use refs para as actions, como o controller atual, impedindo recriação da instância quando o provider renderizar novamente.

- [ ] **Step 5: Trocar o controller no MapView**

Em `MapView.tsx`:

```tsx
import { TerraDrawController } from './TerraDrawController';

// ...
<TerraDrawController />
```

Remova import e uso de `GeomanController`, mas ainda não exclua os arquivos antigos.

- [ ] **Step 6: Executar testes focados e build**

Run:

```bash
npx vitest run src/components/MapView/TerraDrawCompatibility.test.tsx src/components/MapView/terraDrawGeometry.test.ts src/components/MapView/TerraDrawController.test.tsx
npm run build
```

Expected: criação válida, inválida, cancelamento e cleanup passam; build sem erros de tipos.

- [ ] **Step 7: Commit**

```bash
git add src/components/MapView/createTerraDraw.ts src/components/MapView/TerraDrawController.tsx src/components/MapView/TerraDrawController.test.tsx src/components/MapView/MapView.tsx
git commit -m "feat: migrate polygon creation to Terra Draw"
```

---

### Task 4: Migrar edição e MultiPolygon para o store Terra Draw

**Files:**
- Modify: `src/components/MapView/TerraDrawController.tsx`
- Modify: `src/components/MapView/TerraDrawController.test.tsx`
- Modify: `src/components/MapView/PolygonLayer.tsx`
- Modify: `src/components/MapView/PolygonLayer.test.tsx`

**Interfaces:**
- Consumes: `featuresForPolygon`, `geometryFromEditingFeatures`, `calculateAreaSquareMeters`, `editingPolygonId`.
- Produces: sincronização sessão ↔ store, edição de uma parte por vez e `PolygonLayer` oculto somente para a entidade em edição.

- [ ] **Step 1: Escrever testes falhando do lifecycle de edição**

Adicione ao controller:

```tsx
it('loads every MultiPolygon part, commits one edited part and clears them on exit', () => {
  const entity = createPolygonEntity(multiPolygon);
  act(() => { store.addPolygon(entity); store.setEditing(entity.id); });

  const editing = draw.getSnapshot().filter(feature => feature.properties.polygonId === entity.id);
  expect(editing).toHaveLength(2);
  expect(editing.map(feature => feature.properties.partIndex)).toEqual([0, 1]);

  draw.updateFeatureGeometry(editing[1].id!, {
    type: 'Polygon',
    coordinates: [[[5, 5], [9, 5], [5, 8], [5, 5]]],
  });

  expect(store.polygons[0].geometry).toEqual({
    type: 'MultiPolygon',
    coordinates: [multiPolygon.coordinates[0], [[[5, 5], [9, 5], [5, 8], [5, 5]]]],
  });

  act(() => store.setEditing(null));
  expect(draw.getSnapshot().filter(feature => feature.properties.polygonId === entity.id)).toHaveLength(0);
});
```

Adicione casos que confirmem:

- apenas uma feature possui `properties.selected === true` após clicar/selecionar uma parte;
- `change` com `context.origin === 'api'` não chama `updateGeometry`;
- sair de edição restaura modo `select` vazio;
- trocar diretamente de A para B remove features de A antes de carregar B.

- [ ] **Step 2: Escrever teste falhando de validação de remoção**

Com interação real ou pelo harness aprovado na Task 1, tente remover o terceiro vértice. Asserções obrigatórias:

```tsx
expect(store.polygons[0]).toBe(before);
expect(screen.getByRole('alert')).toHaveTextContent('ao menos três vértices distintos');
expect(draw.getSnapshotFeature(partId)?.geometry).toEqual(before.geometry);
```

- [ ] **Step 3: Escrever teste falhando do PolygonLayer sem duplicação**

Em `PolygonLayer.test.tsx`, monte a entidade em edição e verifique:

```tsx
expect(mapLayersForPolygon()).toHaveLength(0);
```

Depois encerre a edição e confirme que o `<GeoJSON>` volta com cor/estilo normal. Preserve os testes atuais de seleção e sobreposição fora de edição.

- [ ] **Step 4: Executar para confirmar falhas**

Run:

```bash
npx vitest run src/components/MapView/TerraDrawController.test.tsx src/components/MapView/PolygonLayer.test.tsx
```

Expected: FAIL nos novos casos porque a sincronização de edição ainda não existe.

- [ ] **Step 5: Implementar a sincronização da sessão de edição**

No controller, mantenha refs explícitas:

```ts
const editingSessionRef = useRef<{
  polygonId: string;
  featureIds: string[];
} | null>(null);
```

Quando `editingPolygonId` mudar:

1. remova `featureIds` da sessão anterior com `draw.removeFeatures`;
2. encontre a entidade atual em `polygons`;
3. adicione `featuresForPolygon(entity)` com `draw.addFeatures`;
4. falhe visivelmente se qualquer resultado tiver `valid === false`;
5. guarde os ids retornados;
6. entre em `select`;
7. não selecione automaticamente todas as partes.

No handler de `change`:

```ts
if (type !== 'update' || context?.origin === 'api' || context?.target === 'properties') return;
const session = editingSessionRef.current;
if (!session || !ids.some(id => session.featureIds.includes(String(id)))) return;
const entity = current.current.polygons.find(item => item.id === session.polygonId);
if (!entity) return;
const features = draw.getSnapshot()
  .filter(isEditingFeatureFor(session.polygonId));
const geometry = geometryFromEditingFeatures(entity.geometry, features);
current.current.updateGeometry(entity.id, geometry, calculateAreaSquareMeters(geometry));
setError(null);
```

Não repopule o store a cada `polygon.geometry` atualizado: isso desmontaria os handles depois de cada vértice, repetindo o problema documentado do Geoman. A sessão é carregada uma vez por mudança de `editingPolygonId`.

- [ ] **Step 6: Simplificar PolygonLayer**

Remova imports, refs, estados e effects de Geoman. Calcule:

```ts
const editing = selectedPolygonId === polygon.id
  && editingPolygonId === polygon.id
  && !drawingMode;

if (editing) return null;
```

Mantenha integralmente a construção de `FeatureCollection`, cor de identidade, seleção, sobreposição, `dashArray` e halo para os estados não editáveis.

- [ ] **Step 7: Executar testes focados e suíte completa**

Run:

```bash
npx vitest run src/components/MapView/TerraDrawController.test.tsx src/components/MapView/PolygonLayer.test.tsx src/components/MapView/terraDrawGeometry.test.ts
npm run test:run
```

Expected: criação, edição simples, edição multipart, bloqueio do terceiro vértice, ocultação e restauração passam; eventuais testes antigos do Geoman ainda podem falhar e serão removidos na Task 5.

- [ ] **Step 8: Commit**

```bash
git add src/components/MapView/TerraDrawController.tsx src/components/MapView/TerraDrawController.test.tsx src/components/MapView/PolygonLayer.tsx src/components/MapView/PolygonLayer.test.tsx
git commit -m "feat: migrate polygon editing to Terra Draw"
```

---

### Task 5: Remover Leaflet-Geoman e limpar referências antigas

**Files:**
- Delete: `src/components/MapView/GeomanController.tsx`
- Delete: `src/components/MapView/GeomanController.test.tsx`
- Delete: `src/components/MapView/leafletGeometry.ts`
- Delete: `src/components/MapView/leafletGeometry.test.ts`
- Modify: `src/main.tsx`
- Modify: `src/components/MapView/MapView.test.tsx`
- Modify: `src/App.integration.test.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: fluxo Terra Draw verde das Tasks 3–4.
- Produces: bundle, tipos e testes sem qualquer dependência ou símbolo Geoman.

- [ ] **Step 1: Atualizar mocks e comentários de integração**

Em `MapView.test.tsx` e `App.integration.test.tsx`, remova `pm` do objeto map e substitua comentários como “standing in for Geoman” por “standing in for the map editor”. O mock mínimo fica:

```ts
const leaflet = vi.hoisted(() => ({
  map: { on: vi.fn(), off: vi.fn() },
}));
```

Se `TerraDrawController` for montado nesses testes mockados, mocke apenas o componente local:

```ts
vi.mock('./components/MapView/TerraDrawController', () => ({
  TerraDrawController: () => null,
}));
```

Não mocke o pacote Terra Draw nos testes dedicados do controller.

- [ ] **Step 2: Excluir implementação e testes Geoman**

Remova os quatro arquivos listados em **Delete**. Antes da exclusão, confirme que `createPolygonEntity` e `InvalidPolygonGeometryError` já são importados de `terraDrawGeometry.ts` em todos os consumidores.

- [ ] **Step 3: Remover CSS e pacote**

Remova de `src/main.tsx`:

```ts
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
```

Run:

```bash
npm uninstall @geoman-io/leaflet-geoman-free
```

- [ ] **Step 4: Provar ausência de referências**

Run:

```bash
rg -n "Geoman|leaflet-geoman|map\.pm|layer\.pm|pm:" src e2e package.json package-lock.json
```

Expected: nenhum resultado. Referências históricas na spec e no plano são permitidas porque documentam a migração.

- [ ] **Step 5: Executar suíte e build**

Run:

```bash
npm run test:run
npm run build
```

Expected: todos os testes Vitest passam; build conclui sem Geoman no grafo.

- [ ] **Step 6: Commit**

```bash
git add -A package.json package-lock.json src
git commit -m "refactor: remove Leaflet-Geoman integration"
```

---

### Task 6: Atualizar E2E, README e executar a verificação final

**Files:**
- Modify: `e2e/polygon-editor.spec.ts`
- Modify: `README.md`
- Modify or delete: `src/components/MapView/TerraDrawCompatibility.test.tsx` conforme resultado da Task 1

**Interfaces:**
- Consumes: aplicação completa sem Geoman.
- Produces: jornadas reais de criação/edição Terra Draw e documentação factual atualizada.

- [ ] **Step 1: Atualizar o helper E2E de desenho**

Mantenha os mesmos três pontos, mas feche conforme o comportamento real do `TerraDrawPolygonMode`. Prefira duplo clique no último ponto; se a versão instalada usar clique no primeiro ponto, use o fechamento observado no browser e registre-o no comentário:

```ts
/** Draws a triangle with Terra Draw against the real Leaflet map. */
async function drawTriangle(page: Page, origin: { x: number; y: number }) {
  await page.getByRole('button', { name: 'Criar polígono' }).click();
  const map = page.locator('.leaflet-container');
  const p1 = { x: origin.x, y: origin.y };
  const p2 = { x: origin.x + 80, y: origin.y };
  const p3 = { x: origin.x + 40, y: origin.y - 80 };
  await map.click({ position: p1 });
  await map.click({ position: p2 });
  await map.dblclick({ position: p3 });
}
```

- [ ] **Step 2: Atualizar o E2E de edição**

Não selecione `.leaflet-marker-icon`, pois era detalhe do Geoman. Entre em edição, selecione a feature Terra Draw e arraste o handle SVG identificado no DOM real. Use um seletor estável adicionado pelo adapter somente se ele existir; caso contrário, localize o handle pelo elemento/círculo visível dentro da overlay pane:

```ts
await page.getByRole('button', { name: 'Editar geometria' }).click();
await page.locator('.leaflet-overlay-pane path').filter({ visible: true }).first().click();
const handle = page.locator('.leaflet-overlay-pane circle').first();
const box = await handle.boundingBox();
expect(box).not.toBeNull();
await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
await page.mouse.down();
await page.mouse.move(box!.x + box!.width / 2 + 60, box!.y + box!.height / 2 - 60, { steps: 5 });
await page.mouse.up();
```

Se o adapter renderizar handles como markers/divs, use a classe real inspecionada no browser e encapsule-a em `vertexHandle(page)` para concentrar o detalhe em um lugar.

- [ ] **Step 3: Adicionar cenário E2E de MultiPolygon e validação**

Amplie o cenário de `multipolygon.kml`:

1. entre em edição;
2. clique na primeira parte e verifique apenas um conjunto de handles;
3. clique na segunda parte e verifique que a seleção migrou;
4. edite um vértice da segunda parte;
5. conclua e confirme que continua uma entidade na lista;
6. tente remover vértices até o limite e confirme o alerta sem perda da entidade.

Asserções mínimas:

```ts
await expect(page.getByRole('list', { name: 'Lista de polígonos' }).getByRole('button')).toHaveCount(1);
await expect(page.getByRole('alert')).toContainText('ao menos três vértices distintos');
```

- [ ] **Step 4: Atualizar o README factual**

Na tabela de bibliotecas e nas seções do protótipo:

- substituir Leaflet-Geoman por Terra Draw + adapter Leaflet;
- manter Leaflet/React-Leaflet;
- explicar a edição de uma parte por vez em `MultiPolygon`;
- não alterar a seção de proposta para o Regula além de remover frases que digam que o protótipo ainda usa Geoman.

- [ ] **Step 5: Executar a verificação completa**

Run:

```bash
npm run test:run
npm run e2e
npm run build
git diff --check
rg -n "@geoman-io|leaflet-geoman|map\.pm|layer\.pm|pm:" src e2e package.json package-lock.json
```

Expected:

- Vitest: zero falhas;
- Playwright: três cenários existentes e o cenário multipart/validação passam;
- build: exit 0;
- diff check: nenhum erro;
- busca Geoman: nenhum resultado.

- [ ] **Step 6: Revisar os critérios da spec**

Confirme manualmente no diff:

- criação migrou para Terra Draw;
- edição migrou para Terra Draw;
- uma única instância existe por mapa;
- Polygon/MultiPolygon são preservados;
- edição multipart é uma parte por vez;
- terceiro vértice não pode ser removido;
- alertas mantêm mensagem e acessibilidade;
- `PolygonProvider`/reducer não foram alterados;
- KML/DXF/PDF/sobreposição/PolygonPicker não foram alterados funcionalmente;
- Geoman saiu das dependências e do código.

- [ ] **Step 7: Commit**

```bash
git add e2e/polygon-editor.spec.ts README.md src/components/MapView/TerraDrawCompatibility.test.tsx
git commit -m "test: cover Terra Draw polygon workflows"
```

Se o arquivo de compatibilidade tiver sido removido, use `git add -A e2e README.md src/components/MapView`.

---

## Self-review

- **Cobertura da spec:** Tasks 1–6 cobrem o risco jsdom, dependências, criação, edição, MultiPolygon por parte, validação, estilos, erros, remoção do Geoman, unitários e E2E.
- **Fora de escopo preservado:** nenhum passo pede alteração do reducer/provider, parsers, exportações, PDF, sobreposição ou seleção do menor polígono.
- **Consistência de tipos:** `TerraPolygonFeature`, `TerraPolygonProperties`, `terraPartId`, `featuresForPolygon` e `geometryFromEditingFeatures` são definidos na Task 2 e consumidos com os mesmos nomes nas demais.
- **Risco resolvido cedo:** a Task 1 decide, com evidência, Vitest real versus Playwright antes da implementação principal.
- **Sem persistência provisória:** criação usa `finish`; edição usa apenas `change/update` não originado pela API.
