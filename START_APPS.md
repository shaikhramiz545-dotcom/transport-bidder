# TBidder – Start Order (Har Baar Same)

**Rule:** Pehle Backend, phir Admin, phir Driver App.

**Note:** `npm start` ab automatically purana process (port 4001) kill karke naya start karta hai – "Port already in use" error nahi aayega.

---

## Step 1: Backend (Zaroori – Sabse Pehle)

```powershell
cd "C:\Users\Alexender The Great\Desktop\Tbidder_Project\backend"
npm start
```

Wait: `🚀 [Tbidder] API listening on http://localhost:4001` dikhne tak.

---

## Step 2: Diagnosis (Optional – Check Karke Dekho)

**Naya terminal** kholo:

```powershell
cd "C:\Users\Alexender The Great\Desktop\Tbidder_Project\backend"
npm run diagnose
```

Agar koi ✗ aaye to woh fix karo (e.g. `npm run migrate`).

---

## Step 3: Admin Panel

**Naya terminal**:

```powershell
cd "C:\Users\Alexender The Great\Desktop\Tbidder_Project\admin_panel"
npm run dev
```

Open: http://localhost:5173  
Login: `admin@tbidder.com` / `admin123`

---

## Step 4: Driver App

**Naya terminal**:

```powershell
cd "C:\Users\Alexender The Great\Desktop\Tbidder_Project\driver_app"
flutter run -d chrome
```

---

## Quick Reference

| App        | Port | Command              |
|-----------|------|----------------------|
| Backend   | 4001 | `cd backend` → `npm start` |
| Admin     | 5173 | `cd admin_panel` → `npm run dev` |
| Driver    | Chrome | `cd driver_app` → `flutter run -d chrome` |

**Admin Panel 500?** → Backend band hai. Step 1 pehle karo.

**Wallet "Backend not reachable"?**
1. Backend chal raha hona chahiye (Step 1).
2. Migration run karo: `cd backend` → `npm run migrate`
3. Backend restart karo: `npm start`
