import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'FlexHRM Smart Capture',
  version: '1.0.2',
  description:
    'Capture GeM tenders and orders from bidplus.gem.gov.in and fulfilment.gem.gov.in into FlexHRM.',
  icons: {
    '16': 'src/assets/icon-16.png',
    '32': 'src/assets/icon-32.png',
    '48': 'src/assets/icon-48.png',
    '128': 'src/assets/icon-128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'FlexHRM Smart Capture',
    default_icon: {
      '16': 'src/assets/icon-16.png',
      '32': 'src/assets/icon-32.png',
    },
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  options_page: 'src/options/index.html',
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://bidplus.gem.gov.in/seller-bids*'],
      js: ['src/content/index.ts'],
      css: ['src/content/content.css'],
      run_at: 'document_idle',
    },
    {
      matches: ['https://fulfilment.gem.gov.in/*'],
      js: ['src/content/fulfilment.ts'],
      css: ['src/content/content.css'],
      run_at: 'document_idle',
    },
  ],
  permissions: [
    'activeTab',
    'alarms',
    'contextMenus',
    'declarativeContent',
    'storage',
    'sidePanel',
    'scripting',
    'tabs',
    'unlimitedStorage',
  ],
  host_permissions: ['https://*/*', 'http://localhost/*', 'http://127.0.0.1/*'],
  web_accessible_resources: [
    {
      resources: ['src/assets/*', 'assets/*'],
      matches: ['https://bidplus.gem.gov.in/*', 'https://fulfilment.gem.gov.in/*'],
    },
  ],
});
