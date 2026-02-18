# Phase 5A — Driver App UX & UI Changelog

**Goal:** Improve clarity, speed, and confidence for drivers. No backend or API changes.

---

## 1. Wallet Screen

### Before
- Balance and label "Current Balance (Credits)" with similar visual weight.
- Expiry shown as grey text: "Credits valid for 1 year... Expiry: YYYY-MM-DD".
- No primary CTA above the fold.
- Transaction list: compact rows, no amount in S/, no "Needs PDF" status.

### After
- **Balance is the primary visual:** Large 48pt number at top, "Current Balance (Credits)" as subtitle. Card has stronger border and soft glow.
- **Expiry with warning:** 
  - &gt;7 days: neutral grey, "Expires in X days".
  - &lt;7 days: **warning color (orange)** + icon, "Expires soon" or "Expires in X days".
  - Expired: **red** + icon, "Expired on DD/MM/YYYY".
- **Strong "Recharge Now" CTA:** Prominent button below balance that scrolls to the Verify Payment form.
- **Transaction list:** 
  - More padding and spacing; amount in S/ shown; status badge includes **Needs PDF** (amber).
  - Clearer hierarchy: credits bold, amount and date secondary.

**Screenshots to capture:** Wallet with balance card + Recharge Now; wallet with &lt;7 days expiry (orange); transaction list with mixed statuses.

---

## 2. Verification Flow

### Before
- Status card at top with icon + label; reupload box when applicable.
- Step indicator: 1 | 2 | 3 with no animation.
- Doc cards: "Reupload requested" chip; no strong visual for which docs need reupload.
- Pending vs Reupload vs Rejected not clearly distinguished in copy.

### After
- **Status always visible:** Same card at top; added **subtitles** per state:
  - **Pending (no reupload):** "We're reviewing your documents."
  - **Pending (reupload):** "Please re-upload the documents below." (orange)
  - **Rejected:** "Fix the issue and resubmit." (red)
- **Reupload highlight:** Docs that need reupload have **orange border (2px)** and elevation; reupload box label "Reupload required" with upload icon.
- **Step transitions:** **AnimatedSwitcher** (fade + slight slide) when changing steps.
- **Copy:** Clear separation between Pending review, Reupload required, and Rejected.

**Screenshots to capture:** Status card with each subtitle; doc card with reupload border; step change animation (optional video).

---

## 3. Ride Error UX (Accept blocked)

### Before
- Single generic dialog: title "You can't go online", message body, buttons "OK" and "Recharge".

### After
- **Dedicated dialogs by code:**
  - **NO_CREDIT:** Title "No credits", server message, primary button **"Recharge now"** → Wallet.
  - **LOW_CREDIT:** Title "Insufficient credits", message, **"Recharge now"** → Wallet.
  - **EXPIRED:** Title "Credits expired", message, **"Recharge now"** → Wallet.
- Each dialog: **clear reason** (title + body) and **single next action** (Recharge now).

**Screenshots to capture:** Each of the three dialogs (NO_CREDIT, LOW_CREDIT, EXPIRED).

---

## 4. Home Screen (Offline)

### Before
- Go Online panel only; when blocked, dialog appears on toggle.

### After
- **When offline:** Shortcut bar below the panel:
  - Hint: "Can't go online? Check documents or wallet."
  - Two buttons: **Documents** (→ Verification), **Wallet** (→ Wallet).
- Drivers can fix verification or wallet without having to tap Go Online first.

**Screenshots to capture:** Home map with offline panel + shortcut bar (Documents | Wallet).

---

## Design system (unchanged)

- **Colors:** `AppTheme.darkBg`, `AppTheme.neonOrange`, `AppTheme.surfaceDark`, `AppTheme.onDark`.
- **Typography:** Google Fonts Poppins.
- **No new dependencies.** UI-only changes.

---

## Files touched

| File | Changes |
|------|---------|
| `driver_app/lib/features/wallet/wallet_screen.dart` | Balance primary, expiry row with warning, Recharge Now CTA, scroll-to-form, transaction list (needs_pdf, amount, spacing) |
| `driver_app/lib/features/verification/verification_screen.dart` | Status subtitles, reupload box/card highlight, AnimatedSwitcher for steps |
| `driver_app/lib/features/home/home_screen.dart` | _OfflineShortcuts widget, _showCreditWarningDialog by code (NO_CREDIT/LOW_CREDIT/EXPIRED), Recharge now CTA |
| `driver_app/lib/l10n/app_locale.dart` | New keys: wallet_status_needs_pdf, wallet_recharge_now, wallet_expires_*, ride_error_*_title, ride_error_recharge_cta, home_fix_*, home_offline_hint, verification_status_*_subtitle |

---

## List of improved components

1. **WalletScreen** — Balance card, expiry row, Recharge Now button, transaction list items.
2. **VerificationScreen** — Status card (with subtitles), reupload box, _uploadCard (reupload border), step content (AnimatedSwitcher).
3. **HomeScreen** — _OfflineShortcuts (hint + Documents/Wallet buttons), _showCreditWarningDialog (code-based title + Recharge now).

---

## Before/After screenshot checklist

- [ ] Wallet: balance as primary + Recharge Now
- [ ] Wallet: expiry &lt;7 days (orange warning)
- [ ] Wallet: transaction list (pending, approved, needs_pdf)
- [ ] Verification: status card with "Reupload required" subtitle
- [ ] Verification: doc card with orange reupload border
- [ ] Home: offline panel + Documents | Wallet shortcuts
- [ ] Ride error: NO_CREDIT dialog
- [ ] Ride error: LOW_CREDIT dialog
- [ ] Ride error: EXPIRED dialog
