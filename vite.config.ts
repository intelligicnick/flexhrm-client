import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Runs before Vite HMR scripts so extension rejections are caught early. */
const EXTENSION_GUARD_BOOTSTRAP = `(function(){var M=['tabs:outgoing.message.ready','outgoing.message.ready','no listener:','message channel closed before a response was received','could not establish connection','receiving end does not exist','the message port closed before a response was received','a listener indicated an asynchronous response by returning true','extension context invalidated'];function f(v,d){if(v==null||d>6)return'';if(typeof v==='string')return v;if(v instanceof Error)return[v.message,v.stack,v.cause?f(v.cause,d+1):''].filter(Boolean).join(' ');if(typeof v==='object')return[v.message,v.name,v.stack,v.reason?f(v.reason,d+1):'',v.error?f(v.error,d+1):'',String(v)].filter(Boolean).join(' ');return String(v)}function n(v){var t=f(v,0).toLowerCase();for(var i=0;i<M.length;i++)if(t.indexOf(M[i])!==-1)return true;return false}function s(e,r){if(!n(r))return false;if(e&&e.preventDefault)e.preventDefault();if(e&&e.stopImmediatePropagation)e.stopImmediatePropagation();return true}function u(e){s(e,e.reason)}function w(e){s(e,e.message)||s(e,e.error)}var g=typeof globalThis!=='undefined'?globalThis:window;g.addEventListener('unhandledrejection',u,true);g.addEventListener('error',w,true);g.onunhandledrejection=u})();`;

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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const backendUrl = env.BACKEND_URL || '';

  return {
    plugins: [extensionErrorGuardPlugin, react(), tailwindcss()],
    define: {
      "process.env.BACKEND_URL": JSON.stringify(backendUrl),
      "process.env.PUBLIC_API_URL": JSON.stringify(env.PUBLIC_API_URL || ""),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
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
