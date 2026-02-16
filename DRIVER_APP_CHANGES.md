# Driver App – Changes Log

**Focus:** Driver App + Admin Panel only  
**Process:** Aap changes likhte ho → main verify karke implement karta hoon

---

## Rules (Follow karunga)

1. **UI changes:** 2 alternatives, recommend one, approval ke baad hi code
2. **Driver fix = User app check:** Same feature User app mein hai? → dono fix
3. **Pehle verify, phir change** – direct edit nahi

---

## Running

| App           | Command                         | Port/Output |
|---------------|----------------------------------|-------------|
| Driver App    | `cd driver_app` → `flutter run -d chrome` | Chrome      |
| Admin Panel   | `cd admin_panel` → `npm run dev` | localhost:5173 |
| Backend*      | `cd backend` → `npm start`       | 4000        |

\* Driver app OTP/auth ke liye backend chahiye

---

## Changes (Aap yahan likhenge)

### Format
```
### [Screen name] – [Change #]
- **Kya:** (short description)
- **Kahan:** (exact location – top/bottom/button name)
- **Kaise:** (kya karna hai)
- **User app mein same?** (agar pata ho to likho, nahi to main verify karunga)
- **Status:** Pending
```

---

### Example entry (delete karke apna likhna)

### Login Screen – Change 1
- **Kya:** Login button color
- **Kahan:** Login button, form ke neeche
- **Kaise:** Button orange hona chahiye, abhi grey hai
- **User app mein same?** Haan, User app mein bhi Login screen hai
- **Status:** Pending

---

### Your changes (niche add karte jao)

*(Yahan se aap apne changes likhenge – ek ek karke. Main read karke verify karunga, phir implement.)*



