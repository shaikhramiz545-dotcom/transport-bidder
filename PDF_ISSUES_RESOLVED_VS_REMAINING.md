# PDF "Issues and Error" – Resolved vs Bache (Remaining)

**Source:** `issues and error.pdf` (Driver app + Admin panel)  
**Date:** 2026-02-06

---

## DRIVER APP

| # | Issue (PDF se) | Status | Note |
|---|----------------|--------|------|
| 1 | Chrome mein server refresh par auto logout | ✅ **RESOLVED** | `main.dart`: saved phone check se refresh par auto logout nahi hota |
| 2 | Email/OTP ke baad password option nahi; dubara OTP maang raha hai | ⏳ **BACHE** | Login flow – password step / OTP retry logic check karni padegi |
| 3 | OTP dalne ke baad apne aap verify nahi, button click padta hai | ✅ **RESOLVED** | `otp_screen.dart`: OTP length complete hote hi auto-verify |
| 4 | Floating button remove karo; nahi to hamburger mein add karo | ✅ **RESOLVED** | Home pe koi FAB nahi; sirf menu (hamburger). User confirmed. |
| 5 | Verification pending = yellow, verified = hide (sirf map), decline = red; apply form "become our partner" | ✅ **RESOLVED** | Pending = read-only panel; approved = welcome + map; rejected = red/block screen |
| 6 | Hamburger line visible ke liye black karo | ⏳ **BACHE** | Drawer/icon color abhi change nahi kiya |
| 7 | Profile tab mein driver info do option remove; verification par same; verify ke baad edit nahi | ✅ **RESOLVED** | User confirmed. Profile/Verification flow align. |
| 8 | Features niche se upar shift; profile upar; download statement; earning tab bhi same | ⏳ **BACHE** | Layout reorder + download statement options |
| 9 | Wallet ka name "Add credit" karo | ✅ **RESOLVED** | User confirmed. (Drawer label l10n mein "Add credit" chahiye to `drawer_wallet` change karo.) |
| 10 | Document aur Verification same options; document tab remove karo | ✅ **RESOLVED** | Drawer mein sirf "Verification" hai; alag Documents tab nahi. User confirmed. |
| 11 | Go home wala same rehne do | ✅ N/A | Koi change zaroori nahi |
| 12 | Settings mein sirf notification; commission remove | ⏳ **BACHE** | Commission option remove karna baaki |
| 13 | Help center: Email support@transportbidder.com, WhatsApp – settings ke niche | ✅ **RESOLVED** | Settings screen: Help Center item, Email + WhatsApp (support@transportbidder.com). User confirmed. |
| 14 | Kisi tab se bahar aane par main tab ki jagah sidha bahar aa raha hai | ⏳ **BACHE** | Navigation: exit par main tab pe aana chahiye |
| 15 | Document upload ke baad Pending show chahiye; ab "again upload" option dikh raha tha | ✅ **RESOLVED** | Pending + no reupload → upload lock; "Submitted" / under review message |
| 16 | Daily winning card / Tarjeta diaria – scratch card show nahi ho raha | ✅ **RESOLVED** | Scratch card + once-per-day popup (aaj scratch kiya ya nahi) implement hai |
| 17 | *(PDF mein khali)* | — | — |
| 18 | Recharge page par credit dikh raha hai, lekin (main) tab mein nahi | ⏳ **BACHE** | Main tab/drawer mein credit bhi dikhana hai (Recharge ke sath sath) |
| 19 | Profile page par information save karke button nahi hai | ⏳ **BACHE** | Profile par Save button add karna |
| 20 | Backend start par admin panel mein same vehicle ki 2 pending dikh rahi thi | ✅ **RESOLVED** | Duplicate driver ID fix; ab sirf 1 request; approve ke baad verified |
| 21 | Location popup late aa raha hai; Windows popup ke baad in-app popup | ⏳ **BACHE** | Permission flow: Windows vs in-app timing / duplicate popup |
| 22 | Admin se block ke baad bhi driver verification page open ho raha tha | ✅ **RESOLVED** | Block/suspend par verification UI block; customer care contact message |
| 23 | Dark mode / Light mode ke liye new tab | ⏳ **BACHE** | Theme toggle (Dark/Light) add karna |
| 24 | Server restart par Earning mode on karte error (doc upload, verified hone ke baad bhi) | ✅ **RESOLVED** | Driver ID recovery + "pending" ko wrong treat nahi karna; verified = direct earning |
| 25 | *(PDF mein khali)* | — | — |

