# Phase 3: Driver Wallet & Manual Recharge — Wireframes & Image Prompts

**Scope:** Prepaid credits (1 Sol = 20 credits), manual bank/QR recharge, admin approval. No auth, tours, or ride-dispatch changes.

---

## 1) Driver App — Wallet Screen

### Wireframe (ASCII)

```
┌─────────────────────────────────────────────────────────┐
│  ← Wallet                                    [Refresh]   │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐   │
│  │  Current credits                                 │   │
│  │           420                                    │   │
│  │  Valid until: 15 Mar 2026                        │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ⚠ Low credits — top up to accept more rides.           │  (if balance < typical fare)
│  ┌─────────────────────────────────────────────────┐   │
│  │  Recharge                                        │   │
│  │  ┌──────────────┐                               │   │
│  │  │   [QR CODE]   │   Bank details                │   │
│  │  │   (scan to    │   Banco de Crédito del Perú   │   │
│  │  │    pay)       │   CCI: 002-193-...            │   │
│  │  └──────────────┘   [Copy]                       │   │
│  │                                                    │   │
│  │  Verify payment                                    │   │
│  │  Amount (S/)    [________]                        │   │
│  │  Transaction ID [________]                        │   │
│  │  Screenshot     [Upload] [preview]                │   │
│  │  [ Submit ]                                        │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  History                                                 │
│  ┌─────────────────────────────────────────────────┐   │
│  │  +200 credits   S/10.00   Approved  6 Feb 2025  │   │
│  │  S/5.00         Pending   —          5 Feb 2025  │   │
│  │  S/20.00        Declined  —          4 Feb 2025   │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**When credits = 0:** Show full-width CTA: "You have no credits. Recharge to accept rides." with button → Wallet recharge section.

---

### Image prompt — Driver Wallet screen (mobile)

**Prompt for UI mockup:**

- Mobile app screen, dark theme (dark grey background #1A1A1A).
- Top: card with large number "420" in orange (#FF5F00), label "Current credits", below it "Valid until: 15 Mar 2026" in grey.
- Below: optional warning strip in amber — "Low credits — top up to accept more rides."
- Recharge section: white/dark card containing (1) a square QR code placeholder on the left, (2) right side: "Bank details" with bank name and CCI/cuenta, (3) a "Copy" button, (4) form title "Verify payment", (5) fields: Amount (S/), Transaction ID, Screenshot upload with thumbnail, (6) orange "Submit" button.
- History section: title "History", then list of rows: credit change (+200), amount (S/10.00), status badge (Approved = green, Pending = orange, Declined = red), date.
- Accent color: neon orange (#FF5F00). Typography: clean sans-serif (e.g. Poppins).

---

## 2) Admin Panel — Driver Payments (List)

### Wireframe (ASCII)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  Driver Payments                                                                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  [Status: All ▼]  [Date: Any ▼]  [Driver: ________]  [Export CSV] [Export Excel]    │
├──────┬──────────┬────────┬──────────┬────────────┬──────────┬──────────────────────┤
│Driver│ Amount   │ Credits│ Txn ID   │ Status     │ Date     │ Actions               │
├──────┼──────────┼────────┼──────────┼────────────┼──────────┼──────────────────────┤
│ d-123│ 10.00    │ 200    │ TX-abc.. │ Pending    │ 6 Feb 25 │ [View] [Approve] [⋮]  │
│ d-456│ 20.00    │ 400    │ TX-def.. │ Approved   │ 5 Feb 25 │ [View]               │
└──────┴──────────┴────────┴──────────┴────────────┴──────────┴──────────────────────┘
```

---

### Image prompt — Admin Driver Payments list (desktop)

**Prompt for UI mockup:**

- Desktop dashboard: cream/off-white background (#F5F5DC), header "Driver Payments".
- Toolbar: dropdown "Status: All", dropdown "Date: Any", search "Driver", buttons "Export CSV", "Export Excel".
- Table: columns Driver, Amount, Credits, Txn ID, Status, Date, Actions. Rows with driver ID, amount in S/, credits, truncated transaction ID, status badge (Pending = orange, Approved = green, Declined = red, Needs PDF = grey), formatted date, action buttons (View, Approve, menu).
- Accent: orange (#FF5F00) for primary actions. Clean table with subtle borders.

---

## 3) Admin Panel — Driver Payments (Detail / Modal)

### Wireframe (ASCII)

```
┌─────────────────────────────────────────────────────────────────┐
│  Recharge request #42                                    [×]     │
├─────────────────────────────────────────────────────────────────┤
│  Driver: d-abc123 (Juan Pérez)                                  │
│  Amount: S/ 10.00    Credits: 200    Txn ID: TX-xyz-789         │
│  Date: 6 Feb 2025                                                │
├─────────────────────────────────────────────────────────────────┤
│  Screenshot                                                      │
│  ┌─────────────────────────┐   Bank info (for reference)       │
│  │                           │   Banco de Crédito del Perú       │
│  │   [IMAGE PREVIEW]         │   CCI: 002-193-...                │
│  │                           │                                   │
│  └─────────────────────────┘                                    │
├─────────────────────────────────────────────────────────────────┤
│  [ Approve ]  [ Reject ]  [ Mark Needs PDF ]                     │
└─────────────────────────────────────────────────────────────────┘

Reject modal:
  Reason (required): [________________________]
  [ Cancel ]  [ Reject ]
```

---

### Image prompt — Admin payment detail modal

**Prompt for UI mockup:**

- Modal overlay on dashboard: white card, rounded corners, shadow.
- Header: "Recharge request #42" and close (×).
- Body: driver line (ID + name), amount and credits and transaction ID, date; then row with screenshot thumbnail (left) and bank info text (right); then action buttons: green Approve, red Reject, grey Mark Needs PDF.
- Reject: secondary modal with "Reason (required)", textarea, Cancel and Reject buttons.

---

## 4) Driver App — Booking blocked (low / no credit)

### Wireframe (ASCII)

```
┌─────────────────────────────────────────────────────────┐
│  Cannot accept ride                                      │
│  You don't have enough credits for this trip.            │
│  Your balance: 5 credits. Estimated fare: 80 credits.    │
│  [ Recharge in Wallet ]                                  │
└─────────────────────────────────────────────────────────┘
```

- When balance = 0: "You have no credits. Recharge to accept rides." + CTA "Recharge in Wallet".
- When balance < fare: "Insufficient credits. You need X more. Recharge in Wallet."

---

## Implementation order (after wireframes approved)

1. **Backend** — WalletLedger table + model; lastRechargeAt (DriverWallet), approvedAt (WalletTransactions); ledger write on approve; booking check (balance + expiry); expiry cron; fraud (3 rejected → temp block); logs.
2. **Admin** — Driver Payments: filters (status, date, driver), export CSV/Excel, detail view/modal (screenshot, bank info, Approve / Reject / Needs PDF), reject mandatory reason.
3. **Driver app** — Wallet: QR + bank copy, "Verify Payment" form, expiry in header, history last 20, low/zero credit warnings and "Recharge" CTA; on accept ride check → LOW_CREDIT / NO_CREDIT / EXPIRED dialog with link to Wallet.
4. **Tests** — Wallet API and booking check where possible.
5. **Docs** — WALLET_RULES.md, CHANGELOG.md, API_STATUS.md.

---

**Next step:** Proceed with implementation in the order above (Backend → Admin → Driver → Tests → Docs) unless you request changes to the wireframes first.
