import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';
import { initTheme } from './lib/theme';

initTheme();

// basename берётся из Vite `base` (import.meta.env.BASE_URL), чтобы SPA работал под /db_man
const basename = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--surface-elevated)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);
