# TBidder – Run Commands (PowerShell)

PowerShell mein **`→`** se commands chain **nahi** hoti. Neeche sahi syntax diya gaya hai.

---

## Backend (Node)

Ek line mein (semicolon se):
```powershell
cd "C:\Users\Alexender The Great\Desktop\Tbidder_Project\backend"; npm run migrate; npm start
```

Ya step by step:
```powershell
cd "C:\Users\Alexender The Great\Desktop\Tbidder_Project\backend"
npm run migrate
npm start
```

---

## User app (Flutter – Chrome)

Ek line mein:
```powershell
cd "C:\Users\Alexender The Great\Desktop\Tbidder_Project\user_app"; flutter pub get; flutter run -d chrome
```

Ya step by step:
```powershell
cd "C:\Users\Alexender The Great\Desktop\Tbidder_Project\user_app"
flutter pub get
flutter run -d chrome
```

---

## Driver app (Flutter – Chrome)

```powershell
cd "C:\Users\Alexender The Great\Desktop\Tbidder_Project\driver_app"; flutter pub get; flutter run -d chrome
```

---

## Summary

| Galat (PowerShell nahi samjhega) | Sahi |
|----------------------------------|------|
| `cd backend → npm start`         | `cd backend; npm start` |
| `cd user_app → flutter run`      | `cd user_app; flutter run -d chrome` |

- **Chain ke liye:** `;` (semicolon)
- **Path mein space ho to:** path ko quotes mein lo: `"C:\...\Tbidder_Project\user_app"`
