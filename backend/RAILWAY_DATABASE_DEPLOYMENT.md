# Railway.app PostgreSQL Database Deployment Guide

## Overview

Railway.app provides managed PostgreSQL databases with automatic backups, SSL connections, and easy scaling. This guide covers deploying the Tbidder PostgreSQL database on Railway.

---

## Step 1: Create Railway Account

1. Go to https://railway.app
2. Sign up with GitHub (recommended) or email
3. Verify your account

---

## Step 2: Create New Project

1. Click **"New Project"**
2. Select **"Provision PostgreSQL"**
3. Railway will automatically create a PostgreSQL database

---

## Step 3: Get Database Connection Details

After provisioning, click on the PostgreSQL service to view connection details:

### Connection Variables (Available in Railway Dashboard)

Railway provides these environment variables automatically:

```
DATABASE_URL=postgresql://postgres:PASSWORD@HOST:PORT/railway
PGHOST=HOST
PGPORT=PORT
PGUSER=postgres
PGPASSWORD=PASSWORD
PGDATABASE=railway
```

### Manual Connection Details

You can also find individual connection details in the **"Connect"** tab:

- **Host:** `containers-us-west-XXX.railway.app`
- **Port:** `5432` (or custom port)
- **Database:** `railway`
- **Username:** `postgres`
- **Password:** (shown in dashboard)

---

## Step 4: Run Database Migrations

### Option A: Using Railway CLI (Recommended)

1. **Install Railway CLI:**
   ```bash
   npm i -g @railway/cli
   ```

2. **Login to Railway:**
   ```bash
   railway login
   ```

3. **Link to your project:**
   ```bash
   cd backend
   railway link
   ```

4. **Run migrations:**
   ```bash
   railway run npm run migrate
   ```

### Option B: Using Local Connection

1. **Get DATABASE_URL from Railway dashboard**

2. **Set environment variable and run migrations:**
   ```bash
   cd backend
   
   # Windows PowerShell
   $env:PG_HOST="containers-us-west-XXX.railway.app"
   $env:PG_PORT="5432"
   $env:PG_DATABASE="railway"
   $env:PG_USER="postgres"
   $env:PG_PASSWORD="YOUR_PASSWORD_FROM_RAILWAY"
   $env:PG_SSL="true"
   npm run migrate
   
   # Or use DATABASE_URL directly
   $env:DATABASE_URL="postgresql://postgres:PASSWORD@HOST:PORT/railway"
   npm run migrate
   ```

### Option C: Using pgAdmin or psql

1. **Download connection details from Railway**

2. **Connect using psql:**
   ```bash
   psql "postgresql://postgres:PASSWORD@HOST:PORT/railway?sslmode=require"
   ```

3. **Run migration files manually:**
   ```sql
   \i migrations/001_initial_schema.sql
   \i migrations/002_password_reset_otp.sql
   -- ... continue for all migration files
   ```

---

## Step 5: Configure Backend for Railway Database

### Environment Variables for Cloud Run

When deploying backend to Cloud Run, set these environment variables:

```bash
gcloud run deploy tbidder-backend \
  --set-env-vars "PG_HOST=containers-us-west-XXX.railway.app" \
  --set-env-vars "PG_PORT=5432" \
  --set-env-vars "PG_DATABASE=railway" \
  --set-env-vars "PG_USER=postgres" \
  --set-env-vars "PG_PASSWORD=YOUR_RAILWAY_PASSWORD" \
  --set-env-vars "PG_SSL=true"
```

### Or Use DATABASE_URL

Railway provides a `DATABASE_URL` connection string. You can modify `backend/src/config/db.js` to support it:

**Option 1: Add DATABASE_URL support to config/index.js**

```javascript
// Parse DATABASE_URL if provided (Railway, Heroku, etc.)
const databaseUrl = process.env.DATABASE_URL;
let pgConfig;

if (databaseUrl) {
  const url = new URL(databaseUrl);
  pgConfig = {
    host: url.hostname,
    port: parseInt(url.port, 10) || 5432,
    database: url.pathname.slice(1), // Remove leading /
    user: url.username,
    password: url.password,
    ssl: true,
  };
} else {
  pgConfig = {
    host: pgHost,
    port: parseInt(process.env.PG_PORT, 10) || 5432,
    database: process.env.PG_DATABASE || 'tbidder',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD != null ? String(process.env.PG_PASSWORD) : '',
    ssl: pgSsl,
  };
}

module.exports = {
  env,
  port: parseInt(process.env.PORT, 10) || 4000,
  firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS,
  pg: pgConfig,
  jwtSecret: jwtSecret || 'tbidder-dev-secret-change-in-production',
  mockOtp: process.env.MOCK_OTP || '123456',
};
```

