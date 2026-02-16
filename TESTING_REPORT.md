# TBidder – Subah Testing Report (Sabse pehle yahi karna hai)

**Yaad rahe:** Kal jo bhi changes kiye gaye, un sab ka testing subah sabse pehle karna hai. Neeche step-by-step list hai — kya test karna hai aur kahan.

---

## Pehle backend + admin chalana

1. **Backend start karo**
   - Folder: `backend`
   - Command: `npm start` (ya jo script hai)
   - Check: Server chal raha hai, koi error nahi

2. **Admin panel start karo**
   - Folder: `admin_panel`
   - Command: `npm run dev` (ya `npm start`)
   - Browser: Admin panel open karo

---

## 1. Driver App Testing

**Kahan:** `driver_app` — Chrome par: `flutter run -d chrome`

| # | Kya test karna hai | Kahan / Kaise |
|---|--------------------|----------------|
| 1 | **3-line menu (☰)** | Top-right pe menu icon — tap karo. Right side se drawer khulna chahiye. |
| 2 | **Total Earning** | Drawer ke upar bada box — "Total Earning" / "Ganancia total" aur amount (S/ 0.00 ya jo bhi). |
| 3 | **Today's Earning** | Uske neeche "Today's Earning" / "Ganancia de hoy" aur amount. |
| 4 | **Credit** | Uske neeche "Credit" / "Crédito" aur amount. |
| 5 | **Date range chips** | Drawer mein "Today", "This week", "Month", "Custom" chips — select karke check karo. |
| 6 | **Custom date** | "Custom" select karo — "From" aur "To" date buttons aane chahiye. Date picker se select karo. Max 3 months hint dikhna chahiye. |
| 7 | **Download PDF** | Date range select karke "Download PDF" dabao. PDF share/download option aana chahiye (Chrome par share dialog). |
| 8 | **Download Excel** | Same range pe "Download Excel" dabao. CSV file share/download honi chahiye, Excel mein open ho. |
| 9 | **Earnings save** | Ek ride accept karke complete karo. Phir menu kholo — Total Earning / Today Earning mein amount update hona chahiye. |
| 10 | **Language (🌐)** | Top-right language icon — Spanish/English switch. Drawer + menu text language ke hisaab se change hona chahiye. |
| 11 | **Chat & Call** | Ride accept hone ke baad (user side se accept) — driver app mein Chat aur Call buttons dikhne chahiye. Chat message bhejo, Call pe tap karke number dialer mein jana chahiye. |
| 12 | **Map: pickup/drop** | Accepted ride pe map par green (pickup) aur red (drop) markers dono dikhne chahiye; "Recogida" / "Destino" text bhi. |

---

## 2. User App Testing

**Kahan:** `user_app` — Chrome par: `flutter run -d chrome`

| # | Kya test karna hai | Kahan / Kaise |
|---|--------------------|----------------|
| 1 | **Language (🌐)** | Top-right — English, Spanish, Russian, French. UI text change hona chahiye. |
| 2 | **Ride book → bid accept** | Ride book karo, driver counter/accept kare. Accept ke baad thank-you message + driver name + ETA dikhna chahiye. |
| 3 | **Vehicle icon on map** | Ride accept hone ke baad map par driver ke liye vehicle emoji (🚗/🏍️) dikhna chahiye, generic pin nahi. |
| 4 | **Chat & Call** | Bid accept ke baad Chat aur Call buttons. Chat bhejo, Call pe driver number dialer mein. |
| 5 | **OTP → Start → Complete** | OTP do, ride start, phir complete. Saari messages localized (Spanish/selected language). |

---

## 3. Admin Panel Testing

**Kahan:** `admin_panel` (browser)

| # | Kya test karna hai | Kahan / Kaise |
|---|--------------------|----------------|
| 1 | **Bookings list** | Sidebar mein "Bookings" (MessageSquare icon). Click pe bookings list — ID, Date/Time, Pickup, Drop, Status, Price, Chat count. |
| 2 | **Ride detail + Chat** | Kisi booking pe click — detail page open. "Communication history" mein saare chat messages date/time ke sath dikhne chahiye (User/Driver). |

---

## 4. Quick checklist (subah ek baar bhaag ke)

- [ ] Backend chal raha hai  
- [ ] Admin panel open hai  
- [ ] Driver app: menu (☰) → Total / Today / Credit dikh rahe  
- [ ] Driver app: PDF + Excel download (Today/Week/Custom) kaam kar rahe  
- [ ] Driver app: 1 ride complete → earnings update  
- [ ] User app: language change + thank-you + ETA  
- [ ] User app: driver vehicle icon + Chat/Call  
- [ ] Admin: Bookings list + ride detail + chat history  

---

**Note:** Agar koi step fail ho, us step number aur app name (driver/user/admin) note kar lena — baad mein fix karte waqt kaam aayega.

**Subah sabse pehle yahi report kholna hai aur upar wale tests run karne hain.**
