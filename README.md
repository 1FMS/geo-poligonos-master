# Editor geoespacial de polígonos

Protótipo frontend para criação, importação, edição, análise e exportação de polígonos geoespaciais sobre mapas de satélite.

Este repositório **não é um sistema independente pronto para produção**. Ele valida a experiência e as regras de negócio de uma futura feature que será incorporada a um sistema maior. Atualmente, toda a execução ocorre no navegador: não existem autenticação, API própria nem persistência. Recarregar ou fechar a página elimina os dados da sessão.

## Sumário

- [Objetivo e escopo](#objetivo-e-escopo)
- [Funcionalidades implementadas](#funcionalidades-implementadas)
- [Como executar localmente](#como-executar-localmente)
- [Arquitetura atual](#arquitetura-atual)
- [Principais bibliotecas](#principais-bibliotecas)
- [Modelo de dados](#modelo-de-dados)
- [Regras de negócio](#regras-de-negócio)
- [Importação](#importação)
- [Exportação e relatórios](#exportação-e-relatórios)
- [Testes](#testes)
- [Limitações](#limitações)
- [Implementação no Regula](#implementação-no-regula)
- [Evolução com Convex](#evolução-com-convex)
- [Informações necessárias para o plano](#informações-necessárias-para-o-plano)

## Objetivo e escopo

O protótipo demonstra uma feature capaz de:

1. manter vários polígonos em uma mesma sessão;
2. desenhar e editar geometrias diretamente no mapa;
3. importar KML, KMZ e DXF;
4. normalizar entradas para GeoJSON em WGS84;
5. calcular área e coordenadas derivadas;
6. identificar conflitos por sobreposição;
7. exportar uma entidade em KML;
8. gerar um relatório PDF individual.

A intenção é integrar essas capacidades ao domínio, autenticação, permissões e banco Convex do sistema hospedeiro. A seção [Implementação no Regula](#implementação-no-regula) separa o que será preservado, reaproveitado ou adaptado; ela é uma proposta, não uma descrição de algo já implementado.

## Funcionalidades implementadas

### Mapa e desenho

- mapas de satélite Esri World Imagery e Google Satellite;
- pan, zoom, desenho manual e edição de vértices via Terra Draw, com um adaptador Leaflet;
- várias entidades simultâneas, com uma seleção ativa por vez;
- em um `MultiPolygon`, a edição expõe uma parte por vez: selecionar uma parte carrega seus vértices e midpoints no Terra Draw, e trocar de parte troca a seleção sem afetar as demais;
- enquadramento automático após importação;
- seleção do menor polígono sob o clique, útil para um lote contido em uma área maior.

### Dados e cálculos

- GeoJSON `Polygon` e `MultiPolygon`;
- coordenadas WGS84 na ordem `[longitude, latitude]`;
- área em metros quadrados e hectares;
- conversão de cada vértice para UTM;
- nome, descrição, data de criação e campos personalizados;
- identificação derivada de vértices: `A`, `B`, ..., `Z`, `AA`, `AB`, ...

### Sobreposições

- comparação par a par das entidades;
- destaque dos polígonos e da região exata de interseção;
- área sobreposta em m² e percentual de cada polígono;
- atalho no painel para enquadrar o conflito no mapa.

Contenção quase integral não é classificada como conflito. Quando a interseção cobre pelo menos 98% do menor polígono — por exemplo, um lote dentro de um bairro — a relação é considerada hierárquica. Um buffer negativo de `0,001 m / 2` descarta ruído de bordas que apenas se tocam; invasões reais pequenas continuam sendo detectadas.

### Entrada e saída

- importação de `.kml`, `.kmz` e `.dxf`;
- exportação individual em `.kml`;
- relatório individual em `.pdf`.

## Como executar localmente

### Pré-requisitos

- Node.js em versão LTS atual;
- npm;
- internet para carregar os tiles de satélite;
- Chromium do Playwright somente para testes E2E.

O protótipo atual não exige banco, servidor backend, conta Convex nem arquivo `.env`.

### Instalação

Na raiz do projeto:

```bash
npm install
```

Em CI, ou para reproduzir estritamente o `package-lock.json`:

```bash
npm ci
```

### Desenvolvimento

```bash
npm run dev
```

O Vite exibirá o endereço local no terminal, normalmente `http://localhost:5173`.

### Build de produção

```bash
npm run build
```

O comando executa `tsc -b` e depois o build Vite. A saída é criada em `dist/`.

### Testes

```bash
# Testes unitários e de integração, uma execução
npm run test:run

# Vitest em modo interativo
npm test

# Primeira preparação do E2E
npx playwright install chromium

# Testes end-to-end
npm run e2e
```

O Playwright sobe `npm run dev` conforme `playwright.config.ts` e executa `e2e/polygon-editor.spec.ts`.

### Dados para testes manuais

`arquivos-testes/` contém amostras de KML, KMZ e DXF para uso na interface. As fixtures automatizadas ficam em `tests/fixtures/`.

## Arquitetura atual

```text
arquivo KML/KMZ/DXF ou desenho
              │
              ▼
 parser específico + normalização
              │
              ▼
 PolygonEntity + GeoJSON WGS84
              │
              ▼
 PolygonProvider / reducer em memória
       │             │             │
       ▼             ▼             ▼
      mapa      painel lateral  cálculos Turf
       │                           │
       └─────────────┬─────────────┘
                     ▼
                KML ou PDF
```

### Estado da aplicação

`PolygonProvider` concentra o estado React e expõe criação, importação, seleção, edição, alteração de propriedades e exclusão. `polygonReducer` realiza as transições imutáveis:

```ts
interface AppState {
  polygons: PolygonEntity[];
  selectedPolygonId: string | null;
  editingPolygonId: string | null;
  drawingMode: boolean;
}
```

O estado existe somente em memória. Não há `localStorage`, sincronização remota ou recuperação após refresh.

### Estrutura

```text
src/
├── app/                 # provider, reducer e eventos de foco
├── components/
│   ├── MapView/         # mapa, layers, desenho, edição e conflitos
│   ├── Sidebar/         # lista, detalhes e coordenadas
│   └── Toolbar/         # desenho e importação
├── services/
│   ├── dxf/             # leitura e normalização de DXF
│   ├── files/           # nomes seguros para downloads
│   ├── geo/             # área, UTM, bounding box e sobreposições
│   ├── kml/             # KML/KMZ e exportação KML
│   └── pdf/             # modelo e renderização do relatório
└── types/               # tipos centrais do domínio
```

## Principais bibliotecas

| Biblioteca | Responsabilidade |
|---|---|
| React / React DOM | Interface e estado da sessão. |
| TypeScript | Contratos do domínio e validação estática. |
| Vite | Desenvolvimento e build. |
| Leaflet / React-Leaflet | Mapa, layers e geometrias. |
| Terra Draw + adaptador Leaflet (`terra-draw-leaflet-adapter`) | Desenho e edição de vértices sobre o mapa Leaflet. |
| Turf.js | Área, interseção, buffers e operações GeoJSON. |
| Proj4js | Conversão WGS84 ↔ UTM. |
| `@tmcw/togeojson` | KML para GeoJSON. |
| `tokml` | GeoJSON para KML. |
| JSZip | Abertura de KMZ e extração do KML. |
| `dxf-parser` | Leitura de entidades DXF. |
| jsPDF / jsPDF-AutoTable | PDF e tabelas. |
| Vitest / Testing Library | Testes unitários, de componentes e integração. |
| Playwright | Testes E2E em navegador. |

## Modelo de dados

```ts
type PolygonGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;

interface CustomField {
  id: string;
  key: string;
  label: string;
  value: string;
}

interface PolygonEntity {
  id: string;
  geometry: PolygonGeometry;
  properties: {
    name: string;
    description: string;
    createdAt: string;
    customFields: CustomField[];
  };
  calculated: {
    areaSquareMeters: number;
  };
}
```

| Campo | Origem | Observação |
|---|---|---|
| `id` | Navegador | Usa `crypto.randomUUID()`; no Regula, a entidade correspondente usa IDs Convex como `Id<"lots">`. |
| `geometry` | Desenho/importação | Fonte geográfica de verdade em WGS84. |
| `name` | Usuário, KML ou layer DXF | Há fallback para importações sem nome. |
| `description` | Usuário ou KML | Vazia quando ausente. |
| `createdAt` | Navegador | ISO 8601; no Convex pode coexistir com `_creationTime`. |
| `customFields` | Usuário ou KML | Metadados técnicos de estilo são filtrados. |
| `areaSquareMeters` | Cálculo | Derivado; não deve ser confiado ao cliente no sistema final. |

UTM, hectares, nomes dos vértices e sobreposições são dados derivados.

## Regras de negócio

1. **GeoJSON/WGS84 é canônico.** Toda entrada é convertida antes de entrar no estado.
2. **A posição GeoJSON é `[longitude, latitude]`.**
3. **Somente `Polygon` e `MultiPolygon` são aceitos.**
4. **Um anel válido possui três vértices distintos e fechamento.** O último ponto repete o primeiro.
5. **A área é sempre recalculada** após criação, importação ou edição.
6. **UTM é derivado.** Zona e hemisfério são calculados; WGS84 não é substituído.
7. **Um `MultiPolygon` é uma entidade lógica única**, com propriedades compartilhadas.
8. **Há uma seleção e uma edição ativas por vez.**
9. **Importações são aditivas.** Falhas não apagam o estado anterior.
10. **A exclusão remove apenas a entidade selecionada**, após confirmação.
11. **Campos personalizados pertencem à entidade**, não aos vértices.
12. **Estilos KML não viram campos de negócio.**
13. **Contenção ≥ 98% do menor polígono não é conflito de sobreposição.**
14. **Bordas apenas coincidentes não geram falso positivo.**
15. **Downloads utilizam nomes sanitizados.**

## Importação

Toda importação atual é processada no navegador. Nenhum arquivo é enviado a servidor.

```text
seleção do arquivo
→ identificação pela extensão
→ leitura como texto ou ArrayBuffer
→ parser específico
→ validação
→ GeoJSON/WGS84
→ cálculo de área
→ PolygonEntity
→ estado
→ enquadramento do mapa
```

Elementos incompatíveis são ignorados e contabilizados. Se não houver polígono válido, a operação falha sem alterar os dados carregados.

### KML

1. Leitura como texto e parsing XML com `DOMParser`.
2. Conversão para `FeatureCollection` por `@tmcw/togeojson`.
3. Aceite de `Polygon`, `MultiPolygon` e membros poligonais de `GeometryCollection`; múltiplos `Polygon` de uma mesma `MultiGeometry` KML (um único Placemark) são fundidos em uma única entidade `MultiPolygon`, preservando a unidade lógica do KML de origem.
4. `name` e `description` alimentam propriedades padrão.
5. Propriedades não técnicas tornam-se campos personalizados.
6. Geometrias incompatíveis incrementam `ignoredCount`.

XML corrompido e ausência de geometrias suportadas geram erros controlados.

### KMZ

1. Leitura como `ArrayBuffer`.
2. Abertura do ZIP com JSZip.
3. Extração do primeiro arquivo interno terminado em `.kml`.
4. Execução do mesmo fluxo KML.

A operação falha se o contêiner estiver corrompido ou não possuir KML.

### DXF

O DXF possui premissas específicas do protótipo:

- as coordenadas são assumidas como **SIRGAS 2000 / UTM zona 23 Sul (EPSG:31983)**;
- somente `LWPOLYLINE` e `POLYLINE` fechadas com pelo menos três vértices são elegíveis;
- se houver layers cujo nome contenha `lote`, somente elas são importadas;
- sem layer de lote, todas as layers elegíveis são consideradas;
- cada polilinha gera um `Polygon`;
- o nome deriva da layer ou recebe fallback sequencial;
- UTM é convertido para WGS84 antes do armazenamento.

Pontos, textos, blocos, linhas abertas e outras entidades são ignorados.

> **Risco:** arquivos de outra zona, hemisfério ou sistema de referência serão posicionados incorretamente. Em produção, o CRS deve vir do projeto, de uma seleção explícita ou de metadados confiáveis, nunca de uma constante no frontend.

### Dados recebidos por formato

| Formato | Aproveitado | Ignorado/derivado |
|---|---|---|
| KML | Polygon/MultiPolygon, nome, descrição e propriedades livres | Estilos; área é recalculada. |
| KMZ | Dados do KML interno | Outros recursos do pacote não são processados. |
| DXF | Vértices fechados e layer | Outras entidades; UTM 23S é convertido para WGS84. |
| Desenho | Vértices do usuário | ID, nome inicial, data e área são gerados. |

## Exportação e relatórios

### KML

A entidade selecionada vira uma `FeatureCollection` com uma feature contendo geometria, nome, descrição, área calculada e campos personalizados. Um `Blob` inicia o download sem servidor.

### PDF

O relatório possui nome, descrição, área em m²/ha, campos personalizados e todos os vértices em latitude/longitude e UTM. Em `MultiPolygon`, identifica também a parte. Não há imagem do mapa.

## Testes

- **unitários:** parsers, cálculos, conversões, validação, sobreposição, KML e PDF;
- **componentes/integração:** provider, reducer, mapa, toolbar, sidebar, importação e edição;
- **E2E:** jornadas reais em Chromium.

```bash
npm run test:run
npm run e2e
npm run build
```

## Limitações

- sem backend, persistência, login, autorização ou colaboração;
- refresh elimina a sessão;
- tiles dependem de internet e de provedores externos;
- a atribuição do provedor deve permanecer visível;
- pontos e linhas não são editáveis;
- DXF está fixado em UTM 23S e usa heurística pelo nome da layer;
- parsing e cálculos ocorrem na thread principal;
- sem autosave, histórico ou concorrência;
- sem limites explícitos de arquivo, entidades ou vértices;
- arquivos originais não são guardados para auditoria/reprocessamento.

## Implementação no Regula

### Princípio de integração

O **Regula é o sistema-base** no qual esta feature será implementada. O objetivo não é migrar este protótipo inteiro, trocar a stack do Regula ou manter dois motores de mapas. A implementação deve preservar a arquitetura existente e transportar apenas os comportamentos geoespaciais validados aqui.

> Se uma capacidade já existe no Regula, ela deve ser reutilizada. Se não existe, deve-se escolher uma biblioteca compatível com a stack atual e com capacidade equivalente ou superior à usada pelo protótipo.

Consequentemente:

- este protótipo continua usando Leaflet, React-Leaflet e Terra Draw (com adaptador Leaflet);
- o Regula continua usando Google Maps JavaScript API;
- Terra Draw não precisa ser removido nem substituído neste repositório;
- Leaflet não deve ser introduzido no Regula apenas para reutilizar componentes visuais;
- regras e serviços independentes do mapa podem ser reaproveitados;
- autenticação, RBAC, auditoria, imports e persistência continuam seguindo os padrões do Regula.

### Stack atual e stack-alvo

| Responsabilidade | Protótipo atual | Regula hoje | Implementação recomendada no Regula |
|---|---|---|---|
| Mapa-base | Leaflet | Google Maps JS API | Manter Google Maps. |
| Desenho/edição | Terra Draw + adaptador Leaflet | Sem ferramenta completa ativa | Adicionar Terra Draw com adaptador Google Maps, se a edição for aprovada. |
| Renderização | React-Leaflet | Componentes Google Maps | Estender os componentes existentes. |
| Geometria | GeoJSON/WGS84 | GeoJSON/WGS84 | Manter o contrato do Regula. |
| Estado | Context + reducer em memória | Convex e estado React/Zustand | Convex confirmado; estado local apenas durante edição. |
| DXF | Parser no cliente e EPSG:31983 fixo | Action Convex com detecção de SRID | Evoluir o pipeline existente do Regula. |
| KML/KMZ | Parser no cliente | Formatos previstos, sem pipeline implementado | Adicionar actions ao pipeline de `imports`. |
| Área | Turf sobre WGS84 | Plano UTM de origem | Preservar o cálculo do Regula. |
| Sobreposição | Turf.js | Não identificada na base analisada | Adicionar Turf como serviço independente do mapa. |
| PDF | jsPDF | `@react-pdf/renderer` | Usar a biblioteca já adotada pelo Regula. |
| Arquivos | Não persistidos | Convex Storage/R2 | Manter o fluxo existente. |
| Segurança | Não implementada | Convex Auth + RBAC | Usar `authedQuery`, `authedMutation` e `assertPermission`. |
| Auditoria | Não implementada | `auditLog` | Registrar as novas operações no mecanismo existente. |

Terra Draw é uma biblioteca MIT compatível com Google Maps e recomendada nos exemplos atuais do próprio Google após a remoção da antiga Drawing Library. Ela não substitui o Google Maps: funciona como camada de desenho e edição sobre a instância existente. Para edição muito simples de uma geometria já criada, `google.maps.Polygon` também possui a opção `editable`; entretanto, uma experiência completa de criação, seleção, cancelamento e exclusão exigiria implementação própria.

### O que pode ser reaproveitado

O maior reaproveitamento está na lógica independente de Leaflet:

- tipos e normalização GeoJSON;
- validação de `Polygon` e `MultiPolygon`;
- parsing de KML e KMZ;
- detecção de sobreposição e cálculo da interseção;
- apresentação de coordenadas WGS84 e UTM;
- identificação dos vértices;
- sanitização de nomes de arquivo;
- modelos de relatório;
- testes de regras geoespaciais.

Componentes React acoplados a Leaflet/Terra Draw servem como referência de comportamento e UX, não como código diretamente transplantável para o Regula.

### Onde o Regula precisará ser adaptado

#### Mapa e interação

- estender os componentes Google Maps já usados pelo mapa do núcleo;
- criar um adaptador entre GeoJSON do Regula e a ferramenta de desenho;
- adicionar modos explícitos de visualizar, selecionar, criar, editar, salvar e cancelar;
- preservar a seleção de lotes, a numeração e o vínculo lote ↔ cadastro social;
- testar a interação da camada de desenho com lotes, quadras, logradouros e marcadores existentes;
- respeitar o limite atual das consultas de mapa e medir o desempenho com núcleos reais.

#### Domínio

Não deve ser criada uma tabela genérica `polygons`. A geometria continua pertencendo às entidades existentes:

- `lots`: lotes;
- `blocks`: quadras;
- `streets`: logradouros;
- `nucleus`: contexto do núcleo de reordenamento;
- `imports`: arquivo, versão e resultado do processamento.

Uma nova tabela só deve existir se surgir uma categoria geométrica que não corresponda a nenhum domínio atual.

#### Edição geométrica

O glossário atual do Regula determina que o sistema apenas recebe e renderiza geometrias finalizadas no Métrica Topo. Permitir desenho ou edição dentro do Regula altera essa regra e precisa de decisão de produto.

Antes da implementação, é necessário definir:

- quais papéis podem editar;
- em quais estados do núcleo a edição é permitida;
- se a edição modifica um lote oficial ou cria um rascunho;
- se haverá segunda validação por outro engenheiro/admin;
- como uma edição manual se comporta no próximo reimport;
- se `metricaTopoId` continua sendo a identidade após alteração manual;
- como registrar geometria anterior, autor, data e motivo.

#### Importação

O pipeline atual deve ser estendido, não substituído:

```text
upload
→ uploadClaims
→ imports
→ action específica do formato
→ detecção/conversão do SRID
→ normalização WGS84
→ preview e seleção
→ merge por identidade
→ lots / blocks / streets
→ auditoria
```

DXF deve continuar usando o processamento existente, que detecta EPSG:4326, 31982, 31983 ou 31984 e permite correção manual. KML/KMZ devem ser incorporados ao mesmo ciclo de upload, versionamento e auditoria, em vez de gravar diretamente a partir do navegador.

#### Sobreposições

Turf pode ser usado sem Leaflet e sem alterar o Google Maps. A regra genérica do protótipo deve ser especializada:

- lote × lote: possível conflito cadastral;
- lote contido na quadra: relação esperada;
- lote contido no limite do núcleo: relação esperada;
- lote fora da quadra ou do núcleo: possível inconsistência;
- quadra × quadra: possível conflito;
- logradouro cruzando outras geometrias: pode ser esperado.

O produto ainda precisa definir se cada ocorrência apenas alerta, exige justificativa ou bloqueia a validação do núcleo.

#### Persistência e sincronização

- queries Convex continuam sendo a fonte reativa dos dados confirmados;
- estado local guarda somente a geometria em edição;
- salvar chama uma mutation autorizada;
- cancelar restaura a geometria confirmada;
- cálculos críticos devem ser confirmados no backend;
- nenhuma alteração pode confiar em `userId`, área ou permissões enviados pelo cliente;
- reimportações continuam preservando o histórico e desativando entidades ausentes conforme as regras atuais.

#### Relatórios

Os dados do relatório podem ser reaproveitados, mas a renderização final deve usar `@react-pdf/renderer`, já adotado pelo Regula. É necessário definir se o relatório pertence a um lote, a uma seleção ou ao núcleo completo.

### Módulos do Regula envolvidos

| Área | Módulos conhecidos | Adaptação provável |
|---|---|---|
| Schema | `convex/schema.ts` | Acrescentar apenas metadados indispensáveis de edição/versionamento. |
| DXF | `convex/importDxf.ts` | Preservar; incorporar novas validações somente quando comuns aos formatos. |
| Imports | `convex/imports.ts` | Generalizar criação/processamento para KML/KMZ e manter upload/versionamento. |
| Lotes | `convex/lots.ts` | Adicionar mutation geométrica somente se a edição for aprovada. |
| Mapa | `convex/map.ts` e componentes Google Maps | Entregar/renderizar estados de edição e conflitos. |
| Segurança | `convex/lib/customFunctions.ts` e `permissions.ts` | Reutilizar autenticação, triggers e matriz RBAC. |
| Auditoria | helpers e `auditLog` existentes | Registrar importação, edição, restauração e validação. |
| Frontend | rota/componentes do núcleo | Integrar toolbar e painel sem criar uma aplicação paralela. |

## Evolução com Convex

Como o sistema hospedeiro usa Convex, a evolução recomendada é integrar a feature por **queries, mutations e actions Convex**, não criar API REST ou PostgreSQL paralelos.

Convex armazena documentos JSON-like, fornece IDs tipados, schemas e índices. No Regula, esses recursos já estão estruturados e devem ser estendidos pelas convenções existentes.

### Responsabilidades

```text
Frontend React
  ├── desenho e feedback imediato
  ├── preview da importação
  └── cliente Convex tipado
               │
               ▼
Funções Convex
  ├── queries: listar/obter
  ├── mutations: criar/alterar/excluir
  ├── actions: processamento externo quando necessário
  └── autenticação, autorização e validação
               │
        ┌──────┴────────┐
        ▼               ▼
Convex Database   Convex File Storage
dados normalizados  originais opcionais
```

### Fonte de verdade

- **Database:** GeoJSON WGS84 e propriedades normalizadas.
- **File Storage:** arquivo original opcional para auditoria/reprocessamento.
- **Área:** recalculada no backend; nunca confiada ao cliente.
- **UTM e hectares:** derivados sob demanda, salvo necessidade comprovada de cache.
- **Sobreposições:** cálculo no conjunto do projeto inicialmente; volumes altos exigem revisão.

Convex não deve ser tratado como banco geoespacial especializado. Consultas espaciais complexas, índices geográficos e grande volume pedem decisão arquitetural própria. Para cardinalidade controlada por projeto, GeoJSON persistido e Turf podem bastar.

### Modelo Convex existente

O Regula já possui as estruturas centrais necessárias:

- `nucleus` mantém o contexto e os contadores ativos;
- `imports` mantém arquivo, formato, status, versão anterior, SRID, layers, avisos e métricas do merge;
- `lots`, `blocks` e `streets` armazenam GeoJSON WGS84, centróide, identidade do Métrica Topo e estado ativo;
- `lots` também mantém área, perímetro, endereço, vínculo com cadastro social e histórico relacionado;
- `uploadClaims` associa temporariamente um arquivo enviado ao usuário autenticado;
- `auditLog` registra operações relevantes.

Qualquer campo novo deve ser justificado por uma consulta ou regra concreta. Se edição manual for aprovada, podem ser necessários metadados como origem da geometria, autor da última edição, data, revisão e referência da versão anterior. A forma final deve ser definida após avaliar os ADRs e o mecanismo de auditoria existente.

### Contrato lógico das adaptações

| Tipo | Função proposta | Responsabilidade |
|---|---|---|
| Query | `map.featuresForNucleus` | Estender o retorno somente com dados necessários à nova experiência. |
| Query | `map.featureForLot` | Reutilizar para detalhe e seleção de lote. |
| Mutation | `lots.updateGeometry` (proposta) | Validar permissão/estado, recalcular derivados e auditar uma edição aprovada. |
| Mutation | `imports.generateUploadUrl` | Reutilizar o upload autorizado existente. |
| Mutation | `imports.registerUploadedFile` | Reutilizar a associação segura arquivo ↔ usuário. |
| Mutation | `imports.createFromUpload` | Generalizar de DXF para os formatos realmente aprovados. |
| Action | actions específicas de DXF/KML/KMZ | Parsear, converter e normalizar antes do merge. |
| Mutation interna | `imports.applyFeatureBatch` | Reutilizar o upsert em lotes de features. |
| Mutation interna | `imports.finalizeImport` | Reutilizar merge, desativação, contadores e auditoria. |

Toda função pública deve usar as abstrações autenticadas do Regula e verificar a permissão adequada. Receber um ID do frontend nunca é autorização suficiente.

### Contrato normalizado entre mapa e backend

```ts
{
  nucleusId: Id<"nucleus">,
  features: [{
    clientId: "uuid-temporario",
    kind: "lot",
    metricaTopoId: "A1B2",
    metricaTopoLayer: "LOTES",
    lotCode: "Lote 01",
    geometry: {
      type: "Polygon",
      coordinates: [[
        [-44.3021, -2.5312],
        [-44.3012, -2.5310],
        [-44.3014, -2.5320],
        [-44.3021, -2.5312]
      ]]
    },
    sourceImportId: "<Id de imports>"
  }]
}
```

Área, perímetro, centróide, usuário e timestamps não devem ser valores soberanos do cliente. O backend confirma os dados derivados e obtém o usuário pelo contexto autenticado.

### Fluxo para salvar

1. O usuário inicia uma edição na tela Google Maps do núcleo.
2. Terra Draw, ou a API nativa para um escopo simples, manipula uma cópia local.
3. O frontend valida formato básico, fechamento e UX, sem assumir autoridade.
4. Ao salvar, envia GeoJSON WGS84 e a identificação do lote para uma mutation.
5. A mutation valida usuário, permissão, estado do núcleo e vínculo do lote.
6. O backend valida geometria e recalcula área, perímetro e centróide.
7. A alteração e seus metadados são persistidos e auditados.
8. A query reativa devolve a versão confirmada aos clientes.
9. Cancelar descarta a cópia local sem alterar o Convex.

### Fluxo para upload/importação

O Regula já adota a abordagem recomendada: arquivo original no Convex Storage, claim associado ao usuário, registro em `imports`, processamento por action e aplicação em batches. Novos formatos devem seguir esse padrão. Um preview no cliente pode ser adicionado para UX, mas não substitui a validação e o processamento autoritativo no backend.

### Consistência e segurança

- definir controle de concorrência para edição geométrica, usando revisão ou mecanismo equivalente;
- definir se importação em lote é atômica ou aceita sucesso parcial;
- limitar arquivo, quantidade de entidades, anéis e vértices;
- preservar o padrão existente de `isActive`, `removedInImportId`, `removedAt` e `removedReason`;
- obter usuário pelo contexto Convex, nunca pelo payload;
- validar argumentos no schema e também semanticamente;
- checar vínculo e permissão em toda query/mutation pública;
- validar conteúdo de upload, não apenas extensão/MIME;
- usar funções internas para operações não chamáveis pelo cliente;
- aplicar as mesmas permissões às exportações;
- decidir se sobreposição alerta ou bloqueia o salvamento.

### Transporte das capacidades do protótipo

1. catalogar comportamentos validados, sem copiar a aplicação inteira;
2. portar serviços geoespaciais independentes de Leaflet;
3. criar a integração de desenho/edição sobre Google Maps somente se aprovada;
4. adaptar os contratos para `lots`, `blocks`, `streets`, `nucleus` e `imports`;
5. conectar a UI às queries/mutations existentes;
6. repetir no backend todas as validações críticas;
7. manter upload, autenticação, RBAC, auditoria e versionamento do Regula;
8. adicionar testes ao padrão atual e ampliar a cobertura onde o risco exigir;
9. medir núcleos reais antes de fechar limites e estratégia de sobreposição;
10. liberar por etapas, sem modificar fluxos estáveis que não dependem da feature.

## Informações necessárias para o plano

Os arquivos analisados já esclarecem stack, schema, autenticação, importação DXF e consultas de mapa. Para transformar a proposta em plano executável, ainda precisamos decidir:

1. se desenho e edição geométrica passam a fazer parte do domínio do Regula;
2. papéis e estados do núcleo em que cada operação será permitida;
3. efeito de um reimport sobre uma geometria editada manualmente;
4. necessidade de segunda validação e histórico restaurável;
5. quais formatos além de DXF entram na primeira entrega;
6. tamanhos reais dos arquivos, entidades, anéis e vértices;
7. significado e severidade de cada tipo de sobreposição;
8. se conflitos alertam, exigem justificativa ou bloqueiam o fluxo;
9. escopo dos relatórios e exportações;
10. comportamento esperado quando a consulta de mapa for truncada;
11. estratégia de testes e critérios de aceite para as novas regras;
12. rollout da feature sem interromper importação, mapa e vinculação atuais.

Com essas informações e acesso à estrutura do sistema principal, pode-se elaborar um plano por etapas com schema, funções Convex, integração frontend, testes, rollout e critérios de aceite.

## Referências técnicas

- [Convex Database](https://docs.convex.dev/database/overview)
- [Convex Schemas](https://docs.convex.dev/database/schemas)
- [Convex Document IDs](https://docs.convex.dev/database/document-ids)
- [Convex Actions](https://docs.convex.dev/functions/actions)
- [Convex File Storage](https://docs.convex.dev/file-storage/store-files)
- [Google Maps: formas editáveis](https://developers.google.com/maps/documentation/javascript/shapes)
- [Google Maps: desenho com Terra Draw](https://developers.google.com/maps/documentation/javascript/examples/map-drawing-terradraw)
- [Terra Draw: adaptador Google Maps](https://github.com/JamesLMilner/terra-draw/blob/main/guides/3.ADAPTERS.md#google-maps)
