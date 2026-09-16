# Migração de leaflet-geoman para Terra Draw

## Objetivo

Substituir `@geoman-io/leaflet-geoman-free` por `terra-draw` (+ `terra-draw-leaflet-adapter`)
como motor de desenho e edição de vértices de polígonos no mapa, migração completa
(criação e edição), sem alterar o modelo de estado da aplicação.

## Estado atual

O Geoman é usado em dois pontos, ambos dentro de `src/components/MapView/`:

- **Criação**: [`GeomanController.tsx`](../../../src/components/MapView/GeomanController.tsx)
  ativa/desativa `map.pm.enableDraw('Polygon')` conforme `drawingMode` e escuta
  `pm:create` para converter o layer desenhado em `PolygonEntity` via
  [`leafletGeometry.ts`](../../../src/components/MapView/leafletGeometry.ts).
- **Edição**: [`PolygonLayer.tsx`](../../../src/components/MapView/PolygonLayer.tsx) chama
  `layer.pm.enable()` em cada `L.Polygon` que compõe o polígono selecionado
  (uma camada por parte, no caso de `MultiPolygon`), com `removeVertexValidation`
  bloqueando remoção de vértice abaixo de 3 pontos distintos. `bindPolygonEditing`
  em `leafletGeometry.ts` escuta `pm:edit`/`pm:vertexadded`/`pm:vertexremoved` em
  todas as partes **simultaneamente**, recompõe a geometria completa e chama
  `updateGeometry`; em caso de geometria inválida, reverte manualmente via
  `layer.setLatLngs(...)`.

`PolygonProvider`/`polygonReducer` (`src/app/`) são estado puro — não conhecem
Leaflet nem Geoman. Essa separação é o que torna a migração viável sem tocar no
reducer, no Sidebar, na exportação KML/PDF, na detecção de sobreposição, etc.

## Restrições do Terra Draw (levantadas em pesquisa)

- O "store" interno do Terra Draw guarda features `Polygon` simples — não existe
  suporte nativo a `MultiPolygon`.
