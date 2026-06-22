import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { setupFetchInterceptor } from './api';
import './index.css';

/** Field Team PWA service workers must not control admin routes (/field-team, etc.). */
async function cleanupNonSupervisorServiceWorkers(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
  if (window.location.pathname.startsWith('/supervisor')) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch {
    // Ignore — page should still load without SW cleanup.
  }
}

void cleanupNonSupervisorServiceWorkers();

if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', () => {
    window.location.reload();
  });
}
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

