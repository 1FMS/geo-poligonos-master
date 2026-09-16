# Editor de Polígonos

Editor geoespacial em React + TypeScript + Vite + Leaflet para desenhar, importar, editar e
exportar polígonos sobre imagens de satélite, sem backend: todo o estado vive na memória do
navegador durante a sessão.

## Como rodar

```bash
npm install
npm run dev        # inicia o servidor de desenvolvimento (Vite)
```

## Testes

```bash
npm run test:run   # testes unitários e de integração (Vitest + Testing Library)
npm run e2e        # testes end-to-end (Playwright); requer `npx playwright install chromium` na primeira vez
npm run build      # verificação de tipos (tsc -b) + build de produção (Vite)
```

O `npm run e2e` sobe o próprio `npm run dev` como servidor (`webServer` no
`playwright.config.ts`) e roda os cenários em `e2e/polygon-editor.spec.ts` contra ele.

## Limitações conhecidas

- **Sem persistência/backend**: não há banco de dados, API ou autenticação. Todo o estado
  (polígonos, propriedades, campos customizados) existe apenas em memória enquanto a página
  está aberta; recarregar a página descarta tudo.
- **Apenas Polygon e MultiPolygon**: outras geometrias KML (Point, LineString, GeometryCollection
  mista) são ignoradas na importação e contabilizadas como itens incompatíveis.
- **Dependência online dos tiles**: a camada de satélite é servida por um provedor de tiles Esri
  (World Imagery) via internet; sem conexão, o mapa fica indisponível (a aplicação sinaliza essa
  indisponibilidade na interface, mas não há um modo totalmente offline).
- **Atribuição Esri obrigatória**: por exigência da Esri, o crédito "Esri World Imagery" precisa
  permanecer visível no mapa; não remova o controle de atribuição do Leaflet.
- **Exportação/reimportação de MultiPolygon**: exportar uma entidade MultiPolygon como KML e
  reimportar o arquivo resultante atualmente recria N entidades Polygon separadas (uma por parte),
  em vez de reconstituir a mesma entidade MultiPolygon original. Essa limitação foi identificada
  na Task 9 e deliberadamente adiada (minor) — o dado geométrico não é perdido, mas a
  "entidade lógica única" não sobrevive a um ciclo completo de exportação + reimportação.
