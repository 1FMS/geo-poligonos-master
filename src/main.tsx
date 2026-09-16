import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PolygonProvider } from './app/PolygonProvider';
import App from './App';
import 'leaflet/dist/leaflet.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PolygonProvider>
      <App />
    </PolygonProvider>
  </StrictMode>,
);
