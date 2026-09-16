# Especificação de Design — Editor Geoespacial de Polígonos

**Data:** 2026-09-15  
**Status:** Aguardando revisão do usuário  
**Tipo:** Protótipo web client-side

## 1. Objetivo

Construir um protótipo web para criação, edição, importação, visualização, análise e exportação de polígonos sobre um mapa em visão satélite. O sistema deve permitir ao usuário desenhar geometrias ponto a ponto, editar vértices, visualizar coordenadas geográficas e UTM, importar e exportar KML e gerar um relatório PDF individual por polígono.

O protótipo será executado inteiramente no navegador, sem autenticação, backend ou banco de dados.

## 2. Escopo do MVP

O MVP inclui:

1. mapa inicial em visão satélite;
2. navegação por zoom e pan;
3. criação manual de Polygon;
4. múltiplos polígonos simultâneos;
5. seleção individual de polígono;
6. destaque visual do polígono selecionado;
7. edição de vértices;
8. adição de vértices;
9. remoção de vértices;
10. campos padrão por polígono;
11. campos personalizados por polígono;
12. cálculo automático de área;
13. exibição da área em m² e hectares;
14. exibição de latitude e longitude;
15. conversão e exibição de coordenadas UTM;
16. importação de KML com Polygon e MultiPolygon;
17. exportação individual para KML;
18. geração de relatório individual em PDF;
19. exclusão de polígonos;
20. operação integralmente client-side.

## 3. Fora do escopo inicial

Não fazem parte desta primeira versão:

- login e autenticação;
- persistência em banco de dados;
- backend/API própria;
- colaboração multiusuário;
- versionamento de geometrias;
- sincronização em nuvem;
- edição de Point ou LineString;
- exportação em Shapefile, DXF ou GeoPackage;
- geração de imagem do mapa dentro do PDF;
- ferramentas avançadas de topologia;
- snapping entre polígonos;
- medição de distância como ferramenta independente.

## 4. Stack proposta

### Frontend

- React
- TypeScript
- Vite

### Mapa e geometria

- Leaflet
- React-Leaflet
- Leaflet-Geoman
- Turf.js

### Conversões e formatos

- Proj4js para transformação WGS84 ↔ UTM
- Biblioteca de conversão KML ↔ GeoJSON

### Relatórios

- jsPDF
- complemento de tabela para jsPDF, se necessário

## 5. Princípio arquitetural

GeoJSON em WGS84 será o formato interno central da aplicação.

Todos os módulos devem operar sobre essa representação sempre que possível:

- o mapa renderiza GeoJSON;
- Leaflet-Geoman altera a geometria;
- Turf.js calcula área;
- o conversor gera KML a partir de GeoJSON;
- o relatório lê vértices a partir de GeoJSON;
- a conversão UTM parte das coordenadas WGS84 armazenadas no GeoJSON.

Isso evita representações duplicadas da mesma geometria e reduz inconsistências.

## 6. Arquitetura de componentes

```text
src/
├── components/
│   ├── MapView/
│   │   ├── MapView.tsx
│   │   ├── SatelliteLayer.tsx
│   │   └── PolygonLayer.tsx
│   ├── Sidebar/
│   │   ├── Sidebar.tsx
│   │   ├── PolygonList.tsx
│   │   ├── PolygonDetails.tsx
│   │   ├── CoordinatesTable.tsx
│   │   └── CustomFieldsEditor.tsx
│   └── Toolbar/
│       ├── DrawPolygonButton.tsx
│       └── ImportKmlButton.tsx
├── services/
│   ├── kml/
│   │   ├── importKml.ts
│   │   └── exportKml.ts
│   ├── geo/
│   │   ├── calculateArea.ts
│   │   ├── coordinateConverter.ts
│   │   └── polygonUtils.ts
│   └── pdf/
│       └── generatePolygonReport.ts
├── store/
│   └── polygonStore.ts
├── types/
│   └── polygon.ts
└── App.tsx
```

## 7. Modelo de dados

```ts
interface PolygonEntity {
  id: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
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

interface CustomField {
  key: string;
  label: string;
  value: string;
}
```

A área é derivada da geometria e deve ser recalculada após qualquer alteração dos vértices.

## 8. Estado da aplicação

O estado mínimo deve conter:

```ts
interface AppState {
  polygons: PolygonEntity[];
  selectedPolygonId: string | null;
  editingPolygonId: string | null;
  drawingMode: boolean;
}
```

Persistência permanente não será implementada. Ao recarregar a página, o estado é perdido.

## 9. Fluxo de criação

1. usuário abre a aplicação;
2. mapa de satélite é exibido;
3. usuário seleciona “Criar polígono”;
4. Leaflet-Geoman entra em modo de desenho;
5. cada clique adiciona um vértice;
6. o usuário fecha a geometria;
7. a nova layer é convertida para GeoJSON;
8. o sistema cria um identificador único;
9. Turf calcula a área;
10. a entidade é adicionada ao estado;
11. o polígono é automaticamente selecionado;
12. o painel de propriedades é aberto;
13. usuário informa nome, descrição e campos personalizados.

