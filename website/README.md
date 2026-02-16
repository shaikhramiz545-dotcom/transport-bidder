# Transportbidder – Static Website

SEO-friendly static landing page for Transportbidder (passengers & drivers).

## Contents

- **index.html** – Single-page site: Hero, Features, Products, Reviews, Blog, Download (Android/iOS), Contact, Footer
- **styles.css** – Poppins, brand colors (#FDFBF7, #FF5F00), animations
- **script.js** – Mobile menu, scroll animations, contact form (static)
- **robots.txt** – Allow all, sitemap URL
- **sitemap.xml** – Homepage URL for SEO

## Before going live

1. **App store links**  
   In `index.html`, replace:
   - `https://play.google.com/store/apps` → your Google Play app URL  
   - `https://apps.apple.com/app` → your App Store app URL  

2. **Domain**  
   In `robots.txt` and `sitemap.xml`, replace `https://transportbidder.com` with your real domain.

3. **Contact**  
   Update email, phone, address and social links in the Contact section and in the JSON-LD block at the bottom of `index.html`.

4. **Optional**  
   Add a favicon and OG image; point the contact form to your backend if you have one.

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
npx serve website
# or
python -m http.server 8080
# then open http://localhost:8080 (after cd website if needed)
```

## Hosting

Upload the contents of `website/` to any static host (Netlify, Vercel, GitHub Pages, S3, etc.). No build step required.
