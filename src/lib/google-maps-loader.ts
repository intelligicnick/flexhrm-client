export type GoogleMapsNamespace = typeof google.maps;

declare global {
  interface Window {
    google?: { maps: GoogleMapsNamespace };
  }
}

let loadPromise: Promise<typeof google> | null = null;

export async function loadGoogleMaps(apiKey: string): Promise<typeof google> {
  if (window.google?.maps) return window.google;
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-flexhrm-google-maps]');
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.google?.maps) resolve(window.google);
        else reject(new Error('Google Maps failed to load.'));
      });
      existing.addEventListener('error', () => reject(new Error('Google Maps script error.')));
      return;
    }

    const script = document.createElement('script');
    script.dataset.flexhrmGoogleMaps = '1';
    script.async = true;
    script.defer = true;
    // Classic Marker only — avoid loading the Advanced Marker library in WebViews.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.onload = () => {
      if (window.google?.maps) resolve(window.google);
      else reject(new Error('Google Maps failed to initialize.'));
    };
    script.onerror = () => reject(new Error('Could not load Google Maps. Check API key and billing.'));
    document.head.appendChild(script);
  });

  return loadPromise;
}
