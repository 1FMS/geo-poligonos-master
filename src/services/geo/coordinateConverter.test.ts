import { describe, expect, it } from 'vitest';

import { toUtm } from './coordinateConverter';

describe('toUtm', () => {
  it('projects São Paulo into UTM zone 23 south', () => {
    const result = toUtm([-46.6333, -23.5505]);

    expect(result).toMatchObject({ zone: 23, hemisphere: 'S' });
    expect(result.easting).toBeCloseTo(333_287.9, 0);
    expect(result.northing).toBeCloseTo(7_394_588.3, 0);
  });
});
