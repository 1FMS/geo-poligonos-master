interface MapStatusProps {
  satelliteAvailable: boolean;
}

export function MapStatus({ satelliteAvailable }: MapStatusProps) {
  if (satelliteAvailable) {
    return null;
  }

  return <p className="map-status" role="status">Camada de satélite indisponível.</p>;
}
