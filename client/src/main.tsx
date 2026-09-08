import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import '@mantine/core/styles.css';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

const theme = createTheme({
  primaryColor: 'brand',
  defaultRadius: 'md',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontFamilyMonospace:
    'ui-monospace, "SF Mono", "Cascadia Code", "JetBrains Mono", Consolas, monospace',
  colors: {
    brand: [
      '#e6fbf2',
      '#c8f5e2',
      '#9feccd',
      '#6ee0b2',
      '#4bd49b',
      '#35c98e',
      '#25a874',
      '#1a8559',
      '#12633f',
      '#0c4a2f',
    ],
    dark: [
      '#c9c9cf',
      '#b3b4bb',
      '#8f919a',
      '#6b6e78',
      '#4b4e57',
      '#373a42',
      '#242732',
      '#1b1e26',
      '#151820',
      '#0e1015',
    ],
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <BrowserRouter>
        <App />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#1b1e26',
              color: '#e7eaf0',
              border: '1px solid #272c39',
            },
          }}
        />
      </BrowserRouter>
    </MantineProvider>
  </React.StrictMode>
);
