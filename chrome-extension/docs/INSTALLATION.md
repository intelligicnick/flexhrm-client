# FlexHRM Smart Capture — Installation Guide

## Prerequisites

- Google Chrome 114+ (Side Panel API)
- FlexHRM backend running (NestJS API on port 3001 by default)
- Node.js 20+
- GeM seller account with access to Seller Bids and/or Orders

## 1. Start FlexHRM API

```bash
cd /path/to/flexhrm
npm run dev:backend
```

The API is available at `http://localhost:3001/api`.

## 2. Build the Chrome Extension

```bash
cd chrome-extension
npm install
npm run build
```

The production build is output to `chrome-extension/dist/`.

## 3. Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `chrome-extension/dist` folder

## 4. Connect to FlexHRM

1. Log in to FlexHRM in your browser
2. Open your **Profile** → **Browser Extension**
3. Click **Generate Connection Code** — you get a code like `FH-ABC123DEF456789012345678` (valid 10 minutes, single use)
4. Click the FlexHRM extension icon → **Settings & Connection**
5. Enter your **FlexHRM URL** (e.g. `http://localhost:3000` or your production URL)
6. Paste the **Connection Code** and click **Connect**
7. Click **Test Connection** to verify

For production split hosting, the extension reads `/extension-config.json` from the frontend origin to discover the API URL automatically.

## 5. Usage — GeM Seller Bids

1. Log in to [GeM Seller Bids](https://bidplus.gem.gov.in/seller-bids)
2. Tick checkboxes on tenders you want to capture
3. Click the floating **FH** button → **Pull & Read PDFs**
4. Review tenders in the **Side Panel** → **GeM Tenders** tab
5. Click **Import to FlexHRM**

To sync status on existing tenders: select tenders → **Sync Status**.

## 6. Usage — GeM Orders

1. Open [GeM Fulfilment](https://fulfilment.gem.gov.in/)
2. Click the floating **FH** button → **Pull All Orders** or **Pull Selected**
3. Review in the **GeM Contracts** tab → **Import to FlexHRM**

## Development Mode

```bash
cd chrome-extension
npm run dev
```

Load the `dist` folder after the dev server starts. HMR is supported via CRXJS.

## Running Tests

```bash
cd chrome-extension
npm test
```

## Troubleshooting

- **Extension inactive on this page** — navigate to GeM Seller Bids or Fulfilment; the extension only runs on those domains.
- **Connection code expired** — generate a new code from FlexHRM profile (codes expire after 10 minutes).
- **PDF read failed** — stay logged in to GeM; try fewer tenders at once; reload the extension at `chrome://extensions`.
