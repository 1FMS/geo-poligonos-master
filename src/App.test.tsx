import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';
import { PolygonProvider } from './app/PolygonProvider';

describe('App', () => {
  it('exibe as três áreas principais do editor', () => {
    render(<PolygonProvider><App /></PolygonProvider>);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByLabelText('Mapa de polígonos')).toBeInTheDocument();
    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });
});
