# Clear app, panel cache & DB for a fresh test

Use this when you want to retry the driver verification flow (e.g. after backend restart or to fix “pending after approve”).

## 1) Driver app — clear local data

- Open **Driver app** → **Drawer** → **Settings**.
- Tap **“Clear local data (for testing)”**.
- Confirm; then **restart the app** (or go to Home and go online again).
- Effect: Removes stored driver ID and welcome flags. Next time the app will get a **new driver ID** from the backend and fetch **fresh verification status**.

## 2) Admin panel — clear cache & logout

- In **Admin panel** sidebar, scroll to the bottom.
- Click **“Clear cache & logout”**.
- Effect: Clears all `localStorage` (token + any cache) and sends you to the login screen. Log in again for a clean session.

## 3) Backend — reset driver verification (optional)

If you want **all drivers** to show as **pending** again in the admin list (and in the app when it fetches status):

```bash
cd backend
node scripts/clear-driver-test-data.js
```

- Effect: Sets every `DriverVerification` row to `status = 'pending'` and clears reupload fields. Driver IDs and documents are **not** deleted.

## Suggested order for a full retry

1. Run `node scripts/clear-driver-test-data.js` (if you want a clean verification state).
2. In the **admin panel**, click **“Clear cache & logout”** and log in again.
3. In the **driver app**, open **Settings** → **“Clear local data (for testing)”**, then restart the app.
4. In the app: complete verification (upload docs) → in admin, approve the **same driver ID** shown in the app → app should show approved after refresh/open.
