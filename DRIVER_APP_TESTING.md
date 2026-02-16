# Driver App – Testing & Bug Log

**App:** TBidder Partner (Driver) App  
**Run:** `cd driver_app` → `flutter run -d chrome`

---

## Testing Checklist

- [ ] App opens without crash (Chrome)
- [ ] Skip for testing (Demo) – bina login home tak
- [ ] Language selector (🌐) – Spanish/English
- [ ] Map loads (no "reading 'maps'" error)
- [ ] **Online/Offline slider** – top pe map ke upar, app bar ke neeche (Estás desconectado | Switch | Driver on duty); switch ON karte hi "Driver on duty" / "Conductor en servicio" dikhe
- [ ] **Google map red-circle buttons** – zoom +/- aur compass/arrows hide (zoomControlsEnabled: false, compassEnabled: false)
- [ ] **Google logo left corner** – abhi bhi dikh raha hai (Google ToS ke hisaab se hataana allowed nahi ho sakta)
- [ ] Map par **driver ki current location** – **car emoji 🚗** marker (vehicle icon) jo real-time update ho; blue dot nahi
- [ ] Menu (☰) opens – Total Earning, Today Earning, Credit
- [ ] Date range: Today, Week, Month, Custom (max 3 months)
- [ ] Download PDF / Download Excel (CSV)
- [ ] New request: Accept, Counter, Decline
- [ ] Accepted ride: pickup & drop on map, Recogida/Destino text
- [ ] Chat & Call with user
- [ ] OTP → Start ride → Slide to complete
- [ ] After complete: earnings save, menu mein update

---

## Bugs / Issues Found

*(Yahan driver app ke bugs note karenge – jo bhi issue mile, likh dena. Phir sab ek sath fix karenge.)*

| # | Description | Where / Steps | Status |
|---|-------------|---------------|--------|
| 1 | Estás desconectado click par Driver on duty show nahi ho raha tha | Slider ON karo – text "Driver on duty" dikhna chahiye | Fixed |
| 2 | Google ka button left corner mein show ho raha hai | Dono apps – map bottom-left | Noted (ToS) |
| 3 | Driver ki location par car show nahi ho rahi | Map par 🚗 emoji marker hona chahiye | Fixed |
| 4 | Driver on duty → user ko 3–5 km andar taxi available dikhe | User app par banner "X taxis available within 3–5 km" | Fixed |

---

## Notes

- Naya bug milne par upar table mein ek row add karo: short description, kahan/kaise reproduce, status (Open/Fixed).
