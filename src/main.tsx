import React from 'react';
import ReactDOM from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import App from './App.tsx';
import './index.css';
import { preloadAuthStorage } from './lib/capacitorStorage';
import { useApexStore } from './store/useApexStore';

if (typeof window !== 'undefined') {
  (window as any).useApexStore = useApexStore;
}

// Pre-load Supabase auth tokens from native Preferences into memory
// BEFORE React renders, so supabase.auth.getSession() finds them.
preloadAuthStorage().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}).catch(() => {
  // Even if preload fails, render anyway (web fallback)
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
