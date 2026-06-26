# FlexHRM Smart Capture

Chrome Extension (Manifest V3) for capturing GeM (Government e-Marketplace) tenders and orders into FlexHRM.

## Features

- **GeM Seller Bids** — select tenders on `bidplus.gem.gov.in`, pull listing data, read bid PDFs, and import to FlexHRM
- **GeM Orders** — capture contracts from `fulfilment.gem.gov.in`
- **Tender status sync** — update existing FlexHRM tenders from GeM listing status
- **Side panel review** — edit fields before import
- **Offline queue** — queue failed saves and sync later
- **Secure connection** — one-time `FH-` connection code from FlexHRM profile (AES-GCM encrypted storage)

## Quick Start

```bash
# Start backend
npm run dev:backend

# Build extension
cd chrome-extension && npm install && npm run build
```

Load `chrome-extension/dist` in Chrome → Connect via connection code → Open GeM Seller Bids.

See [docs/INSTALLATION.md](docs/INSTALLATION.md) for full setup instructions.

## Supported Sites

| Site | URL pattern | Actions |
|------|-------------|---------|
| GeM Seller Bids | `bidplus.gem.gov.in/seller-bids*` | Pull tenders, read PDFs, sync status |
| GeM Orders | `fulfilment.gem.gov.in/*` | Pull orders/contracts |

The extension icon and side panel activate only on these domains.

## Project Structure

```
chrome-extension/
├── src/
│   ├── background/       # Service worker, message routing
│   ├── content/          # GeM Seller Bids + Orders FABs
│   ├── sidepanel/        # Tender/contract review, queue
│   ├── popup/            # Quick actions
│   ├── options/          # Connection settings
│   ├── modules/
│   │   ├── tenders/      # GeM tender extractors + PDF parser
│   │   └── contracts/    # GeM orders extractor
│   └── shared/
│       ├── types/        # TypeScript interfaces
│       ├── services/     # API, storage, encryption
│       └── utils/        # Messaging, URL helpers
├── tests/
└── docs/
```

## Backend Integration

API module: `backend/src/modules/smart-capture/`

Endpoints: `/api/smart-capture/*`, `/api/tenders/*`, `/api/contracts/*`

## License

Private — FlexHRM / Intelligic Solutions
