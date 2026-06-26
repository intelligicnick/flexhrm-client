import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Read shared defaults without importing deploy-urls (import.meta.env is unavailable in vite.config). */
const clientConfig = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../shared/client-config.json'), 'utf8'),
) as { apiOrigin: string; frontendOrigin: string };

/** Runs before Vite HMR scripts so extension rejections are caught early. */
const EXTENSION_GUARD_BOOTSTRAP = fs.readFileSync(
  path.resolve(__dirname, 'public/extension-error-guard.js'),
  'utf8',
);

const extensionErrorGuardPlugin = {
  name: 'extension-error-guard',
  transformIndexHtml: {
    order: 'pre' as const,
    handler() {
      return [
        {
          tag: 'script',
          children: EXTENSION_GUARD_BOOTSTRAP,
          injectTo: 'head-prepend' as const,
        },
      ];
    },
  },
};

function stripRemoteFontsForNativeBuild(disablePwa: boolean) {
  if (!disablePwa) return null;
  return {
    name: 'strip-remote-fonts-native',
    transformIndexHtml(html: string) {
      return html
        .replace(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com"[^>]*>\s*/g, '')
        .replace(/<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com"[^>]*>\s*/g, '')
        .replace(/<link href="https:\/\/fonts\.googleapis\.com[^"]+"[^>]*>\s*/g, '');
    },
  };
}

function resolveProductionApiBase(env: Record<string, string>): string {
  const fromEnv =
    env.FLEXHRM_API_BASE || env.PUBLIC_API_URL || env.VITE_API_BASE || "";
  const apiBase = (fromEnv || clientConfig.apiOrigin).trim().replace(/\/$/, "");
  return apiBase;
}

function resolveIdCardVerifyBase(env: Record<string, string>): string {
  const fromEnv =
    env.VITE_ID_CARD_VERIFY_BASE_URL || env.ID_CARD_VERIFY_BASE_URL || "";
  const defaultBase = `${clientConfig.frontendOrigin}/employee`;
  return (fromEnv || defaultBase).trim().replace(/\/$/, "");
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const backendUrl = env.BACKEND_URL || 'http://localhost:3001';
  const productionApiBase = resolveProductionApiBase(env);
  const idCardVerifyBase = resolveIdCardVerifyBase(env);
  const disablePwa = env.VITE_DISABLE_PWA === 'true';
  const enablePwaDev = env.VITE_PWA_DEV === 'true';

  return {
    plugins: [
      extensionErrorGuardPlugin,
      stripRemoteFontsForNativeBuild(disablePwa),
      react(),
      tailwindcss(),
      ...(!disablePwa
        ? [
            VitePWA({
              registerType: 'autoUpdate',
              injectRegister: false,
              minify: false,
              scope: '/supervisor/',
              includeAssets: ['favicon.svg', 'pwa/icon.svg', 'pwa/icon-192.png', 'pwa/icon-512.png'],
              manifest: {
                name: 'Flex HRM Field Team',
                short_name: 'Field Team',
                description: 'Supervisor login for field visits, requests, and commitments.',
                start_url: '/supervisor/login',
                scope: '/supervisor/',
                display: 'standalone',
                background_color: '#f8fafc',
                theme_color: '#ff791a',
                lang: 'en-IN',
                orientation: 'portrait',
                categories: ['business', 'productivity'],
                icons: [
                  {
                    src: '/pwa/icon-192.png',
                    sizes: '192x192',
                    type: 'image/png',
                    purpose: 'any',
                  },
                  {
                    src: '/pwa/icon-512.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'any',
                  },
                  {
                    src: '/pwa/icon-512.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'maskable',
                  },
                ],
              },
              workbox: {
                navigateFallback: '/index.html',
                navigateFallbackDenylist: [/^\/api/],
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
                maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
                sourcemap: false,
                runtimeCaching: [
                  {
                    urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
                    handler: 'NetworkOnly',
                  },
                ],
              },
              devOptions: {
                // Dev SW intercepts /api and HMR unless explicitly enabled for supervisor PWA testing.
                enabled: enablePwaDev,
              },
            }),
          ]
        : []),
    ],
    define: {
      "process.env.BACKEND_URL": JSON.stringify(backendUrl),
      __FLEXHRM_API_BASE__: JSON.stringify(productionApiBase),
      __FLEXHRM_ID_CARD_VERIFY_BASE__: JSON.stringify(idCardVerifyBase),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        ...(disablePwa
          ? { 'virtual:pwa-register': path.resolve(__dirname, 'src/lib/pwa-register-shim.ts') }
          : {}),
      },
    },
    // esbuild 0.28+ errors on destructuring for legacy browser targets during dep pre-bundling.
    esbuild: {
      supported: {
        destructuring: true,
      },
    },
    optimizeDeps: {
      esbuildOptions: {
        supported: {
          destructuring: true,
        },
      },
    },
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('exceljs')) return 'excel';
            if (id.includes('xlsx')) return 'xlsx';
            if (id.includes('html2canvas')) return 'html2canvas';
            if (id.includes('leaflet')) return 'leaflet';
            if (id.includes('qrcode')) return 'qrcode';
            if (id.includes('pdfjs-dist')) return 'pdfjs';
            if (id.includes('jspdf')) return 'jspdf';
            if (id.includes('lucide-react')) return 'icons';
            if (id.includes('/motion/') || id.includes('motion/dist')) return 'motion';
            if (
              id.includes('react-dom') ||
              id.includes('react-router') ||
              /\/react\//.test(id)
            ) {
              return 'vendor';
            }
          },
        },
      },
    },
    server: {
      host: true,
      allowedHosts: true,
      proxy: backendUrl
        ? {
            '/api': {
              target: backendUrl,
              changeOrigin: true,
            },
          }
        : undefined,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
