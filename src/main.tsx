import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './styles/globals.css';
import './styles/scrollbar.css';
import 'leaflet/dist/leaflet.css';
import './styles/leaflet-custom.css';

// Depois de um deploy os chunks antigos somem do servidor e a aba aberta falha
// ao abrir uma página ("Failed to fetch dynamically imported module"). O Vite
// avisa com vite:preloadError: recarrega uma vez para pegar o index novo. A
// guarda de 30 s evita loop se o erro continuar depois do reload.
window.addEventListener('vite:preloadError', event => {
  const CHAVE = 'neopower:preload-reload';
  try {
    const ultimo = Number(sessionStorage.getItem(CHAVE) || 0);
    if (Date.now() - ultimo < 30_000) return; // já recarregou há pouco: deixa o erro seguir
    sessionStorage.setItem(CHAVE, String(Date.now()));
  } catch {
    return; // sem sessionStorage não dá para garantir que não entra em loop
  }
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(<App />);
