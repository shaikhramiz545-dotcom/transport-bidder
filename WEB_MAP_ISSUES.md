# Web Map Issues – Kyun ho raha hai aur kya kiya

## 1. Emoji / colored marker show nahi ho raha (red pin ya black box)

**Kyun:**
- **Flutter Web** par `BitmapDescriptor.defaultMarkerWithHue()` **support nahi hai** – plugin hamesha default (red) pin dikhata hai, hue ignore ho jata hai.
- **Emoji** (🚗, 👨) Canvas/TextPainter se draw karte waqt **web par emoji font nahi milta**, isliye black box ya empty box dikh raha tha.

**Fix (implemented):**  
Colored **circle** draw karke PNG bytes bana rahe hain aur `BitmapDescriptor.fromBytes()` use kar rahe hain – ye web par bhi kaam karta hai.
- **User app:** User location = blue circle (with white border). Driver (when no vehicle selected) = orange circle.
- **Driver app:** Driver location = orange circle (with white border).
Dono apps mein `_bitmapDescriptorFromColoredCircle(Color)` use ho raha hai.

---

## 2. Google button (map type / fullscreen) hide nahi ho raha

**Kyun:**
- Flutter web par Google Map **iframe** (ya HtmlElementView) ke andar load hota hai.
- `index.html` ka CSS **sirf main page** par lagta hai, **iframe ke andar** nahi.
- Isliye `.gm-style-mtc` wagaira selectors iframe ke controls ko hide nahi kar paate.

**Fix:**  
Plugin ke andar se `mapTypeControl: false` / `fullscreenControl: false` pass hone chahiye – abhi Flutter plugin ye options expose nahi karta. Isliye **abhi button hide nahi ho sakta** bina plugin change ke. (Agar chaho to plugin ka source check karke PR bana sakte ho.)

---

## 3. Summary

| Issue              | Reason (web)                          | Fix / status                          |
|--------------------|----------------------------------------|----------------------------------------|
| Emoji = black box  | Web par emoji font render nahi hota   | Colored circle PNG use karenge (done) |
| Hue = red hi dikhe | defaultMarkerWithHue web par support nahi | Colored circle PNG use karenge (done) |
| Button hide nahi   | Map iframe ke andar, CSS bahar ka      | Plugin support chahiye (not possible from app) |
