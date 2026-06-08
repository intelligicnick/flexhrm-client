# Flex HRM — Commercial Deployment on Hostinger

This guide covers deploying Flex HRM as a production HRMS with **MySQL/MariaDB**, suitable for Hostinger VPS or Cloud hosting with Node.js.

## Requirements

- **Hostinger VPS** (or any Linux server with Node.js 20+)
- **MySQL/MariaDB** (included in Hostinger hPanel) **or** SQLite for single-node setups
- Domain pointed to your server (optional SSL via Hostinger or Certbot)

> **Note:** Shared hosting without Node.js cannot run this app. Use **VPS** or **Hostinger Node.js hosting** if available.

---

## 1. Create MySQL database (Hostinger hPanel)

1. Log in to **hPanel** → **Databases** → **MySQL Databases**
2. Create database: `flexhrm`
3. Create user with full privileges on that database
4. Note: host (often `localhost` on VPS), user, password, database name

---

## 2. Upload and install on VPS

```bash
# SSH into your Hostinger VPS
cd /home/youruser
git clone <your-repo-url> flexhrm
cd flexhrm

npm install
npm run build
```

---

## 3. Configure environment

```bash
cp .env.example .env
nano .env
```

Example production `.env`:

```env
NODE_ENV=production
PORT=3000
DATA_DIR=/home/youruser/flexhrm-data

STORAGE_DRIVER=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=u123456_flexhrm
DB_PASSWORD=your_secure_password
DB_NAME=u123456_flexhrm
```

Create persistent data directory:

```bash
mkdir -p /home/youruser/flexhrm-data
```

---

## 4. Migrate existing JSON data (first deploy only)

If you have `employees-db.json`, `admins-db.json`, etc. from development:

```bash
MIGRATE_SOURCE_DIR=/home/youruser/flexhrm npm run db:migrate
```

This imports all employees, admins, roles, and audit logs into MySQL/SQLite.

---

## 5. Run with PM2 (recommended)

```bash
npm install -g pm2
pm2 start dist/server.cjs --name flexhrm
pm2 save
pm2 startup
```

---

## 6. Reverse proxy (Nginx)

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

Enable SSL in Hostinger or use Certbot for HTTPS.

---

## JSON storage fallback (no MySQL)

If MySQL is not available, use persistent JSON files (not recommended above ~500 employees):

```env
STORAGE_DRIVER=json
DATA_DIR=/home/youruser/flexhrm-data
```

Copy your `*-db.json` files into `DATA_DIR`. No migration script needed.

---

## Default login

After first deploy, sign in with the admin account from `admins-db.json` (default was created as `admin` / `admin123` if you used sample data). **Change the password immediately** in Admin → Security.

---

## Health check

```bash
curl http://127.0.0.1:3000/api/health
```

Response includes `storage` driver (`mysql` or `json`).

---

## Backup

**MySQL:** Use Hostinger automatic backups or:

```bash
mysqldump -u USER -p flexhrm > flexhrm-backup-$(date +%F).sql
```

**JSON mode:** Backup all `*-db.json` files in `DATA_DIR`.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `ECONNREFUSED` MySQL | Check `DB_HOST`, ensure MySQL service is running |
| Data lost after redeploy | Set `DATA_DIR` outside the deploy folder |
| 401 after restart | Sessions are in-memory; users re-login (expected) |
| Use JSON in dev | `STORAGE_DRIVER=json` or omit MySQL env vars locally |
