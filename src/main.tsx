import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './styles/scrollbar.css';
import 'leaflet/dist/leaflet.css';
import './styles/leaflet-custom.css';

createRoot(document.getElementById('root')!).render(<App />);
