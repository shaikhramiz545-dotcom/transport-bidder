# User App – Testing & Bug Log

**App:** TBidder User (Passenger) App  
**Run:** `cd user_app` → `flutter run -d chrome`

---

## Testing Checklist

- [ ] App opens without crash (Chrome)
- [ ] Language selector (🌐) – Spanish/English/Russian/French
- [ ] **Map Peru ka** – default center Lima, Peru (-12.0464, -77.0428)
- [ ] **Google map red-circle buttons** – zoom +/- aur compass hide (zoomControlsEnabled: false, compassEnabled: false)
- [ ] **User ki current location** – blue dot ki jagah **gender emoji** (👨 male / 👩 female) map par dikhe
- [ ] **Google logo left corner** – abhi bhi dikh raha hai (Google ToS – hataana allowed nahi)
- [ ] **Driver on duty** – user ko 3–5 km andar "X taxis available within 3–5 km for booking" banner dikhe (backend + driver app location ping)
- [ ] Map loads, location permission
- [ ] Pickup/Destination search
- [ ] Vehicle type selection, fare estimate
- [ ] Book ride → bid/counter flow
- [ ] After bid accept: thank-you message + driver name + ETA
- [ ] Driver vehicle icon (🚗/🏍️) on map
- [ ] Chat & Call buttons after bid accept
- [ ] OTP → Start ride → Complete ride
- [ ] All UI text in selected language

---

## Bugs / Issues Found

*(Yahan user app ke bugs note karenge – jo bhi issue mile, likh dena. Phir sab ek sath fix karenge.)*

| # | Description | Where / Steps | Status |
|---|-------------|---------------|--------|
| 1 | Google ka button left corner mein show ho raha hai | Map bottom-left | Noted (ToS) |
| 2 | User ki location par gender emoji (male/female) show nahi ho rahi | Map par 👨/👩 emoji hona chahiye | Fixed (default 👨) |
| 3 | Driver on duty hai to user ko taxi available 3–5 km dikhe | Banner "X taxis available within 3–5 km" | Fixed |

---

## Notes

- Naya bug milne par upar table mein ek row add karo: short description, kahan/kaise reproduce, status (Open/Fixed).
