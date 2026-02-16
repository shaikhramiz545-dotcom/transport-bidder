# Backend connectivity report: Flutter app ↔ http://10.0.2.2:4000

## 1. All network calls

| Service / file | Method | URL | Uses backend? | Timeout |
|----------------|--------|-----|--------------|---------|
| **PlacesService** | GET | `kApiBaseUrl/api/places/autocomplete?input=...&sessiontoken=...` | ✅ Yes | 15 s |
| **PlacesService** | GET | `kApiBaseUrl/api/places/details?place_id=...` | ✅ Yes | 15 s |
| **AuthApi** | POST | `kApiBaseUrl/api/auth/login` | ✅ Yes | **None** |
| **AuthApi** | POST | `kApiBaseUrl/api/auth/verify` | ✅ Yes | **None** |
| **DirectionsService** | GET | `https://maps.googleapis.com/maps/api/directions/json?...` | ❌ No (Google) | 15 s |
| **BiddingService** | — | Mock only, no HTTP | ❌ No | — |

**Base URL (`kApiBaseUrl`):**
- **Android (api_config_io):** `http://10.0.2.2:4000`
- **iOS / desktop (api_config_io):** `http://127.0.0.1:4000`
- **Web (api_config_stub):** `http://localhost:4000`

So **only Places and Auth** hit your backend; Directions goes straight to Google.

---

## 2. Their responses

### PlacesService — autocomplete

- **Success:** `statusCode == 200`, `status == 'OK'` or `'ZERO_RESULTS'` → returns `List<Map<String, dynamic>>` (predictions).
- **Non-200:** returns `[]`.
- **API status not OK:** returns `[]`, logs `[PlacesService] Autocomplete API status: $status`.
- **Exception (timeout, connection refused, etc.):** `catch (_) { return []; }` — **no log of error**, UI sees empty list.

### PlacesService — details

- **Success:** `statusCode == 200`, `status == 'OK'`, has `result.geometry.location` → returns `(lat, lng)`.
- **Non-200 / not OK / missing geometry:** returns `null`.
- **Exception:** logs `[PlacesService] Details error: $e`, returns `null`.

### AuthApi — login

- **Any response:** parses body as JSON, returns `LoginResponse(success, message, otp)`.
- **No timeout:** if backend is unreachable, request can hang until OS timeout (long).
- **Exception (connection refused, etc.):** **uncaught** — propagates to caller; app can crash or show generic error.

### AuthApi — verify

- Same as login: no timeout, no try/catch; errors propagate.

### DirectionsService

- **Success:** `statusCode == 200`, `status == 'OK'`, has `routes[0].overview_polyline.points` → returns `DirectionsResult`.
- **Non-200 / not OK / no routes:** returns `null`, logs status/body.
- **Timeout:** logs `[DirectionsService] ERROR: Request timeout`, throws.

---

## 3. Failures and timeouts

| Call | Timeout | On failure / timeout |
|------|---------|----------------------|
| Places autocomplete | 15 s | Returns `[]`; exception swallowed (no error log in catch). |
| Places details | 15 s | Returns `null`; exception logged. |
| Auth login | **None** | Can hang; exception not caught. |
| Auth verify | **None** | Can hang; exception not caught. |
| Directions | 15 s | Throws on timeout; returns `null` on bad response. |

**Typical failures when backend is unreachable:**
- **Connection refused** (backend not running or wrong host/port): Places return empty/null; Auth can hang or throw.
- **Timeout:** Places return empty after 15 s; Auth has no timeout so can hang much longer.
- **Cleartext:** Android allows it via `usesCleartextTraffic="true"`; no issue for `http://10.0.2.2:4000`.

---

## 4. Emulator vs real device

| Context | kApiBaseUrl (Android) | Can reach backend? |
|---------|----------------------|--------------------|
| **Android emulator** | `http://10.0.2.2:4000` | ✅ Yes — `10.0.2.2` is the host machine’s loopback from the emulator. |
| **Physical Android device** | `http://10.0.2.2:4000` | ❌ **No** — `10.0.2.2` is only meaningful inside the emulator. On a real device it’s just another IP and not your PC. |

So:
- **Emulator:** App can connect to backend at `http://10.0.2.2:4000` if the backend is running on the same PC.
- **Real device:** App **cannot** connect with the current config; you must use your PC’s **LAN IP** (e.g. `http://192.168.1.5:4000`) and ensure firewall allows port 4000.

**iOS Simulator:** Uses `127.0.0.1:4000` (same machine), so it works like Web/localhost.

---

## 5. How to fix connectivity issues

### A. Ensure backend is running and listening

1. Start backend: `cd backend && npm start` (or your start command).
2. Confirm log: `API listening on http://localhost:4000`.
3. In browser on PC: open `http://localhost:4000/health` → should return JSON with `ok: true`.

If the server never prints “listening on 4000”, fix DB/startup first (e.g. DB sync failure prevents `listen(4000)`).

### B. Real device: use your PC’s IP

- **Option 1 (quick):** In `api_config_io.dart`, for Android use your PC’s LAN IP, e.g. `http://192.168.1.5:4000` (replace with your IP). Find it: `ipconfig` (Windows) or `ifconfig`/`ip a` (Mac/Linux).
- **Option 2 (better):** Add an override (e.g. build flavor or env) so you can set base URL per build without editing code. See “Optional: configurable base URL” below.
- **Firewall:** Allow inbound TCP port 4000 on your PC so the phone can connect.

### C. Add timeouts and error handling to Auth

- Auth currently has **no timeout**; add e.g. 15 s and catch exceptions so login/verify don’t hang and the user sees a clear message. (See code changes below.)

### D. Verify from the app (optional)

- Call `GET kApiBaseUrl/health` with a short timeout (e.g. 5 s). If it succeeds, backend is reachable; if it fails, show “Cannot reach server” and optionally retry. A small `BackendHealthService` can do this.

### E. Use debug logs

- Run the app and watch console for:
  - `[PlacesService] Autocomplete URL: ...` → confirms URL (e.g. `http://10.0.2.2:4000/...`).
  - `[PlacesService] Autocomplete Status: ...` → 200 = backend reached; 0 or exception = unreachable/timeout.
- If you see `Connection refused` or timeout in stack traces, the app is trying the right host but the backend is not reachable (not running, wrong IP, or firewall).

---

## Optional: configurable base URL (real device)

To avoid hardcoding your PC’s IP in source, you can:

- **Real device:** run with a compile-time override so the app uses your PC's IP:
  ```bash
  flutter run --dart-define=BACKEND_URL=http://192.168.1.5:4000
  ```
  Replace `192.168.1.5` with your PC's LAN IP. Implemented in `api_config_io.dart` via `String.fromEnvironment('BACKEND_URL', defaultValue: '')`.
- **Backend health check:** use `BackendHealthService` (in `lib/services/backend_health_service.dart`) to verify connectivity:
  ```dart
  final health = BackendHealthService();
  if (!await health.check()) { /* show "Cannot reach server" */ }
  ```
  Or `health.checkWithMessage()` for a short debug message.
- **Auth:** `AuthApi.login` and `AuthApi.verify` now have a 15s timeout and return a clear message on failure.
