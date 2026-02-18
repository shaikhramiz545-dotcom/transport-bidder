# Firebase Console – Email/Password Setup (Step-by-Step)

TBidder User App ke liye Firebase Authentication enable karne ka guide.

---

## Step 1: Firebase Console kholo

1. Browser mein jao: **https://console.firebase.google.com/**
2. Apne Google account se **Sign in** karo
3. Agar pehle se project hai (e.g. **transport-bidder**) to us par click karo  
   **Ya** naya project banane ke liye **"Add project"** / **"Create a project"** par click karo

---

## Step 2: Project select / create karo

- **Existing project:** List mein se apna project select karo (e.g. `transport-bidder`)
- **Naya project:**  
  - Project name do (e.g. `Tbidder`)  
  - Google Analytics optional – skip ya enable karo  
  - **Create project** par click karo

---

## Step 3: Authentication section kholo

1. Left sidebar mein **"Build"** ke neeche **"Authentication"** par click karo  
   (Agar pehli baar ho to **"Get started"** par click karo)

---

## Step 4: Sign-in method enable karo

1. **"Sign-in method"** tab par jao (upar)
2. Table mein **"Email/Password"** dikhega
3. **"Email/Password"** row par click karo (ya Edit icon)
4. **"Enable"** toggle ON karo
5. **"Email link (passwordless sign-in)"** optional – OFF rakho (sirf Email/Password chahiye)
6. Neeche **"Save"** par click karo

---

## Step 5: Verify

- **"Email/Password"** ke saamne ab **"Enabled"** likha hoga (green)
- Ab User App mein Login / Sign up sahi se kaam karega

---

## Visual Checklist

| Step | Action | Status |
|------|--------|--------|
| 1 | Firebase Console kholo (console.firebase.google.com) | ☐ |
| 2 | Apna project select karo (ya naya banao) | ☐ |
| 3 | Left sidebar → **Authentication** | ☐ |
| 4 | **Sign-in method** tab | ☐ |
| 5 | **Email/Password** → Enable → Save | ☐ |

---

## Agar error aaye

| Error | Solution |
|-------|----------|
| **operation-not-allowed** | Email/Password Enable nahi hai – Step 4 dobara check karo |
| **invalid-api-key** | `firebase_options.dart` / `google-services.json` sahi project se hai? |
| **network-request-failed** | Internet / firewall check karo |

---

## Optional: Authorized domains (Web)

Agar app **web** par chal rahi hai (e.g. `localhost` ya custom domain):

1. Authentication → **Settings** tab → **Authorized domains**
2. `localhost` pehle se hota hai
3. Custom domain add karna ho to **"Add domain"** se add karo
