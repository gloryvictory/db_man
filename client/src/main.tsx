import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#1b1e26',
            color: '#e7eaf0',
            border: '1px solid #272c39',
            borderRadius: '8px',
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);
