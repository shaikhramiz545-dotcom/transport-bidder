# Resolved vs Remaining — Issues Match Report

**Note:** PDF project folder mein nahi mili; main PDF files open nahi kar sakta. Ye report conversation + BUGS.md, FIXES.md, DIAGNOSIS, SOLUTION_ANALYSIS ke hisaab se banayi hai. Agar tumhari PDF mein alag list hai to uski copy yahan paste karo ya PDF ko project folder mein rakho.

---

## 1. CURRENT PRODUCTION ISSUES (jo tumne doc mein diye the)

| # | Issue | Status | Fix applied |
|---|--------|--------|--------------|
| 1 | **Upload allowed when status = Pending** (documents under review par bhi upload) | ✅ RESOLVED | Backend: POST /documents pe guard (pending + no reupload → 400 UNDER_REVIEW). App: upload disabled, "Your documents are under review" message. |
| 2 | **Admin approved but driver still sees Pending** | ✅ RESOLVED | Backend: approve par reuploadDocumentTypes/reuploadMessage null. App: status fetch on open/resume, pending→approved welcome dialog. |
| 3 | **Recharge shown on Pending screen** (Wallet CTA when not approved) | ✅ RESOLVED | Home: _OfflineShortcuts me canRecharge = (status == approved). Pending pe "Complete verification first", Wallet button hide. |
| 4 | **Map zooms when drawer scrolls** | ✅ RESOLVED | Home: onEndDrawerChanged, GoogleMap gestures = !_isEndDrawerOpen. |

---

## 2. DRIVER ID & PENDING (diagnosis wale)

| # | Issue | Status | Fix applied |
|---|--------|--------|--------------|
| 5 | **Har app open par nayi ID / nayi pending request** | ✅ RESOLVED | Verification: _ensureDriverId() ab POST /location call nahi karti jab prefs empty. "Please go online first" screen. ID sirf Home → Go Online se. |
| 6 | **App mein Driver ID nahi dikh rahi** (drawer) | ✅ RESOLVED | Drawer open par _loadDriverId() call; Driver ID card drawer me; "Go online to get ID" jab ID na ho. |
| 7 | **Panel me purani ID / bahut saari IDs** | ⚪ NOT A BUG | Panel shows DB rows; purani rows = purani IDs. Duplicate rows ab banne band (fix 5). |

---

## 3. PHASE 4 / TESTING (BUGS.md / FIXES.md)

| # | Issue | Status |
|---|--------|--------|
| 8 | Postman test script JSON parse on failed response | ✅ RESOLVED (FIX-001) |

---

## 4. SUMMARY

| Category | Resolved | Remaining |
|----------|----------|-----------|
| Production issues (1–4) | 4 | 0 |
| Driver ID & Pending (5–7) | 2 (+ 1 not-a-bug) | 0 |
| Phase 4 test artifact | 1 | 0 |
| **Total (as per above list)** | **7** | **0** |

---

## 5. Agar PDF mein aur issues hain

Agar tumhari PDF mein koi aur point/error list hai to:
- Unka list yahan paste karo, ya
- PDF ko project folder me copy karke naam bata do (main PDF read nahi kar sakta, lekin tum list nikaal kar de sakte ho).

Phir main unhe bhi "Resolved" / "Remaining" me map kar dunga.

---
*Report date: 2026-02-06*
