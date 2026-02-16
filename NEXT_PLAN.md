# TBidder – Next Plan (Phase 2 & beyond)

**UI/UX:** Complete  
**Ab kya:** Core ride logic, stability, aur real data.

---

## Phase 2 – Core Ride & Stability

| # | Task | Status | Notes |
|---|------|--------|--------|
| 1 | **Backend: Admin settings persist** – Control panel Settings (commission %, notifications) ko DB mein save karo; GET/POST /api/admin/settings read/write. | Done | AdminSettings model (key=global); GET/POST persist. |
| 2 | **Backend: Ride state validation** – start-ride sirf jab status = driver_arrived; complete sirf jab ride_started. | Done | driver-arrived → accepted; start-ride → driver_arrived; complete → ride_started. |
| 3 | **E2E test checklist** – TESTING_STEPS.md mein ek full ride flow + control panel verify steps add karo. | Done | Full ride B1–B10 + Control panel C + Phase 1 D. |
| 4 | **OTP validation (optional)** – Backend pe ride start ke waqt OTP match (agar user app OTP bheje). | Pending | Abhi mock / skip. |
| 5 | **Push notifications (later)** – New request driver ko, status user ko. | Pending | FCM / APNs baad mein. |

---

## Phase 3 (baad mein)

| # | Task | Notes |
|---|------|--------|
| 1 | Real SMS OTP | Auth production-ready |
| 2 | Finance: recharge requests | User wallet recharge → admin approve → credit |
| 3 | Agencies: fleet owners | CRUD + drivers link |
| 4 | Driver verification: document/360° upload | Storage + admin view |

---

## Current focus

**Done:** Task 1 (Admin settings persist), Task 2 (Ride state validation), Task 3 (E2E test checklist).  
**Next:** Task 4 (OTP validation) ya Task 5 (Push notifications).
