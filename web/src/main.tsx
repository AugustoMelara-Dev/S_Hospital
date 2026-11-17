import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { App } from './app/App';

const el = document.getElementById('root');
if (!el) throw new Error('Falta el elemento #root');

createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
