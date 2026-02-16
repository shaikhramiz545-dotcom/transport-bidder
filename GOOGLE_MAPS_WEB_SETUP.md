# Google Maps Web Error Fix – "This page can't load Google Maps correctly"

Yeh error **location permission** se alag hai. Web (Chrome) par map tabhi load hota hai jab **Google Maps API key** sahi ho, **APIs enable** hon, aur **billing** on ho.

---

## Step 1: Google Cloud Console kholen

1. Browser mein jayein: **https://console.cloud.google.com**
2. Same **Google account** se login karein jisse Firebase (transport-bidder) use karte hain.
3. **Project** select karein – wahi jo Maps key ke liye use ho raha hai (e.g. **transport-bidder** ya jahan ye key bani hai).

---

## Step 2: Billing enable karein (zaroori)

Google Maps **billing** ke bina kaam nahi karta (free tier bhi billing account ke saath milta hai).

1. Left menu → **Billing**.
2. Agar "Link a billing account" dikhe to link karein (card details zaroori hain).
3. Free tier mein har mahine kuch credit milte hain – development ke liye usually kaafi.

---

## Step 3: Maps APIs enable karein

1. Left menu → **APIs & Services** → **Library**.
2. Search karein: **Maps JavaScript API** → open karein → **Enable**.
3. Phir search karein: **Places API** (user app ke liye Places autocomplete) → **Enable**.
4. Optional: **Geocoding API** agar address ↔ lat/lng use karte hain.

---

## Step 4: API key check karein / nayi banayein

1. **APIs & Services** → **Credentials**.
2. List mein apni **API key** dhundhen (e.g. `YOUR_GOOGLE_MAPS_API_KEY`).
   - Agar nahi hai to **+ Create Credentials** → **API key** → copy karein.
3. Key pe click karein (edit).

**Application restrictions (Web ke liye):**

- **Application restrictions:** "HTTP referrers (web sites)" choose karein.
- **Website restrictions** mein ye add karein (har line alag):
  - `http://localhost:*`
  - `http://127.0.0.1:*`
  - Production ke liye: `https://yourdomain.com/*`

**API restrictions:**

- "Restrict key" choose karein.
- **Maps JavaScript API** aur **Places API** (user app ke liye) select karein.
- **Save** karein.

---

## Step 5: Key ko app mein use karein

Dono apps mein key pehle se `web/index.html` mein hai:

- **user_app:** `user_app/web/index.html` – script tag mein `key=...`
- **driver_app:** `driver_app/web/index.html` – script tag mein `key=...`

Agar aapne **nayi key** banayi hai to dono files mein wahi key replace karein:

- `user_app/web/index.html`: line ~29, `key=YOUR_NEW_KEY`
- `driver_app/web/index.html`: line ~24, `key=YOUR_NEW_KEY`

---

## Step 6: Dubara run karein

1. Browser band karein (Chrome tabs jo app dikha rahe the).
2. Terminal se app phir run karein:
   - User app: `cd user_app; flutter run -d chrome`
   - Driver app: `cd driver_app; flutter run -d chrome`
3. Map ab load hona chahiye (billing + APIs + key sahi hon to).

---

## Agar ab bhi error aaye

| Problem | Check |
|--------|--------|
| "Do you own this website?" | API key **HTTP referrers** mein `http://localhost:*` aur `http://127.0.0.1:*` add kiya? |
| Dark/watermarked map | Billing enable hai? Key sahi project ki hai? |
| Blank map | Browser console (F12) mein koi error? **Maps JavaScript API** enabled hai? |

---

## Short checklist

- [ ] Google Cloud project select (e.g. transport-bidder)
- [ ] Billing linked
- [ ] **Maps JavaScript API** enabled
- [ ] **Places API** enabled (user app ke liye)
- [ ] API key **HTTP referrers** mein `http://localhost:*` aur `http://127.0.0.1:*`
- [ ] `user_app/web/index.html` aur `driver_app/web/index.html` mein wahi key
- [ ] App restart (flutter run -d chrome)
