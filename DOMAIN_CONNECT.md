# TBidder – Apna Domain Connect Kaise Karein

Pehle domain ko apne server se connect karte hain. Iske baad HTTPS (SSL) laga kar apps use kar sakte ho.

---

## Step 1: Domain aur server ki tayyari

- **Domain:** Jahan se domain liya hai (GoDaddy, Namecheap, Cloudflare, Google Domains, etc.) – wahi pe DNS edit karenge.
- **Server IP:** Jis machine par backend + Nginx chalega, uska **public IP** pata hona chahiye (e.g. `43.xxx.xxx.xxx`).
- **Subdomains jo use karenge:**

| Subdomain | Use |
|-----------|-----|
| `api.tbidder.com` | Backend API (Node.js port 4000) |
| `app.tbidder.com` | User app (Flutter web) |
| `driver.tbidder.com` | Driver app (Flutter web) |
| `admin.tbidder.com` | Admin panel (Vite build) |

Agar aapka domain alag hai (e.g. `transportbidder.com`), to `api.transportbidder.com`, `app.transportbidder.com` waise hi use karo.

---

## Step 2: DNS records add karo

Domain provider ke **DNS** / **Manage DNS** section mein jao. Neeche jaisa add karo (apna domain aur IP lagao):

| Type | Name / Host | Value | TTL (optional) |
|------|-------------|--------|-----------------|
| A    | `api`       | `YOUR_SERVER_IP` | 300 ya Auto |
| A    | `app`       | `YOUR_SERVER_IP` | 300 ya Auto |
| A    | `driver`    | `YOUR_SERVER_IP` | 300 ya Auto |
| A    | `admin`     | `YOUR_SERVER_IP` | 300 ya Auto |

- **Name:** Sirf subdomain part – `api`, `app`, `driver`, `admin` (domain provider automatically `tbidder.com` lagata hai).
- **Value:** Server ka public IP.
- Agar root bhi same server par chalaana ho to ek aur record: Type **A**, Name **@**, Value **YOUR_SERVER_IP**.

Save karo. Propagation mein 5–30 minute (kabhi 1–2 ghante) lag sakte hain. Check: `ping api.tbidder.com` – apna IP aana chahiye.

---

## Step 3: Server par Nginx install karo

Server (Linux) par:

```bash
sudo apt update
sudo apt install nginx -y
sudo systemctl enable nginx
```

---

## Step 4: SSL certificate (HTTPS) – Let's Encrypt

Pehle **Certbot** install karo:

```bash
sudo apt install certbot python3-certbot-nginx -y
```

Phir ek hi command se saare subdomains ke liye certificate lo (apna domain replace karo):

```bash
sudo certbot --nginx -d api.tbidder.com -d app.tbidder.com -d driver.tbidder.com -d admin.tbidder.com
```

Email daalo, terms accept karo. Certbot automatically Nginx config mein HTTPS add kar dega. Auto-renewal ke liye:

```bash
sudo certbot renew --dry-run
```

---

## Step 5: Nginx config – TBidder ke liye

**Option A:** Repo mein ready config hai – server par copy karo, domain replace karo:

```bash
# Apne project se (ya scp se upload karke):
sudo cp deploy/nginx-tbidder.conf.example /etc/nginx/sites-available/tbidder
sudo nano /etc/nginx/sites-available/tbidder   # tbidder.com → apna domain (4 jagah)
```

**Option B:** Neeche wala config manually paste karo. Pehle file banao:

```bash
sudo nano /etc/nginx/sites-available/tbidder
```

Neeche wala config paste karo. `tbidder.com` ki jagah apna domain likho:

```nginx
# API backend (Node.js 4000)
server {
    listen 80;
    server_name api.tbidder.com;
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# User app (Flutter web – static files)
server {
    listen 80;
    server_name app.tbidder.com;
    root /var/www/tbidder/user_app_web;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}

# Driver app (Flutter web – static files)
server {
    listen 80;
    server_name driver.tbidder.com;
    root /var/www/tbidder/driver_app_web;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}

# Admin panel (Vite build – static files)
server {
    listen 80;
    server_name admin.tbidder.com;
    root /var/www/tbidder/admin_panel_dist;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Save karo (Ctrl+O, Enter, Ctrl+X).

Phir:

1. Static files ke liye folder banao aur build files copy karo:
   ```bash
   sudo mkdir -p /var/www/tbidder/user_app_web /var/www/tbidder/driver_app_web /var/www/tbidder/admin_panel_dist
   ```
   (Build baad mein karke yahi paths par copy karenge – Step 6.)

2. Site enable karo:
   ```bash
   sudo ln -s /etc/nginx/sites-available/tbidder /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

3. SSL lagaao (Step 4 wala certbot command):
   ```bash
   sudo certbot --nginx -d api.tbidder.com -d app.tbidder.com -d driver.tbidder.com -d admin.tbidder.com
   ```

Iske baad URLs yeh honge:
- **API:** https://api.tbidder.com  
- **User app:** https://app.tbidder.com  
- **Driver app:** https://driver.tbidder.com  
- **Admin panel:** https://admin.tbidder.com  

---

## Step 6: Build aur deploy (domain set hone ke baad)

1. **Backend** – server par `.env` mein port 4000, DB theek. Start: `npm start` ya pm2.  
2. **Admin panel** – `.env` mein:
   ```env
   VITE_API_URL=https://api.tbidder.com
   ```
   Phir `npm run build` → `dist` ki saari cheezen server par `/var/www/tbidder/admin_panel_dist` mein copy karo.
3. **User app** – `flutter build web --dart-define=BACKEND_URL=https://api.tbidder.com` → `build/web` ki files `/var/www/tbidder/user_app_web` par copy karo.
4. **Driver app** – same: `BACKEND_URL=https://api.tbidder.com` se build → `build/web` → `/var/www/tbidder/driver_app_web`.

Detail ke liye **DEPLOY_SERVER.md** dekho.

---

## Short checklist

| Step | Kaam |
|------|------|
| 1 | Domain + server IP ready |
| 2 | DNS: A records for `api`, `app`, `driver`, `admin` → server IP |
| 3 | Server par Nginx install |
| 4 | Certbot se SSL (HTTPS) |
| 5 | Nginx config paste karo (domain replace), enable, reload |
| 6 | Backend chalao, builds copy karo (DEPLOY_SERVER.md) |

Domain connect ho jayega; phir apps ko `https://api.tbidder.com` (ya apna domain) use karke build/deploy karna **DEPLOY_SERVER.md** mein hai.