Then deploy with just:
```bash
gcloud run deploy tbidder-backend \
  --set-env-vars "DATABASE_URL=postgresql://postgres:PASSWORD@HOST:PORT/railway"
```

---

## Step 6: Verify Database Connection

### Test Connection from Backend

1. **Start backend locally with Railway DB:**
   ```bash
   cd backend
   
   # Set Railway connection details
   $env:PG_HOST="containers-us-west-XXX.railway.app"
   $env:PG_PORT="5432"
   $env:PG_DATABASE="railway"
   $env:PG_USER="postgres"
   $env:PG_PASSWORD="YOUR_PASSWORD"
   $env:PG_SSL="true"
   
   npm start
   ```

2. **Check health endpoint:**
   ```bash
   curl http://localhost:4000/health
   ```

   Expected response:
   ```json
   {
     "ok": true,
     "service": "tbidder-api",
     "db": "postgresql",
     "timestamp": "2026-02-13T..."
   }
   ```

### Test with Railway CLI

```bash
railway run npm run diagnose
```

---

## Step 7: Database Management

### Access Database Console

1. Go to Railway dashboard
2. Click on PostgreSQL service
3. Click **"Data"** tab to view tables
4. Or click **"Connect"** → **"psql"** to open terminal

### Backup Database

Railway automatically backs up your database. To create manual backup:

1. Railway Dashboard → PostgreSQL service
2. Click **"Backups"** tab
3. Click **"Create Backup"**

### Restore from Backup

1. Railway Dashboard → PostgreSQL service
2. Click **"Backups"** tab
3. Select backup and click **"Restore"**

---

## Step 8: Monitor Database

### View Metrics

Railway Dashboard → PostgreSQL service → **"Metrics"** tab shows:
- CPU usage
- Memory usage
- Disk usage
- Connection count

### View Logs

Railway Dashboard → PostgreSQL service → **"Logs"** tab

---

## Pricing

Railway offers:
- **Free Tier:** $5 credit/month (sufficient for development)
- **Pro Plan:** $20/month + usage-based pricing
- **PostgreSQL:** ~$0.000463/GB-hour for storage + $0.000231/GB for egress

Estimated cost for small production app: **$5-15/month**

---

## Security Best Practices

1. **Always use SSL:** Set `PG_SSL=true`
2. **Use Secret Manager:** Store `PG_PASSWORD` in Google Secret Manager, not env vars
3. **Restrict Access:** Use Railway's private networking if backend is also on Railway
4. **Regular Backups:** Enable automatic backups in Railway
5. **Monitor Connections:** Check connection pool metrics regularly

---

## Troubleshooting

### Connection Timeout

- Verify `PG_SSL=true` is set
- Check Railway service is running (green status)
- Verify firewall allows outbound connections on port 5432

### Too Many Connections

- Backend connection pool is set to max 5 per instance
- Check Cloud Run max instances setting
- Consider upgrading Railway plan for more connections

### Migration Errors

- Ensure migrations run in correct order (001, 002, 003...)
- Check Railway logs for specific error messages
- Verify database user has CREATE/ALTER permissions

---

## Alternative: Deploy Database on Railway Too

If you want to deploy the entire backend on Railway (not just database):

1. **Create new Railway project**
2. **Add PostgreSQL service** (as above)
3. **Add new service from GitHub:**
   - Connect your GitHub repository
   - Select `backend` folder as root
   - Railway will auto-detect Node.js and deploy

4. **Set environment variables in Railway:**
   - `NODE_ENV=production`
   - `JWT_SECRET=your_secret`
   - `FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-admin-key.json`
   - Railway will auto-inject `DATABASE_URL`

5. **Railway will provide a public URL:**
   - `https://tbidder-backend-production.up.railway.app`

---

## Summary

✅ **Database:** Railway PostgreSQL (managed, auto-backups, SSL)  
✅ **Backend:** Google Cloud Run (serverless, auto-scaling)  
✅ **Connection:** Secure SSL connection with connection pooling  
✅ **Cost:** ~$5-15/month for Railway DB + Cloud Run usage  

**Next Steps:**
1. Create Railway account and provision PostgreSQL
2. Run migrations using Railway CLI or local connection
3. Update Cloud Run deployment with Railway database credentials
4. Test health endpoint to verify connection
