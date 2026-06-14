import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { setupFetchInterceptor } from './api';
import './index.css';

setupFetchInterceptor();

if (typeof window !== 'undefined' && window.location.pathname.startsWith('/supervisor')) {
  void import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

