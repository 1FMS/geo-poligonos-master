import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchOnrPolygonsNear, OnrFetchError } from './fetchOnrPolygon';

const jsonResponse = (body: unknown) => ({ ok: true, json: async () => body }) as Response;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchOnrPolygonsNear', () => {
  it('busca o token, consulta o FeatureServer ao redor do ponto e devolve os polígonos convertidos', async () => {
    const fetchMock = vi
      .fn()
      // 1st call: token proxy
      .mockResolvedValueOnce(jsonResponse({ sucesso: true, token: 'fake-token' }))
      // 2nd call: FeatureServer query
      .mockResolvedValueOnce(
        jsonResponse({
          features: [
            {
              attributes: { matricula: '8207', cartorio: '3º RI', cidade: 'São Luís', uf: 'MA' },
              geometry: {
                rings: [
                  [
                    [-44.2479, -2.5246],
                    [-44.2478, -2.5246],
                    [-44.2478, -2.5247],
                    [-44.2479, -2.5246],
                  ],
                ],
              },
            },
          ],
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchOnrPolygonsNear(-2.524678, -44.247602, 50);

    expect(result.polygons).toHaveLength(1);
    expect(result.polygons[0].properties.name).toBe('ONR - matrícula 8207');
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/onr-token', expect.objectContaining({ method: 'POST' }));
    const featureServerUrl = fetchMock.mock.calls[1][0] as string;
    expect(featureServerUrl).toContain('token=fake-token');
    expect(featureServerUrl).toContain('imoveis_georreferenciamento');
  });

  it('lança OnrFetchError quando a renovação do token falha', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(jsonResponse({ sucesso: false, mensagem: 'indisponível' })),
    );

    await expect(fetchOnrPolygonsNear(-2.5, -44.2, 50)).rejects.toThrow(OnrFetchError);
  });

  it('lança OnrFetchError quando o FeatureServer retorna um erro', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ sucesso: true, token: 'fake-token' }))
      .mockResolvedValueOnce(jsonResponse({ error: { message: 'Invalid Token' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchOnrPolygonsNear(-2.5, -44.2, 50)).rejects.toThrow(OnrFetchError);
  });
});
