# MACHII MENS MART — PRODUCTION DEPLOYMENT & OPERATIONS MANUAL

This manual provides the step-by-step procedures to deploy, operate, and monitor the Machii Mens Mart e-commerce storefront in production safely.

---

## 1. PRE-DEPLOYMENT VERIFICATION & ARTIFACTS

Before initiating deployment, verify that all local checks pass:

```bash
# 1. Verify code formatting and linting
npm run lint

# 2. Verify production build compilation
npm run build

# 3. Verify database schema and catalog data integrity
node server/dbMigration.js --verify

# 4. Run full end-to-end audit
node run_master_audit.mjs
```

---

## 2. PRODUCTION HOSTING OPTIONS

### Option A: Cloud PaaS (Render / Railway / Fly.io) — Recommended

1. **Connect Repository**: Link your GitHub/GitLab repository to Render or Railway.
2. **Build & Start Commands**:
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm start` (or `node server/productionServer.js`)
3. **Environment Variables**: Add variables from your `.env.example` in the dashboard.
4. **Health Check Path**: Set `/health`. Render/Railway will automatically verify the `/health` endpoint before redirecting live traffic, guaranteeing zero-downtime deployments.

### Option B: Docker Container (AWS ECS / Cloud Run / DigitalOcean App Platform)

Build and run using the multi-stage Dockerfile:

```bash
# Build the production container image
docker build -t machii-mens-mart:latest .

# Run the container with environment variables
docker run -d \
  -p 3000:3000 \
  --name machii-store \
  --env-file .env \
  machii-mens-mart:latest
```

### Option C: Linux VPS (Ubuntu / Debian with PM2 & Nginx)

1. **Clone repository and build**:
   ```bash
   cd /var/www/machii-mens-mart
   npm ci
   npm run build
   ```
2. **Configure PM2 process manager**:
   ```bash
   npm install -g pm2
   pm2 start server/productionServer.js --name "machii-store" -i max
   pm2 save
   pm2 startup
   ```
3. **Configure Nginx Reverse Proxy with SSL (Certbot)**:
   ```nginx
   server {
       server_name machiimensmart.com www.machiimensmart.com;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
4. **Obtain SSL Certificate**:
   ```bash
   sudo certbot --nginx -d machiimensmart.com -d www.machiimensmart.com
   ```

---

## 3. PAYMENT GATEWAY: TEST MODE TO LIVE MODE PROCEDURE

The storefront supports both **Cash on Delivery (COD)** and **Online Payments via Razorpay**.

### Step 1: Verification in Test Mode
1. In `.env`, configure Razorpay Test Keys:
   ```env
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
   ```
2. Start the server and navigate to Checkout.
3. Select "Online Payment", initiate a transaction using Razorpay Test UPI/Cards (`success@razorpay`).
4. Verify order confirmation is generated with `paymentStatus: 'PAID'` and customer notification is logged.

### Step 2: Transitioning to Live Mode
1. Complete merchant KYC verification in the [Razorpay Dashboard](https://dashboard.razorpay.com/).
2. Generate Live API Keys from **Settings → API Keys → Generate Live Key**.
3. In production environment configuration (e.g. Render Dashboard or `.env`), replace:
   ```env
   RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
   ```
4. Configure Webhooks:
   - In Razorpay Dashboard → **Settings → Webhooks** → Add New Webhook.
   - **URL**: `https://machiimensmart.com/api/payment/webhook`
   - **Secret**: Set `RAZORPAY_WEBHOOK_SECRET` in `.env`.
   - **Events to subscribe**: `payment.captured`, `payment.failed`, `order.paid`.
5. Restart the server or trigger redeployment.

---

## 4. HEALTH MONITORING & AUTOMATED RECOVERY

### Live Health Endpoint
```bash
curl -I https://machiimensmart.com/health
```
Returns HTTP 200 with JSON payload:
```json
{
  "status": "healthy",
  "service": "machii-mens-mart",
  "uptime": 1420,
  "checks": {
    "api": "ok",
    "catalog": "ok",
    "productsCount": 11,
    "paymentMode": "ONLINE_AND_COD"
  }
}
```

### Uptime Alerting
Configure an external uptime monitor (e.g., UptimeRobot, BetterUptime, Pingdom, or Cloudflare Health Checks) pointing to `https://machiimensmart.com/health` with a 60-second check interval and alert on status code != 200.

---

## 5. ROLLBACK PROCEDURE

If an issue is detected post-deployment:

1. **PaaS (Render / Railway / Vercel)**:
   - Navigate to the **Deployments** tab in the dashboard.
   - Select the previous stable deployment commit.
   - Click **Rollback to this deploy**. Reversion takes under 30 seconds.
2. **Docker**:
   ```bash
   docker stop machii-store
   docker rm machii-store
   docker run -d -p 3000:3000 --name machii-store --env-file .env machii-mens-mart:previous-stable
   ```
3. **PM2**:
   ```bash
   git revert HEAD --no-edit
   npm run build
   pm2 reload machii-store
   ```

