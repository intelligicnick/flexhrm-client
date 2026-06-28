# Hostinger — Frontend (Static Website)

Deploy the React UI to **Hostinger Website** hosting (not Node.js). The browser talks directly to the NestJS API on the separate backend app.

## Live URLs

| Service | URL |
|---------|-----|
| **UI (this guide)** | https://greenyellow-woodpecker-750354.hostingersite.com |
| **Login** | https://greenyellow-woodpecker-750354.hostingersite.com/hrmlogin |
| **API** | https://mediumseagreen-chimpanzee-998149.hostingersite.com/api |
| **Health check** | https://mediumseagreen-chimpanzee-998149.hostingersite.com/api/health |

Repository: https://github.com/intelligicnick/flexhrm-client

---

## 403 Forbidden — fix this first

**Pushing to GitHub does not deploy files to Hostinger.** A 403 means `public_html` is empty (frontend) or the API site is not a running Node.js app (backend).

If the site shows **403 Forbidden** (including `/hrmlogin`), the web server has **no files to serve**. The Node API returning 403 at the same time usually means **both Hostinger apps need to be redeployed**.

### Quick diagnosis

```bash
curl -sI https://greenyellow-woodpecker-750354.hostingersite.com/hrmlogin | head -1
curl -sI https://mediumseagreen-chimpanzee-998149.hostingersite.com/api/health | head -1
```

Both showing `403` = nothing deployed yet. Fix frontend (below) and backend ([server HOSTINGER_SETUP.md](https://github.com/intelligicnick/flexhrm-server/blob/main/HOSTINGER_SETUP.md)).

### Frontend (greenyellow) — static website

1. **hPanel → Websites → greenyellow-woodpecker-750354 → File Manager → `public_html`**
2. Confirm **`index.html`** and **`.htaccess`** exist **directly** in `public_html` (not inside a nested `dist/` folder).
3. If the folder is empty or only has a failed Git deploy artifact, upload a fresh build (see below).
4. File permissions: folders **755**, files **644** (File Manager → right‑click → Permissions).

### Backend (mediumseagreen-chimpanzee) — Node.js Web App

The API must be a **Node.js Web App**, not a static website. See [flexhrm-server HOSTINGER_SETUP.md](https://github.com/intelligicnick/flexhrm-server/blob/main/HOSTINGER_SETUP.md).

Until this returns JSON, login will not work:

```bash
curl -s https://mediumseagreen-chimpanzee-998149.hostingersite.com/api/health
```

---

## Option A — Upload ZIP (fastest)

On your Mac, in the frontend repo:

```bash
cd frontend
npm install
npm run build:hostinger
```

This creates `flexhrm-frontend-static-YYYYMMDD-HHMM.zip`.

In **hPanel → File Manager → public_html**:

1. Select all existing files → **Delete** (or move to a backup folder).
2. **Upload** the ZIP → **Extract**.
3. Verify `public_html/index.html` and `public_html/.htaccess` exist.
4. Visit https://greenyellow-woodpecker-750354.hostingersite.com/hrmlogin

---

## Option C — GitHub Actions FTP (recommended after one-time setup)

Use this when manual ZIP upload is tedious. The workflow builds `dist/` and uploads to `public_html` on every push to `main`.

### One-time setup

1. **hPanel → Files → FTP Accounts** — note **Host**, **Username**, **Password**
2. **GitHub → flexhrm-client → Settings → Secrets and variables → Actions**
   - Secrets: `HOSTINGER_FTP_SERVER`, `HOSTINGER_FTP_USERNAME`, `HOSTINGER_FTP_PASSWORD`
   - Variables: `HOSTINGER_DEPLOY_ENABLED` = `true`
3. **Actions → Deploy to Hostinger → Run workflow**
4. Verify:

   ```bash
   curl -sI https://greenyellow-woodpecker-750354.hostingersite.com/hrmlogin | head -1
   ```

Expected: `HTTP/2 200`

If FTP path differs on your account, edit `server-dir` in `.github/workflows/deploy-hostinger.yml` (check File Manager — path shown at top when inside `public_html`).

---

## Option B — GitHub auto-deploy

In **hPanel → Websites → greenyellow app → Git** (or Deployments), connect `flexhrm-client`:

| Setting | Value |
|---------|-------|
| **Branch** | `main` |
| **Root directory** | `/` |
| **Build command** | `npm install && npm run build:hostinger:static && npm run verify:hostinger` |
| **Output / publish directory** | `dist` |

Add build env var in hPanel if builds fail with memory errors:

| Variable | Value |
|----------|-------|
| `NODE_OPTIONS` | `--max-old-space-size=4096` |

After deploy, confirm `public_html` contains `index.html` — not an empty folder.

---

## Production API URL (baked into build)

The UI calls the API directly in production. Values live in `.env.production`:

```env
PUBLIC_API_URL=https://mediumseagreen-chimpanzee-998149.hostingersite.com
VITE_ID_CARD_VERIFY_BASE_URL=https://greenyellow-woodpecker-750354.hostingersite.com/employee
```

Change these before `npm run build:hostinger` if your Hostinger URLs change.

---

## SPA routing (.htaccess)

`public/.htaccess` is copied into `dist/` during build. It rewrites paths like `/hrmlogin` to `index.html`. Without it you get 404 on refresh; without `index.html` in `public_html` you get **403**.

---

## Verify end-to-end

```bash
# 1. Frontend serves HTML (not 403)
curl -sI https://greenyellow-woodpecker-750354.hostingersite.com/hrmlogin | head -5

# 2. API is healthy
curl -s https://mediumseagreen-chimpanzee-998149.hostingersite.com/api/health | python3 -m json.tool
```

Expected: frontend `HTTP/2 200`, API `"ready": true`.

---

## Troubleshooting

| Problem | What to check |
|---------|----------------|
| **403** on all paths | Empty `public_html`; redeploy or upload ZIP |
| **404** on `/hrmlogin` | Missing `.htaccess` in `public_html` |
| **Blank page** | Browser console → wrong `PUBLIC_API_URL` in build |
| **CORS errors** | Backend `CORS_ORIGINS` must include frontend URL |
| **Login fails, API OK** | MongoDB / admin user; see backend guide |
| Build fails on Hostinger | Add `NODE_OPTIONS=--max-old-space-size=4096`; check deploy logs |

---

## Related

- [README.md](./README.md) — local development
- [flexhrm-server HOSTINGER_SETUP.md](https://github.com/intelligicnick/flexhrm-server/blob/main/HOSTINGER_SETUP.md) — NestJS API on Node.js Web Apps