- `TerraDrawSelectMode` não suporta multi-seleção: apenas uma feature fica
  ativa/editável por vez (confirmado em
  [issue #432](https://github.com/JamesLMilner/terra-draw/issues/432), aberta).
- Modos de desenho e o `SelectMode` aceitam funções de validação customizadas
  por flag (ex.: `coordinates.deletable`), recebidas com o `updateType`
  (`provisional`/`finish`/`commit`), que podem bloquear a operação retornando
  `false` — ver [guides/4.MODES.md](https://github.com/JamesLMilner/terra-draw/blob/main/guides/4.MODES.md).
- Eventos: `change` (`type: 'create' | 'update' | 'delete' | 'styling'`),
  `finish` e `select`/`deselect` — ver
  [guides/6.EVENTS.md](https://github.com/JamesLMilner/terra-draw/blob/main/guides/6.EVENTS.md).
- Features já chegam/saem como GeoJSON puro (sem equivalente a `layer.toGeoJSON()`).

## Decisão de escopo (aprovada)

Migração completa: criação **e** edição. Para `MultiPolygon`, a edição passa a
ser **uma parte por vez**, usando o comportamento nativo do `SelectMode` (clicar
numa parte a torna a ativa) — não há seletor de partes customizado. Isso é uma
mudança de UX assumida conscientemente em troca de não reimplementar
multi-seleção.

## Arquitetura proposta

### Dependências

- Adicionar `terra-draw`, `terra-draw-leaflet-adapter`.
- Remover `@geoman-io/leaflet-geoman-free` de `package.json`, o import de CSS em
  [`main.tsx`](../../../src/main.tsx), e todos os imports do pacote no código.

### Mapeamento de componentes

| Hoje | Depois |
|---|---|
| `GeomanController.tsx` | `TerraDrawController.tsx` — cria e mantém **uma** instância de `TerraDraw` + `TerraDrawLeafletAdapter` por `MapView`, ligada ao mesmo ciclo de vida (`useMap()`/`useEffect`) |
| Efeito de edição em `PolygonLayer.tsx` + `bindPolygonEditing` (`leafletGeometry.ts`) | Novo hook/módulo (ex.: `terraDrawGeometry.ts`) que sincroniza a(s) parte(s) do polígono em edição com o store do Terra Draw |
| `layerToGeometry`, `createPolygonEntity`, `InvalidPolygonGeometryError` | Mantidos conceitualmente; `layerToGeometry` é substituído por conversão direta da `Feature` GeoJSON do Terra Draw (mais simples, sem `.toGeoJSON()`) |

### Fluxo de criação

1. `drawingMode` vira `true` → `draw.setMode('polygon')`.
2. Usuário termina o polígono → evento `change` com `type: 'create'`.
3. Converte a `Feature` para `PolygonGeometry`, valida (mesma regra de hoje:
   `isValidPolygonGeometry`/mínimo 3 vértices distintos).
4. Válido: `addPolygon(...)`, remove a feature do store do Terra Draw (quem
   passa a renderizar é o `PolygonLayer` normal, via `PolygonProvider`), volta
   para `select`. Inválido: mostra o mesmo alerta de hoje, descarta a feature,
   volta para `select`.
5. `drawingMode` vira `false` (cancelado pelo botão) → `draw.setMode('select')`
   e descarta qualquer feature provisória.

### Fluxo de edição

1. `editingPolygonId` aponta para um polígono → todas as partes desse polígono
   (1 para `Polygon`, N para `MultiPolygon`) são adicionadas ao store do Terra
   Draw via `addFeatures`, em modo `select`.
2. Enquanto uma parte está no store do Terra Draw, o `PolygonLayer` **não** a
   desenha mais via `<GeoJSON>` (evita renderização duplicada) — o Terra Draw
   assume o visual daquela parte, com o mesmo estilo (cor de seleção
   `#f59e0b`, peso, etc. — via `styles` do modo ou `setFeatureProperty`).
3. Usuário clica numa parte → `SelectMode` nativo a torna a ativa; outras
   partes permanecem visíveis mas não editáveis (comportamento padrão do
   modo, sem código extra).
4. Edição de vértice (mover/adicionar/remover) → evento `change` com
   `type: 'update'`. Recompõe a `PolygonGeometry` completa (junta a parte
   editada com as demais partes não tocadas) e chama `updateGeometry`, igual
   ao comportamento atual de `bindPolygonEditing`.
5. Sair do modo de edição (`editingPolygonId` vira `null`) → remove as
   features do store do Terra Draw; `PolygonLayer` volta a renderizar
   normalmente.

### Validação

A regra "mínimo 3 vértices distintos" migra para a função de validação da
flag `coordinates.deletable` do `SelectMode`, reaproveitando
`hasAtLeastThreeDistinctPositions`/`isValidPolygonGeometry`
(`src/services/geo/polygonUtils.ts`). Diferença importante em relação a hoje:
o Terra Draw bloqueia a operação **nativamente** (retorno `false` do
validador) — elimina o hack atual de reverter a geometria manualmente com
`layer.setLatLngs(...)` em `leafletGeometry.ts`. O alerta de erro
(`role="alert"`, mesma mensagem em `InvalidPolygonGeometryError`) continua
existindo, disparado quando a validação recusa a operação.

### Estilo visual durante edição

O Terra Draw estiliza suas próprias features (via a opção `styles` de cada
modo ou propriedades da feature). Precisa reproduzir: cor de identidade por
polígono (`colorForPolygonId`), cor de seleção (`#f59e0b`), espessura,
opacidade — mesmas regras hoje aplicadas em `PolygonLayer.tsx`.

## Tratamento de erros

Mesmo contrato de hoje: erros de geometria inválida (menos de 3 vértices
distintos) mostram `<p className="map-status" role="alert">` com a mensagem
de `InvalidPolygonGeometryError`, sem alterar `PolygonProvider`.

## Testes afetados

- [`GeomanController.test.tsx`](../../../src/components/MapView/GeomanController.test.tsx) —
  hoje monta Leaflet real + Geoman real (sem mocks) e dispara eventos reais
  (`pm:create`, `pm:vertexremoved`, cliques em marcadores). O equivalente para
  Terra Draw deve seguir o mesmo padrão: instância real de `TerraDraw` +
  `TerraDrawLeafletAdapter` sob jsdom, verificando via `draw.getSnapshot()` e
  o DOM real renderizado pelo adapter — não mockar a biblioteca.
- [`PolygonLayer.test.tsx`](../../../src/components/MapView/PolygonLayer.test.tsx) —
  ajustar para o novo fluxo de edição (uma parte por vez).
- [`leafletGeometry.test.ts`](../../../src/components/MapView/leafletGeometry.test.ts) —
  ajustar conversões para partir de `Feature` GeoJSON do Terra Draw em vez de
  layers Leaflet.
- [`e2e/polygon-editor.spec.ts`](../../../e2e/polygon-editor.spec.ts) — tem
  passos que dependem da toolbar/seletores do Geoman; precisa revisão para os
  controles do Terra Draw.

## Risco em aberto a validar cedo na implementação

Os testes atuais usam Leaflet e Geoman **reais** sob jsdom (não mocks). Não há
confirmação de que `TerraDrawLeafletAdapter` renderiza corretamente sob jsdom
sem um browser real (canvas/SVG). Isso deve ser o primeiro passo prático da
implementação — um teste mínimo (montar `TerraDraw` + adapter num `MapContainer`
de teste e desenhar uma feature) — antes de portar o restante da lógica. Se
não funcionar sob jsdom, os testes de integração real precisarão rodar via
Playwright (já existe `e2e/`) em vez de Vitest+jsdom.

## Fora de escopo

- Suporte a multi-seleção/edição simultânea de múltiplas partes de
  `MultiPolygon` (decisão consciente, ver seção de escopo).
- Qualquer mudança em `PolygonProvider`, `polygonReducer`, importação/exportação
  KML/DXF/PDF, detecção de sobreposição, ou `PolygonPicker.tsx` (seleção por
  clique no menor polígono) — nenhum desses depende do Geoman.