## 10. Fluxo de edição

Ao selecionar “Editar geometria”:

1. o Leaflet-Geoman ativa o modo de edição;
2. o usuário pode mover vértices existentes;
3. o usuário pode adicionar novos vértices;
4. o usuário pode remover vértices, desde que a geometria continue válida;
5. após cada alteração relevante, a layer é convertida novamente para GeoJSON;
6. o estado é atualizado;
7. a área é recalculada;
8. coordenadas e relatório passam a refletir a nova geometria.

## 11. Múltiplos polígonos

O sistema deve manter diversos Polygon e MultiPolygon simultaneamente.

Cada objeto possui:

- seu próprio id;
- geometria independente;
- nome;
- descrição;
- campos personalizados;
- área calculada;
- ações individuais.

Somente um polígono será considerado selecionado por vez no MVP.

## 12. MultiPolygon

Um MultiPolygon importado será tratado como uma única entidade lógica.

Exemplo:

```text
Fazenda São José
├── Área A
├── Área B
└── Área C
```

Todas as partes compartilham nome, descrição e características.

A área apresentada será a soma das áreas das partes.

## 13. Coordenadas

### Formato interno

WGS84 em graus decimais, obedecendo a ordem GeoJSON:

```text
[longitude, latitude]
```

### Exibição

Cada vértice será exibido como:

- identificador do ponto;
- latitude;
- longitude;
- zona UTM;
- easting;
- northing.

### Nomeação dos vértices

A nomeação seguirá:

```text
A, B, C ... Z, AA, AB, AC ...
```

A nomeação é derivada da posição do vértice na geometria e não precisa ser persistida.

## 14. Conversão UTM

A conversão deve ser realizada sob demanda a partir de WGS84.

O sistema deve:

1. identificar a zona UTM aplicável a cada coordenada;
2. determinar hemisfério;
3. converter para Easting e Northing;
4. exibir os valores na interface e no PDF.

WGS84 permanece como fonte de verdade; UTM é uma representação calculada.

## 15. Área

A área deve ser calculada com Turf.js após:

- criação;
- edição de vértices;
- importação KML.

Exibição mínima:

- metros quadrados;
- hectares.

Conversão:

```text
1 ha = 10.000 m²
```

## 16. Importação KML

### Geometrias aceitas

- Polygon
- MultiPolygon

### Geometrias ignoradas

- Point
- LineString
- outros tipos fora do escopo

### Fluxo

```text
arquivo .kml
→ FileReader
→ texto XML
→ DOMParser
→ conversor KML para GeoJSON
→ validação de geometria
→ normalização
→ PolygonEntity
→ estado
→ Leaflet
```

Se o KML possuir geometrias não suportadas, a aplicação deve informar ao usuário quantos elementos foram ignorados.

Se nenhum Polygon ou MultiPolygon válido for encontrado, a importação deve falhar de forma controlada, sem alterar o estado existente.

## 17. Exportação KML

A exportação será individual, referente ao polígono selecionado.

Fluxo:

```text
PolygonEntity
→ GeoJSON Feature
→ conversor GeoJSON para KML
→ Blob
→ download .kml
```

O KML deve preservar, sempre que o formato/biblioteca permitir:

- nome;
- descrição;
- campos personalizados.

A área pode ser incluída como metadado informativo, mas não será considerada fonte de verdade na reimportação.

## 18. Relatório PDF

Cada polígono deve possuir ação “Gerar PDF”.

O relatório deve conter:

### Cabeçalho

- título “Relatório do Polígono”;
- nome;
- descrição;
- área em m²;
- área em hectares.

### Características

Tabela ou bloco com todos os campos personalizados.

### Coordenadas

Tabela com:

| Ponto | Latitude | Longitude | Zona UTM | Easting | Northing |
|---|---:|---:|---|---:|---:|

O PDF não conterá captura ou imagem do mapa no MVP.

## 19. Interface funcional

A interface será composta por três áreas principais:

### Toolbar

Ações globais:

- Criar polígono;
- Importar KML.

### Mapa

Responsável por:

- satélite;
- pan;
- zoom;
- desenho;
- seleção;
- destaque;
- edição geométrica.

### Sidebar

Quando nenhum polígono estiver selecionado:

- lista de polígonos existentes.

Quando houver seleção:

- nome;
- descrição;
- área;
- campos personalizados;
- tabela de coordenadas;
- editar geometria;
- editar propriedades;
- exportar KML;
- gerar PDF;
- excluir.

## 20. Regras de negócio

