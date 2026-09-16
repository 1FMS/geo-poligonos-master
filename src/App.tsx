import { MapView } from './components/MapView/MapView';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Toolbar } from './components/Toolbar/Toolbar';

export default function App() {
  return (
    <div className="app-shell">
      <header>
        <h1>Editor de Polígonos</h1>
        <Toolbar />
      </header>
      <main aria-label="Mapa de polígonos">
        <MapView />
      </main>
      <aside aria-label="Painel de polígonos">
        <Sidebar />
      </aside>
    </div>
  );
}
