# Phase 5A — Before/After Screenshot Guide

Use these to capture before/after (or after-only) for the Driver App UX changes.

---

## 1. Wallet Screen

| # | Description | What to capture |
|---|-------------|-----------------|
| 1 | **Balance primary** | Top of Wallet: large balance number (48pt), "Current Balance (Credits)" below, expiry row, **Recharge Now** button. |
| 2 | **Expiry warning (&lt;7 days)** | Same screen with credits valid until in 3–6 days: orange "Expires in X days" or "Expires soon" with warning icon. |
| 3 | **Transaction list** | List of recharge requests: one Pending, one Approved, one Needs PDF; amount in S/ and date visible; clear status badges. |

---

## 2. Verification Screen

| # | Description | What to capture |
|---|-------------|-----------------|
| 4 | **Status + subtitle** | Status card with "Pending review" and subtitle "We're reviewing your documents." (or "Reupload required" / "Fix the issue and resubmit" for rejected). |
| 5 | **Reupload highlight** | Step 1 or 2 with at least one doc card that has **orange border** and "Reupload requested" badge. |
| 6 | **Step transition** | Optional: short screen recording of switching between steps (fade + slide). |

---

## 3. Home Screen (Offline)

| # | Description | What to capture |
|---|-------------|-----------------|
| 7 | **Offline shortcuts** | Map with **You are offline** panel and, below it, the bar: "Can't go online? Check documents or wallet." and **Documents** \| **Wallet** buttons. |

---

## 4. Ride Error Dialogs

| # | Description | What to capture |
|---|-------------|-----------------|
| 8 | **NO_CREDIT** | Dialog title "No credits", message about recharging, **Recharge now** button. |
| 9 | **LOW_CREDIT** | Dialog title "Insufficient credits", message, **Recharge now** button. |
| 10 | **EXPIRED** | Dialog title "Credits expired", message, **Recharge now** button. |

---

## How to trigger

- **Wallet expiry warning:** Use a test driver whose `creditsValidUntil` is 3–7 days from today (or mock in UI for screenshot).
- **Reupload:** Admin requests reupload for specific doc types; open Verification as that driver.
- **Ride error dialogs:** Try to accept a ride with zero/low balance or expired credits (backend returns 403 with code).
- **Offline shortcuts:** Go to Home, ensure toggle is Off, capture the panel + shortcut bar.
