# TBidder — Complete App Flow Documentation

> **Last Updated:** Feb 12, 2026  
> **Apps:** User App (Flutter) + Driver App (Flutter)  
> **Backend:** Node.js + Firestore + PostgreSQL (Sequelize)  
> **Auth:** Backend-managed email+password with ZeptoMail OTP  
> **Firebase:** FCM push notifications + Crashlytics only  

---

## Table of Contents

1. [USER APP — Complete Flow](#user-app--complete-flow)
2. [DRIVER APP — Complete Flow](#driver-app--complete-flow)
3. [Backend API Endpoints Used](#backend-api-endpoints-used)
4. [Shared Services & Architecture](#shared-services--architecture)

---

# USER APP — Complete Flow

## 1. App Startup (`main.dart`)

1. **Flutter binding** initialized
2. **Firebase** initialized (for FCM push + Crashlytics only)
3. **Crashlytics** error handlers registered (FlutterError + PlatformDispatcher)
4. **FCM** background message handler + foreground SnackBar listener registered
5. **FcmService().init()** — gets FCM token, subscribes to topics
6. **Locale** loaded from SharedPreferences (supports: en, es, ru, fr)
7. **AuthGate** widget decides which screen to show:
   - Reads JWT token from `ProfileStorageService.getAuthToken()`
   - **Token exists & non-empty** → `HomeScreen`
   - **No token** → `LoginScreen`

## 2. Authentication Flow

### 2a. Login (`login_screen.dart`)

1. User sees: **App logo**, **Email** field, **Password** field, **Login** button, **Create Account** button, **Forgot password?** link
2. **Biometric login** (fingerprint/face): If previously enabled + stored credentials exist, shows biometric login button above email/password fields
3. **Login flow:**
   - Calls `AuthApi.emailLogin(email, password, role: 'user')` → `POST /api/auth/email-login`
   - **Success (token received):**
     - Saves JWT token, email, name, phone to `ProfileStorageService`
     - First-time: shows biometric prompt dialog ("Add fingerprint for quick login?")
     - Navigates to `HomeScreen` (pushReplacement)
   - **Email not verified** (`code: 'email_not_verified'`):
     - Shows SnackBar with "Resend" button → calls `sendVerificationOtp()`
   - **Failure:** Shows error SnackBar
4. **Biometric login flow:**
   - Retrieves stored email/password from secure storage
   - Authenticates biometric (fingerprint/face)
   - Calls same `emailLogin()` API
   - On success → `HomeScreen`

### 2b. Signup (`signup_screen.dart`)

1. Fields: **Name**, **Email**, **Phone** (with country code picker, default +51 Peru), **Password** (min 6 chars)
2. **Signup flow:**
   - Calls `AuthApi.signup(email, password, name, phone, role: 'user')` → `POST /api/auth/signup`
   - **Success:**
     - Saves name, email, phone to `ProfileStorageService`
     - **If token returned** (dev mode / auto-verified): Goes straight to `HomeScreen`
     - **If no token** (normal flow): Goes to `EmailOtpScreen` for email verification
   - **"Already exists":** Shows dialog with "Go to Login" button
   - **Failure:** Shows error SnackBar

### 2c. Email OTP Verification (`email_otp_screen.dart`)

1. Shows: email icon, "We sent a 6-digit code to: [email]", **OTP input** (6 digits), **Verify** button, **Resend** link
2. **Verify flow:**
   - Calls `AuthApi.verifyEmail(email, otp, role: 'user')` → `POST /api/auth/verify-email`
   - **Success:** Saves token + user info → navigates to `HomeScreen` (removes all previous routes)
3. **Resend:** Calls `AuthApi.sendVerificationOtp()` → `POST /api/auth/send-verification-otp`

### 2d. Reset Password (`reset_password_screen.dart`)

1. **Step 1 — Send OTP:** Enter email → "Send OTP" button
   - Calls `AuthApi.forgotPassword(email, role: 'user')` → `POST /api/auth/forgot-password`
   - On success: transitions to Step 2
2. **Step 2 — Reset:** Enter OTP + New Password + Confirm Password → "Reset Password" button
   - Calls `AuthApi.resetPassword(email, otp, newPassword, role: 'user')` → `POST /api/auth/reset-password`
   - On success: Shows success SnackBar, pops back to login

## 3. Home Screen — Main Map & Booking Flow (`home_screen.dart`)

### 3a. Initial Load

1. **Location check on start:**
   - Checks if GPS service enabled → if not, shows "Enable GPS" dialog
   - Checks/requests location permission
   - Gets current position → saves to SharedPreferences + sets as pickup
   - Centers map camera on user location (Lima, Peru default: -12.0464, -77.0428)
   - Fetches nearby drivers count via `BiddingService.getNearbyDriversCount()` → shows "X taxis available within 3-5 km" banner

2. **Map markers:**
   - **User (passenger):** Male emoji marker (👨) at user's GPS location
   - **Pickup (A):** Vehicle emoji or green pin
   - **Drop (B):** Red location pin
   - **Driver:** Selected vehicle emoji (during ride tracking)

### 3b. Service/Vehicle Selection (Bottom Panel)

**State 1 — Service Selection Overlay** (no route drawn yet):
- Shows category grid: **Taxi** 🚖, **Truck** 🚚, **Bike** 🏍️, **Delivery** 📦, **Ambulance** 🚑, **Attraction** 🎯
- Tapping a category → transitions to search panel (State 2)
- Tapping "Attraction" → navigates to `ToursListScreen`

**State 2 — Search Panel** (half-screen, category selected):
- **Pickup field:** Text input with Google Places autocomplete (worldwide search)
  - "Your current location" shortcut button → gets GPS, reverse geocodes to address
- **Destination field:** Text input with Google Places autocomplete
  - "Tap on map to set destination" option → enters map-tap mode
- **Prediction list:** Shows Google Places predictions, tap to select
- **"Buscar Vehículo"** button → fetches route → draws polyline → transitions to State 3

**State 3 — Vehicle Selector** (route drawn):
- Shows: distance text, duration text, base rate per km
- **Parent categories** (horizontal scroll): Taxi, Truck, Bike, Delivery, Ambulance
  - Each shows emoji + label + estimated fare from cheapest child
- **Sub-vehicles** (if parent has children, horizontal scroll):
  - **Taxi:** Taxi Std, Taxi SUV, Taxi XL, Taxi Outstation
  - **Truck:** Truck S, Truck M, Truck L, Car Hauler
  - **Ambulance:** Amb Basic, Amb ICU
  - **Bike/Delivery:** Single vehicle, auto-selected
- **"Your Offer" input:** Pre-filled with estimated fare, user can modify bid price
- **Outstation details** (if Taxi Outstation selected): Passengers counter, per-km fare, comments, parcel checkbox
- **Delivery details** (if Delivery selected): Photo upload, comments, weight in kg
- **Helper toggle** (for trucks, not delivery): +fee for loading/unloading helper
- **"Find [Vehicle] - S/ [price]"** button → opens bidding sheet

### 3c. Ride Creation & Bidding Flow

1. **Profile check:** Before booking, validates Name/Email/Phone are filled → if not, shows "Go to Profile" dialog
2. **Ride creation:**
   - Shows "Please wait, finding your [vehicle]..." overlay (min 4 seconds)
   - Calls `BiddingService.createRide()` → `POST /api/rides` with:
     - Pickup/drop coordinates + addresses
     - Distance, traffic delay, vehicle type, user price
     - Outstation fields (if taxi outstation)
     - Delivery fields (if delivery)
   - Returns `rideId`
3. **Live Bidding Sheet** (DraggableScrollableSheet):
   - Polls `GET /api/rides/:rideId` every few seconds for bids
   - Displays list of `DriverBid` entries: driver name, car model, rating, price, status
   - **User actions:**
     - **Accept bid:** Calls `POST /api/rides/:rideId/accept-bid` → closes sheet → starts driver tracking
     - **Counter-offer:** User can type a counter price (cosmetic only — no backend endpoint, displayed locally)
     - **Cancel:** Close sheet
   - **Auto-close:** If a driver directly accepts the ride (status changes to 'accepted'), sheet auto-closes

### 3d. Ride Tracking (After Bid Accepted)

1. **"Thank you" dialog:** Shows driver name + ETA
   - Taxi/Moto: "Your driver is on the way"
   - Truck/Ambulance/Delivery: "Driver on the way" with ETA in minutes

2. **OTP Banner** (top of screen):
   - Shows: Lock icon + "Tu OTP: [4-digit code]" in large orange text
   - **Chat button:** Opens chat bottom sheet with driver
   - **Call button:** Launches phone dialer with driver's number

3. **Driver location polling** (every 3 seconds):
   - Calls `BiddingService.getDriverLocation(rideId)` + `BiddingService.getRide(rideId)`
   - Animates driver marker smoothly (1-second interpolation)
   - Monitors ride status changes:
     - **`driver_arrived`:** Shows "Driver arrived" SnackBar (green, once)
     - **`ride_started`:** Shows "Ride started, enjoy!" SnackBar
     - **`completed`:** Stops polling → shows completion dialog

4. **Chat:** Bottom sheet with message list (user/driver bubbles) + text input + send

5. **Ride Complete:**
   - Shows "Thank you, ride complete" dialog
   - Shows rating bottom sheet (5 stars)
   - Resets all ride state

### 3e. Navigation Drawer (Left Side)

- **Profile** → `ProfileScreen` (edit name, email, phone, password, biometric toggle)
- **History** → `HistoryScreen` (past rides)
- **Support** → `SupportScreen` (email: Support@transportbidder.com)
- **Language** → Language selector bottom sheet (EN, ES, RU, FR)
- **Join Us:** "Driver" button (deep link to driver app) + "Agency" button (website link)
- **Logout** → Clears `ProfileStorageService` → navigates to `LoginScreen`

---

# DRIVER APP — Complete Flow

## 1. App Startup (`main.dart`)

1. **Flutter binding** initialized
2. **Firebase** initialized (FCM + Crashlytics)
3. **FCM** background handler + foreground SnackBar listener
4. **FcmService().init()** — gets token, subscribes to driver topics
5. **Locale** loaded (en, es, ru, fr)
6. **AuthGate:** Checks JWT token from `ProfileStorageService`
   - **Token exists** → `HomeScreen`
   - **No token** → `LoginScreen`

## 2. Authentication Flow

### 2a. Login (`login_screen.dart`)

1. **Dark theme.** Shows: App logo + "TransportBidder Driver v2.0.0", Email, Password, **Login** button, **Sign up** button, **Forgot password?** link
2. **Login flow:**
   - Calls `AuthApi.emailLogin(email, password, role: 'driver')` → `POST /api/auth/email-login`
   - **Success:** Saves token, email, name, phone → navigates to `HomeScreen` (pushAndRemoveUntil)
   - **Email not verified:** Shows SnackBar with "Resend" action
   - **Failure:** Error SnackBar

### 2b. Signup (`signup_screen.dart`)

1. Fields: **Full name**, **Mobile number** (with country code picker), **Email**, **Password**
2. **Signup flow:**
   - Calls `AuthApi.signup(email, password, name, phone, role: 'driver')` → `POST /api/auth/signup`
   - **Success + token** (auto-verified): Goes to `HomeScreen`
   - **Success, no token:** Goes to `EmailOtpScreen` (email OTP verification, role: 'driver')
   - **"Already exists":** SnackBar with "Login" action button

### 2c. Email OTP Verification (`email_otp_screen.dart`)

- Same as user app but with driver dark theme
- On verify success → `HomeScreen`

### 2d. Reset Password (`reset_password_screen.dart`)

- Same 2-step flow as user app (Send OTP → Enter OTP + New Password), role: 'driver'

## 3. Home Screen — Driver Dashboard (`home_screen.dart`)

### 3a. Initial Load

1. **Location initialization:**
   - Checks/requests location permission
   - Gets current position (high accuracy) → sets driver marker
   - Centers map on driver location (default: Lima, Peru)
   - Shows "Location always on" popup (one-time) for background tracking

2. **Driver ID resolution:**
   - Loads cached driverId from SharedPreferences
   - Loads phone from `ProfileStorageService`
   - Calls `RideBidService.getVerificationStatusByPhone(phone)` to check driver status
   - Loads cached vehicleType from profile storage
   - Resolves driverId from server via phone mapping (source of truth)
   - Loads vehicle type from server verification-status endpoint

3. **Wallet summary:** Shows "Credits: X | Exp: YYYY-MM-DD" banner below Go Online panel

4. **Daily scratch card:** If available, shows scratch card banner when offline. Auto-popup once per day.

### 3b. Go Online / Go Offline Toggle

**Go Online sequence:**
1. Ensures driverId + phone are loaded
2. Resolves driverId from server
3. **Verification check** (if driver has ID):
   - Fetches `GET /api/drivers/:id/verification-status`
   - **If backend unreachable:** Shows "Server unavailable" dialog → blocks going online
   - **If status is 'pending':** Shows "Complete verification" dialog → link to `VerificationScreen`
   - **If status is 'rejected'/'suspended'/'temp_blocked':** Shows block dialog with reason → link to `VerificationScreen`
   - **If status is 'approved':** Proceeds
4. Requests "always" location permission
5. Starts **location stream** (continuous GPS updates → moves driver marker)
6. Starts **driver location ping** (every 10 seconds):
   - `POST /api/drivers/location` with lat, lng, vehicleType, phone
   - Server adds driver to `onlineDrivers` map
   - If `DriverBlockedException` received: forces offline + shows block dialog
7. Starts **request polling** (every 3 seconds):
   - `GET /api/drivers/requests` → filtered by driver's vehicle type + radius
   - Filters out declined rides and rides already bid on
   - If new request found → plays siren sound → shows incoming request overlay

**Go Offline:**
1. Stops location ping → reports driver offline to server
2. Stops location stream
3. Stops request polling
4. Stops driver location updates (if active ride)
5. Clears incoming request

### 3c. Incoming Ride Request Overlay

When a matching ride request is found:

1. **Full-screen overlay (dark):** Shows:
   - "New Request" title
   - Origin address (green icon)
   - Destination address (red flag icon)
   - Traffic delay (minutes) + Distance (km)
   - **Outstation details** (if present): Passengers, parcel flag, comments
   - **Delivery details** (if present): Weight, comments, photo indicator
   - User bid price (large, prominent)
   - Vehicle label

2. **Driver actions:**
   - **Accept (✓):** Places a bid matching user's price
     - Checks wallet balance first (NO_CREDIT → block, LOW_CREDIT → warning)
     - Calls `RideBidService.acceptBid(rideId, driverId, driverPhone)` → `POST /api/rides/:id/bid`
     - On success: Shows "Bid sent, waiting..." SnackBar → adds to myBidRideIds → starts My Bids polling
   - **Counter Bid (💬):** Opens counter-bid bottom sheet
     - Shows user's price, driver enters counter price
     - Calls `RideBidService.counterBid(rideId, counterPrice, driverPhone)` → `POST /api/rides/:id/counter`
     - Shows "Counter offer sent: S/ X" SnackBar
   - **Decline (✗):** Adds to declined set, stops siren
     - Calls `RideBidService.declineBid(rideId)` → `POST /api/rides/:id/decline`

### 3d. Bid Tracking (My Bids Polling)

After placing a bid, polls `GET /api/drivers/my-bids` every 4 seconds:

- **Bid won:** User accepted our bid → `_handleWonBid()`:
  - Stops bid polling + request polling
  - Fetches ride details
  - Creates `IncomingRequest` from ride data
  - Sets acceptedRideId + acceptedRide + status = 'to_pickup'
  - Starts driver location updates (every 5s, sends GPS to server)
  - Shows "Bid Accepted! Let's go!" dialog

- **Bid lost:** Another driver's bid was accepted
  - Shows "Bid lost" SnackBar
  - Removes from tracked bids

- **Bid pending:** Still waiting → keep polling

### 3e. Active Ride Flow (Accepted Ride Overlay)

Full-screen overlay with 3 phases:

**Phase 1 — "Go to Pickup" (status: `to_pickup`):**
- Shows: "Go to pickup" title, pickup + drop addresses, Google Map with pickup/drop markers + route polyline
- Chat button + Call user button
- **"Arrived" button** → calls `RideBidService.driverArrived(rideId)` → `POST /api/rides/:id/driver-arrived`
  - On success: status → 'arrived' → shows OTP dialog

**Phase 2 — "Ask OTP" (status: `arrived`):**
- **OTP Dialog:** "Ask the user for their 4-digit OTP"
  - Driver enters OTP → calls `RideBidService.startRide(rideId, otp)` → `POST /api/rides/:id/start`
  - **Correct OTP:** status → 'to_drop', shows "Ride started, go to destination" SnackBar
  - **Wrong OTP:** Shows "Wrong OTP" SnackBar → re-shows OTP dialog

**Phase 3 — "Go to Destination" (status: `to_drop`):**
- Shows: "Go to destination" title, map with route to drop location
- Chat + Call buttons
- **"Slide to Complete" button** (swipe gesture):
  - Calls `RideBidService.completeRide(rideId)` → `POST /api/rides/:id/complete`
  - On success:
    - Fetches ride to find accepted bid price
    - Records earnings locally via `EarningsService`
    - Stops driver location updates
    - Clears accepted ride state
    - **Restarts request polling** (so driver receives new rides while still online)
    - Shows "Ride completed, thanks!" SnackBar

### 3f. Driver Location Updates (During Active Ride)

- Every 5 seconds: Gets GPS position → calls `RideBidService.updateDriverLocation(rideId, lat, lng)` → `PUT /api/rides/:id/driver-location`
- This is separate from the 10-second location ping (which reports to onlineDrivers map)

### 3g. Navigation Drawer (Right Side — End Drawer)

`_DriverMenuDrawer` provides:
- **Profile** → `ProfileScreen`
- **Verification** → `VerificationScreen` (document upload)
- **Wallet** → `WalletScreen` (credit balance, recharge, transactions)
- **Scratch Card** → `ScratchCardScreen` (daily scratch-to-win)
- **Earnings** → `EarningsScreen` (ride earnings history)
- **Settings** → `SettingsScreen` (language, support email, etc.)
- **Go Home** → `GoHomeScreen`
- **Logout** → Clears `ProfileStorageService` → `LoginScreen`

### 3h. Verification Flow (`verification_screen.dart`)

Peru driver 3-step wizard:

**Step 1 — Personal Documents:**
- Brevete (front), Brevete (back), DNI, Selfie
- Photo upload from camera/gallery

**Step 2 — Vehicle Documents:**
- SOAT, Tarjeta de propiedad, Foto del vehículo
- Vehicle type + category selection

**Step 3 — Review & Submit:**
- Submits all documents to backend
- Status: pending → admin reviews → approved/rejected/reupload_requested

**Driver cannot go online until status = 'approved'**

### 3i. Blocked/Suspended Overlay

If driver status is 'rejected', 'suspended', or 'temp_blocked':
- Full-screen semi-transparent overlay with block icon
- Shows reason text + support email (Support@transportbidder.com)
- Cannot dismiss — driver must contact support

---

# Backend API Endpoints Used

## Auth (`/api/auth`)
| Method | Endpoint | Used By | Description |
|--------|----------|---------|-------------|
| POST | `/signup` | Both | Create account (email+password+name+phone+role) |
| POST | `/email-login` | Both | Login with email+password |
| POST | `/verify-email` | Both | Verify 6-digit email OTP after signup |
| POST | `/send-verification-otp` | Both | Resend verification OTP |
| POST | `/forgot-password` | Both | Send password reset OTP |
| POST | `/reset-password` | Both | Verify OTP + set new password |

## Rides (`/api/rides`)
| Method | Endpoint | Used By | Description |
|--------|----------|---------|-------------|
| POST | `/` | User | Create ride request |
| GET | `/:id` | Both | Get ride details + bids |
| POST | `/:id/bid` | Driver | Place bid on ride |
| POST | `/:id/accept-bid` | User | Accept a driver's bid |
| POST | `/:id/counter` | Driver | Counter-bid with different price |
| POST | `/:id/decline` | Driver | Decline ride (records as bid price=0) |
| POST | `/:id/driver-arrived` | Driver | Mark driver arrived at pickup |
| POST | `/:id/start` | Driver | Start ride (verify OTP) |
| POST | `/:id/complete` | Driver | Complete ride |
| PUT | `/:id/driver-location` | Driver | Update driver GPS during ride |
| GET | `/:id/driver-location` | User | Poll driver location |
| POST | `/:id/message` | Both | Send chat message |

## Drivers (`/api/drivers`)
| Method | Endpoint | Used By | Description |
|--------|----------|---------|-------------|
| POST | `/location` | Driver | Report driver online + GPS (every 10s) |
| DELETE | `/location/:id` | Driver | Report driver offline |
| GET | `/requests` | Driver | Poll available ride requests (filtered by vehicle type + radius) |
| GET | `/nearby` | User | Get nearby driver count |
| GET | `/my-bids` | Driver | Poll driver's active bids |
| GET | `/:id/verification-status` | Driver | Get verification status + vehicle type |

---

# Shared Services & Architecture

## User App Services
| Service | File | Purpose |
|---------|------|---------|
| `AuthApi` | `core/auth_api.dart` | All auth API calls |
| `ProfileStorageService` | `services/profile_storage_service.dart` | JWT token, name, email, phone (SharedPreferences) |
| `BiddingService` | `services/bidding_service.dart` | Create ride, poll bids, accept bid, driver location, chat |
| `PlacesService` | `services/places_service.dart` | Google Places autocomplete + details |
| `DirectionsService` | `services/directions_service.dart` | Google Directions API (route polyline) |
| `FareService` | `services/fare_service.dart` | Fare calculation per vehicle type |
| `BiometricService` | `services/biometric_service.dart` | Fingerprint/Face ID login |
| `FcmService` | `services/fcm_service.dart` | Firebase Cloud Messaging |

## Driver App Services
| Service | File | Purpose |
|---------|------|---------|
| `AuthApi` | `core/auth_api.dart` | All auth API calls (role='driver') |
| `ProfileStorageService` | `services/profile_storage_service.dart` | JWT token, name, email, phone, vehicleType |
| `RideBidService` | `services/ride_bid_service.dart` | Report location, poll requests, bid, accept, counter, start, complete |
| `LocationService` | `services/location_service.dart` | Continuous GPS location stream |
| `EarningsService` | `services/earnings_service.dart` | Local ride earnings tracking |
| `WalletApi` | `services/wallet_api.dart` | Wallet balance, recharge, scratch card |
| `DriverNotificationService` | `services/driver_notification_service.dart` | Siren sound for incoming requests |
| `FcmService` | `services/fcm_service.dart` | Firebase Cloud Messaging |

## Vehicle Types & Radius Rules
| Vehicle Type | Category | Matching Radius |
|-------------|----------|----------------|
| taxi_std, taxi_suv, taxi_xl, taxi_outstation | taxi | 6 km |
| truck_s, truck_m, truck_l | truck | 25 km |
| car_hauler | truck | 25 km |
| moto | bike | 5 km |
| amb_basic, amb_icu | ambulance | 15 km |
| delivery | van | 10 km |

## Fare Calculation
- Base rate per km × vehicle multiplier × distance
- Traffic delay surcharge
- Helper fee (trucks only, optional)
- Outstation: per-km rate with multiplier

## Localization
- **Supported languages:** English (en), Spanish (es), Russian (ru), French (fr)
- **Default:** Spanish (Peru market)
- Translation via `AppLocaleScope` + `translate()` function
- Language saved in SharedPreferences

---

## Visual Flow Summary

### User App Journey:
```
Login/Signup → Email OTP → HomeScreen (Map)
  → Select Category (Taxi/Truck/Bike/Delivery/Ambulance)
    → Enter Pickup + Destination → "Buscar Vehículo" (draws route)
      → Select Sub-vehicle → Set Bid Price → "Find [Vehicle]"
        → Profile Check → Create Ride → Searching Overlay (4s)
          → Live Bidding Sheet (polls bids)
            → Accept Bid → "Thank you" Dialog
              → OTP Banner + Driver Tracking (3s polls)
                → Driver Arrived notification
                  → Ride Started notification
                    → Ride Completed → Rating → Back to Home
```

### Driver App Journey:
```
Login/Signup → Email OTP → HomeScreen (Map, Dark Theme)
  → Go Online (verification check + location permission)
    → Location Ping (10s) + Request Polling (3s)
      → Incoming Request Overlay (siren sound)
        → Accept/Counter/Decline
          → [Accept] → Bid Sent → My Bids Polling (4s)
            → Bid Won → "Let's Go!" Dialog
              → Drive to Pickup (location updates 5s)
                → "Arrived" → OTP Dialog
                  → Verify OTP → "Ride Started"
                    → Drive to Destination
                      → "Slide to Complete" → Earnings Recorded
                        → Back to Request Polling (still online)
```
