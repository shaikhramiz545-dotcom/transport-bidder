# Firebase Setup — Backend ke liye (ek baar karna hai)

Backend (auth, rides, drivers) ab **Firebase Firestore** use karta hai. Iske liye sirf **ek JSON file** chahiye.

---

## Step 1: Firebase project

1. Browser me jao: **https://console.firebase.google.com**
2. Apna **Google account** se login karo.
3. Agar pehle se koi project hai (e.g. user/driver app ke liye) → usi project ko use karo.  
   Naya project chahiye ho to **"Create a project"** / **"Add project"** pe click karo, name do (e.g. `Tbidder`), create karo.

---

## Step 2: Firestore enable karo

1. Left side **"Build"** → **"Firestore Database"** pe click karo.
2. **"Create database"** pe click karo.
3. **"Start in test mode"** choose karo (development ke liye theek hai) → Next → location choose karo (e.g. `asia-south1`) → **Enable**.

---

## Step 3: Service account key download karo

1. Left side **⚙️ Project settings** (gear icon) pe click karo.
2. **"Service accounts"** tab pe jao.
3. Neeche **"Generate new private key"** pe click karo → **Generate key** confirm karo.
4. Ek **JSON file** download hogi (name kuch aisa hoga: `tbidder-xxxxx-firebase-adminsdk-xxxxx.json`).

---

## Step 4: File backend folder me rakhna

1. Downloaded JSON file ko **rename** karo: `serviceAccountKey.json`
2. Is file ko **copy** karke yahan **paste** karo:
   ```
   Tbidder_Project\backend\serviceAccountKey.json
   ```
   Matlab: `backend` folder ke andar, `package.json` jahan hai wahi folder me, `serviceAccountKey.json` naam se.

**Important:** Ye file secret hai — Git me commit mat karo. `.gitignore` me `serviceAccountKey.json` pehle se add hai.

---

## Step 5: Backend run karo

```powershell
cd "C:\Users\Alexender The Great\Desktop\Tbidder_Project\backend"
npm run dev
```

Agar sab sahi hai to terminal me aisa dikhega:
- `✅ DB: Firestore connected (auth, rides, drivers, health).`
- `🚀 [Tbidder] API listening on http://localhost:4001`

---

## Agar error aaye

- **"Firestore not configured"** → `serviceAccountKey.json` sahi jagah hai? Path: `backend\serviceAccountKey.json`
- **"Port 4001 is already in use"** → `.env` me `PORT=4002` kar do.
- **Firebase project / Firestore** pe doubt ho to Step 1–2 dobara check karo.

Bas itna karna hai — iske baad backend Firebase pe chalega.
