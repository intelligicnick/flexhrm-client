import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { setupFetchInterceptor } from './api';
import './index.css';
import 'leaflet/dist/leaflet.css';

/** Stale dev service workers intercept /api and spam workbox logs on admin routes. */
async function cleanupDevServiceWorkers(): Promise<void> {
  if (!import.meta.env.DEV || typeof navigator === 'undefined' || !navigator.serviceWorker) {
    return;
  }
  if (window.location.pathname.startsWith('/supervisor')) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
}

void cleanupDevServiceWorkers();
setupFetchInterceptor();

if (typeof window !== 'undefined' && window.location.pathname.startsWith('/supervisor')) {
  const isNativeApp = /FlexHrmSupervisor/i.test(navigator.userAgent);
  if (!isNativeApp) {
    void import('virtual:pwa-register').then(({ registerSW }) => {
      registerSW({ immediate: true });
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