1. Um polígono deve possuir ao menos três vértices distintos para ser válido.
2. WGS84/GeoJSON é a geometria canônica da aplicação.
3. UTM nunca deve substituir os valores WGS84 armazenados.
4. A área sempre deve ser recalculada quando a geometria mudar.
5. Somente um objeto fica selecionado por vez.
6. Um MultiPolygon é uma única entidade lógica no MVP.
7. Campos personalizados pertencem à entidade, não aos vértices.
8. Um arquivo KML inválido não deve apagar nem modificar os polígonos já carregados.
9. A exclusão remove apenas o polígono selecionado.
10. A aplicação não promete persistência após refresh ou fechamento do navegador.

## 21. Tratamento de erros

### KML inválido

Exibir mensagem de erro e manter o estado atual.

### KML sem polígonos

Informar que não foram encontrados Polygon/MultiPolygon compatíveis.

### Geometria inválida após edição

Impedir confirmação ou reverter a última ação quando possível.

### Falha de geração do PDF

Informar o usuário sem remover ou alterar o polígono.

### Falha de tiles

O editor continua carregado e deve informar indisponibilidade da camada base quando aplicável.

## 22. Critérios de aceite

### CA-01 — Inicialização

Ao acessar a aplicação, o usuário visualiza o mapa e consegue navegar por zoom e pan.

### CA-02 — Criação

Ao clicar em “Criar polígono”, o usuário consegue definir pelo menos três vértices e fechar a geometria.

### CA-03 — Múltiplas geometrias

O usuário consegue manter pelo menos dois polígonos simultaneamente e selecioná-los individualmente.

### CA-04 — Edição

O usuário consegue mover, adicionar e remover vértices de um polígono existente.

### CA-05 — Recalcular área

Após mover um vértice, a área exibida muda de acordo com a nova geometria.

### CA-06 — Propriedades

Cada polígono possui nome, descrição e quantidade variável de campos personalizados.

### CA-07 — Coordenadas

Ao selecionar uma geometria, a aplicação apresenta cada vértice em latitude/longitude e UTM.

### CA-08 — Importação

Um KML contendo Polygon ou MultiPolygon válido é carregado e exibido no mapa.

### CA-09 — Geometrias incompatíveis

Elementos Point/LineString presentes no KML são ignorados e informados ao usuário.

### CA-10 — Exportação

O usuário consegue exportar o polígono selecionado como arquivo KML válido.

### CA-11 — PDF

O usuário consegue gerar um PDF com propriedades, área e tabela de coordenadas do polígono selecionado.

### CA-12 — Isolamento

Editar, excluir ou exportar um polígono não altera os demais.

### CA-13 — Sem backend

Todas as funcionalidades principais do MVP funcionam sem API ou banco de dados próprio.

## 23. Testes previstos

### Unitários

- cálculo de área;
- conversão de hectares;
- geração de nomes de vértice;
- detecção de zona UTM;
- conversão de coordenadas;
- normalização de Polygon/MultiPolygon;
- validação de KML.

### Integração

- criação → GeoJSON → store;
- edição → atualização de GeoJSON → recálculo de área;
- KML → GeoJSON → PolygonEntity;
- PolygonEntity → KML;
- PolygonEntity → PDF.

### Fluxos manuais/E2E

- criar dois polígonos;
- selecionar alternadamente;
- editar vértices;
- adicionar campo personalizado;
- importar KML;
- exportar KML;
- gerar PDF;
- excluir apenas o selecionado.

## 24. Decisões arquiteturais

### Sem backend

Mantém o protótipo simples e reduz o tempo de implementação.

### React + TypeScript

Facilita a divisão da interface em componentes e reduz erros envolvendo tipos geoespaciais.

### Leaflet

Mantém independência em relação ao provedor da camada satélite.

### Leaflet-Geoman

Evita implementar manualmente ferramentas de desenho e edição de vértices.

### GeoJSON como núcleo

Reduz conversões internas e mantém compatibilidade com ferramentas geoespaciais.

### Proj4js para UTM

Evita implementação manual de transformações cartográficas.

### Turf.js para cálculos

Centraliza operações geoespaciais em biblioteca própria para esse domínio.

## 25. Evoluções futuras

A arquitetura permite posteriormente adicionar:

- persistência via Supabase/PostgreSQL + PostGIS;
- autenticação;
- projetos por usuário;
- compartilhamento;
- exportação múltipla;
- GeoJSON exportável;
- Shapefile/GeoPackage;
- pesquisa por endereço;
- GPS/localização;
- desenho de linhas e pontos;
- medições;
- layers temáticas;
- histórico de edição;
- permissões;
- upload de anexos por polígono.

Essas funcionalidades não devem ser antecipadas no MVP.

## 26. Definição de pronto do protótipo

O protótipo é considerado funcional quando um usuário consegue, sem login ou backend:

1. abrir o mapa satélite;
2. desenhar vários polígonos;
3. editar a geometria;
4. cadastrar características padrão e personalizadas;
5. visualizar área e coordenadas WGS84/UTM;
6. importar Polygon/MultiPolygon de KML;
7. exportar um polígono como KML;
8. gerar o relatório PDF;
9. excluir geometrias individualmente;
10. realizar essas operações sem interferência indevida entre polígonos.
