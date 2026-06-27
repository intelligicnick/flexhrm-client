# Flex HRM — Frontend

React 19 + Vite UI. Serves on port `3000` and proxies `/api/*` to the NestJS backend.

**Repository:** https://github.com/intelligicnick/flexhrm-client

Related repos: [flexhrm-server](https://github.com/intelligicnick/flexhrm-server) (API), [flexhrm-chrome-extension](https://github.com/intelligicnick/flexhrm-chrome-extension), [flexhrm-desktop-agent](https://github.com/intelligicnick/flexhrm-desktop-agent)

## Live deployment

| Service | URL |
|---------|-----|
| **UI** | https://greenyellow-woodpecker-750354.hostingersite.com |
| **API** | https://midnightblue-partridge-476451.hostingersite.com/api |
| **Supervisor login** | https://greenyellow-woodpecker-750354.hostingersite.com/supervisor/login |

Production URLs are defined in `src/deploy-urls.ts` and overridden via `.env.production`.

## Quick start

```bash
cp .env.example .env
npm install
npm run dev
```

Start the [backend](https://github.com/intelligicnick/flexhrm-server) first (`npm run start:dev`). Open [http://localhost:3000](http://localhost:3000).

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | UI server port |
| `BACKEND_URL` | `http://localhost:3001` | NestJS API URL |
| `GEMINI_API_KEY` | — | Optional AI features |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build |
| `npm start` | Run production server |
| `npm run export` | Create deploy ZIP |

## Deployment

| App | Hostinger URL | Setup guide |
|-----|---------------|-------------|
| **Frontend (this repo)** | https://greenyellow-woodpecker-750354.hostingersite.com | [HOSTINGER_SETUP.md](./HOSTINGER_SETUP.md) — `npm run build:hostinger` then upload ZIP to `public_html` |
| **Backend API** | https://midnightblue-partridge-476451.hostingersite.com/api | [flexhrm-server HOSTINGER_SETUP.md](https://github.com/intelligicnick/flexhrm-server/blob/main/HOSTINGER_SETUP.md) |

Verify the API after deploy:

```bash
curl -s https://midnightblue-partridge-476451.hostingersite.com/api/health | python3 -m json.tool
```
