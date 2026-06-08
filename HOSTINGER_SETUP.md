# Hostinger — Full Setup Guide (Database + Deploy + Export)

Complete steps to run Flex HRM as a commercial project on Hostinger with MySQL.

---

## What you need on Hostinger

| Plan | Works? | Notes |
|------|--------|-------|
| **VPS** | Yes (recommended) | Node.js + MySQL on same server |
| **Cloud / Node.js hosting** | Yes | If Node.js is supported |
| **Shared PHP-only hosting** | No | Cannot run this Node.js app |

You need: **SSH access**, **Node.js 20+**, **MySQL/MariaDB**.

---

## Part A — Create MySQL database in Hostinger

### Option 1: VPS (database on same server)

1. Log in to **Hostinger hPanel**
2. Open your **VPS** → note the **SSH IP**, **username**, **password**
3. Go to **Databases** → **MySQL Databases** (or install MySQL on VPS via SSH)

**In hPanel (if MySQL manager is available):**

1. Click **Create database**
   - Database name: `flexhrm` (Hostinger may prefix it, e.g. `u123456_flexhrm`)
2. Click **Create user**
   - Username: e.g. `flexhrm_user` (may become `u123456_flexhrm`)
   - Strong password — save it
3. **Assign user to database** with **ALL PRIVILEGES**
4. Write down these 5 values:

```
DB_HOST=127.0.0.1          (same VPS — use localhost)
DB_PORT=3306
DB_USER=u123456_flexhrm    (your actual username)
DB_PASSWORD=YourPassword   (your actual password)
DB_NAME=u123456_flexhrm    (your actual database name)
```

### Option 2: Remote MySQL (separate database hosting)

If Hostinger gives you a remote hostname (e.g. `mysql123.hostinger.com`):

```
DB_HOST=mysql123.hostinger.com
DB_PORT=3306
DB_USER=...
DB_PASSWORD=...
DB_NAME=...
```

---

## Part B — Export project from your Mac (full package)

On your computer, in the project folder:

```bash
cd "/Users/nikhil/Desktop/employee-management-hrms (5)"
chmod +x scripts/export-for-hostinger.sh
npm run export
```

This creates: **`flex-hrm-deploy-YYYYMMDD-HHMM.zip`**

The ZIP contains:

- Built app (`dist/`)
- Source code (`src/`, `db/`, `server.ts`)
- Your data files (`employees-db.json`, `admins-db.json`, etc.)
- `DEPLOYMENT.md`, `HOSTINGER_SETUP.md`, `.env.example`
- **No** `node_modules` (installed on server)
- **No** `.env` secrets

---

## Part C — Upload to Hostinger VPS

### 1. Connect via SSH

```bash
ssh youruser@YOUR_VPS_IP
```

### 2. Install Node.js (if not installed)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # should show v20+
```

### 3. Upload ZIP

**From your Mac** (new terminal):

```bash
scp "/Users/nikhil/Desktop/employee-management-hrms (5)/flex-hrm-deploy-*.zip" youruser@YOUR_VPS_IP:/home/youruser/
```

**On VPS:**

```bash
cd /home/youruser
unzip flex-hrm-deploy-*.zip
cd flex-hrm-deploy-*
```

### 4. One-command install (recommended)

```bash
cp .env.example .env
nano .env    # paste MySQL credentials from Part A
chmod +x scripts/install-on-server.sh
./scripts/install-on-server.sh
```

This runs: install → build → `db:setup` → `db:migrate` → PM2 start → health check.

### 4b. Manual install (alternative)

```bash
npm install
npm run build
```

---

## Part D — Connect database (.env file)

```bash
cp .env.example .env
nano .env
```

Paste and edit with your MySQL credentials from Part A:

```env
NODE_ENV=production
PORT=3000
DATA_DIR=/home/youruser/flexhrm-data

STORAGE_DRIVER=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=u123456_flexhrm
DB_PASSWORD=YOUR_REAL_PASSWORD
DB_NAME=u123456_flexhrm
```

Create persistent data folder:

```bash
mkdir -p /home/youruser/flexhrm-data
```

---

## Part E — Import your data into MySQL

Your JSON files are in the project folder. Run migration **once**:

```bash
npm run db:migrate
```

Expected output:

```
Migrating JSON data from: /home/youruser/flexhrm-deploy-...
Migration complete: { employees: 6000+, admins: 1, roles: 2, logs: ... }
```

Verify connection:

```bash
npm start
# In another SSH tab:
curl http://127.0.0.1:3000/api/health
```

Should return:

```json
{"status":"healthy","storage":"mysql","ready":true}
```

Stop test with `Ctrl+C`, then run with PM2 (Part F).

---

## Part F — Keep app running 24/7 (PM2)

```bash
sudo npm install -g pm2
pm2 start dist/server.cjs --name flexhrm
pm2 save
pm2 startup
# Run the command PM2 prints (sudo env PATH=...)
```

Useful commands:

```bash
pm2 status
pm2 logs flexhrm
pm2 restart flexhrm
```

---

## Part G — Domain + HTTPS (Nginx)

In hPanel, point your domain **A record** to VPS IP.

On VPS:

```bash
sudo apt install nginx -y
sudo nano /etc/nginx/sites-available/flexhrm
```

```nginx
server {
    listen 80;
    server_name hrms.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/flexhrm /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

SSL (free):

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d hrms.yourdomain.com
```

---

## Part H — Backup (commercial operation)

### Database backup (daily)

```bash
mysqldump -u DB_USER -p DB_NAME > /home/youruser/backups/flexhrm-$(date +%F).sql
```

### Full project backup

```bash
tar -czf flexhrm-backup-$(date +%F).tar.gz \
  /home/youruser/flexhrm-deploy-* \
  /home/youruser/flexhrm-data \
  /home/youruser/backups
```

Hostinger VPS also offers **snapshot backups** in hPanel — enable them.

---

## Part I — Export data FROM the app (Excel/PDF)

Inside the running app (no extra setup):

| Feature | Where in app |
|---------|----------------|
| Employee Excel export | Employees tab → Export |
| Salary / ledger reports | Salary / Ledger tabs |
| Audit log Excel/PDF | Admin → Audit Logs |
| CSV bulk import | Employees → Import CSV |

Server-side data lives in **MySQL** after migration. JSON files are only the initial import source.

---

## Quick checklist

- [ ] VPS purchased, SSH works
- [ ] MySQL database + user created in hPanel
- [ ] `npm run export` on Mac → ZIP created
- [ ] ZIP uploaded and unzipped on VPS
- [ ] `.env` filled with MySQL credentials
- [ ] `npm run db:migrate` completed
- [ ] `curl /api/health` shows `"storage":"mysql"`
- [ ] PM2 running `flexhrm`
- [ ] Domain + SSL configured
- [ ] Admin password changed from default

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `ECONNREFUSED` on MySQL | Wrong `DB_HOST`; on VPS use `127.0.0.1` |
| `Access denied for user` | Wrong user/password; re-check hPanel |
| `ER_BAD_DB_ERROR` | `DB_NAME` doesn't match hPanel database name |
| App works but no employees | Run `npm run db:migrate` again |
| Data lost after redeploy | Keep `DATA_DIR` outside app folder; don't delete MySQL |
| Port 3000 not public | Normal — use Nginx on port 80/443 |

---

## Support info to share if stuck

Run on VPS and save output:

```bash
node -v
curl -s http://127.0.0.1:3000/api/health
pm2 logs flexhrm --lines 30
```
