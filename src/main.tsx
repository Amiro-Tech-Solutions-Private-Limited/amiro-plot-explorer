import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './index.css';
import App from './App';
import { runtime } from './store/runtime';
import { useStore } from './store/useStore';
import { getItem } from './lib/items';

if (import.meta.env.DEV) Object.assign(window, { __amiro: { runtime, useStore, getItem } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