---

## ADMIN PANEL

| # | Issue (PDF se) | Status | Note |
|---|----------------|--------|------|
| 1 | Bina upload kiye 2 pending request; sirf 1 dikni chahiye | ✅ **RESOLVED** | Duplicate row/ID fix; ek hi request; approve ke baad app par welcome |
| 2 | Approve ke baad bhi documents upload ka option show ho raha tha | ✅ **RESOLVED** | Welcome message + approved par upload option hide |
| 3 | Approve ke baad panel mein total driver / active driver show nahi ho rahe | ✅ **RESOLVED** | Dashboard: Total Drivers + Active Drivers stats (stats API se). User confirmed. |
| 4 | Finance par notification; screenshot bada nahi ho raha (recharge click) | ✅ **RESOLVED** | Finance: pending alert on page; screenshot link (open in new tab). User confirmed. |
| 5 | Drivers ki full info nahi; photo nahi; edit button nahi | ✅ **RESOLVED** | Drivers page: photo, name, rating; DriverDetail: full info, photo, rating. User confirmed. |
| 6 | Approve/Reject/Temp block ke sath Reinitiate button chahiye | ✅ **RESOLVED** | Verification Hub mein temp_block/suspend par "Reinitiate" button hai |
| 7 | Reject ke baad driver app par same screen; block + message chahiye | ✅ **RESOLVED** | Rejected par app screen block + "We are sorry we can't approve..." + (email optional) |
| 8 | Approve/Suspend/Reject/Block par driver ko notification; block/suspend par screen freeze | ✅ **RESOLVED** | User confirmed. In-app block overlay + contact message. |
| 9 | Control panel mein log history nahi (kisne kya kiya) | ⏳ **BACHE** | Audit / action log implement karna |
| 10 | Sub user (manager) banane ka option + konsa user kya dekh sakta hai | ✅ **RESOLVED** | Admin Users page: create user, role, module permissions (Finance, Drivers, Bookings, etc.) |
| 11 | Dispatcher tab – create ride manually abhi hold; second phase mein launch | ✅ **NOTED** | Hold par; second phase |
| 12 | Finance tab par koi information nahi (recharge history, kisne approve kiya) | ✅ **RESOLVED** | Finance page ab wallet-transactions list, approve/decline, filters se chal rahi hai |
| 13 | Driver ki photo, name, rating show nahi ho rahi | ✅ **RESOLVED** | Drivers.jsx / DriverDetail: photoUrl, driverName, rating. User confirmed. |
| 14 | *(PDF mein khali)* | — | — |

---

## Summary (PDF ke hisaab se)

| Category | Resolved | Bache (remaining) | N/A / Noted |
|----------|----------|-------------------|-------------|
| **Driver app (1–25)** | **14** | **9** | 2 (11, 17, 25) |
| **Admin panel (1–14)** | **11** | **1** | 1 (11 hold) |
| **Total** | **25** | **10** | 3 |

*(Updated: Driver 4,7,9,10,13 aur Admin 3,4,5,8,13 user confirmation + code check se RESOLVED mark kiye.)*

---

## Bache issues – short list (priority order mein nahi)

**Driver app:**  
2, 6, 8, 12, 14, 18, 19, 21, 23  

**Admin panel:**  
9 (log history)  

Agar PDF mein koi point galat map hua ho ya koi fix add ho chuka ho to bata dena, list update kar dunga.
