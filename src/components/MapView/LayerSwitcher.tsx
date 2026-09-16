import type { SatelliteSource } from './SatelliteLayer';

interface LayerSwitcherProps {
  source: SatelliteSource;
  onChange: (source: SatelliteSource) => void;
}

export function LayerSwitcher({ source, onChange }: LayerSwitcherProps) {
  return (
    <div className="layer-switcher" role="group" aria-label="Camada de satélite">
      <button
        type="button"
        aria-pressed={source === 'esri'}
        onClick={() => onChange('esri')}
        title="Esri World Imagery — mais nítido, porém com data de captura variável"
      >
        Esri (nítido)
      </button>
      <button
        type="button"
        aria-pressed={source === 'sentinel'}
        onClick={() => onChange('sentinel')}
        title="Sentinel-2 cloudless — geralmente mais recente, porém com resolução mais baixa (~10 m/pixel)"
      >
        Sentinel-2 (recente)
      </button>
    </div>
  );
}
