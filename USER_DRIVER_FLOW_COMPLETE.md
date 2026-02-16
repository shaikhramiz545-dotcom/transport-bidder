# Complete User & Driver Flow - TBidder Platform

**Date:** 2026-02-14  
**Purpose:** Detailed explanation of what users and drivers see during ride booking

---

## 🚗 **STEP-BY-STEP FLOW**

### **Phase 1: User Books a Ride**

#### **1.1 User Opens App (User App - Home Screen)**

**What User Sees:**
- 🗺️ Google Map showing their current location
- 📍 Two input fields:
  - **Pickup (Origin)**: Green location pin icon
  - **Destination (Drop)**: Red flag icon
- 🎯 "Use Current Location" button for pickup
- 🗺️ "Tap on map to set destination" option

**User Actions:**
1. Enters pickup address (or uses current location)
2. Enters destination address (or taps on map)
3. Taps **"Buscar Vehículo"** (Search Vehicle) button

---

#### **1.2 Route Calculation**

**What Happens:**
- App calls Google Directions API
- Calculates:
  - 📏 **Distance** (e.g., "5.2 km")
  - ⏱️ **Duration** (e.g., "15 mins")
  - 🚦 **Traffic delay** (e.g., "+3 mins")
- Draws route polyline on map (orange line)
- Shows pickup marker (green) and drop marker (red)

---

#### **1.3 Vehicle Selection Panel Appears**

**What User Sees:**

**Top Row - Vehicle Categories (Horizontal Scroll):**
```
🚖 Taxi        🚚 Truck       🏍️ Bike       📦 Delivery    🚑 Ambulance
S/ 12.5        S/ 20.0        S/ 10.4       S/ 11.4        S/ 40.0
```

**User Taps a Category (e.g., Taxi):**

**Second Row - Sub-Vehicles Appear:**
```
🚘 Taxi Std (4)    🚙 Taxi SUV (6)    🚐 Taxi XL (8)    🛣️ Outstation
S/ 12.48           S/ 17.47           S/ 20.80          S/ 15.60
```

**User Selects a Vehicle (e.g., Taxi Std):**

**Bid Price Input Appears:**
```
┌─────────────────────────────────────┐
│ Your Offer                          │
│ ┌─────────────────────────────────┐ │
│ │ 💳 S/ 12.48                     │ │ ← User can edit this
│ └─────────────────────────────────┘ │
│ Drivers will bid on your request   │
└─────────────────────────────────────┘
```

**Special Options (if applicable):**

**For Outstation Rides:**
```
┌─────────────────────────────────────┐
│ Outstation Details                  │
│ 👥 Passengers: [- 1 +]              │
│ 💰 Fare: S/ 3.00 per km             │
│ Comments: [optional text field]     │
│ ☑️ Booking for sending parcel       │
└─────────────────────────────────────┘
```

**For Delivery:**
```
┌─────────────────────────────────────┐
│ Delivery Details                    │
│ 📷 [Add photo (optional)]           │
│ Comments: [optional text field]     │
│ Weight in kg: [optional]            │
└─────────────────────────────────────┘
```

**For Trucks:**
```
┌─────────────────────────────────────┐
│ 🔧 Helper (carga/descarga)          │
│ + S/ 15                             │
│                          [Toggle]   │
└─────────────────────────────────────┘
```

---

#### **1.4 User Confirms Booking**

**User Taps:**
```
┌─────────────────────────────────────┐
│  Find Taxi Std - S/ 12.48          │ ← Big orange button
└─────────────────────────────────────┘
```

**What Happens:**
1. ✅ Profile completeness check (name, phone, email)
2. 🔄 "Please wait, finding your Taxi Std..." overlay appears (4 seconds minimum)
3. 📡 Backend creates ride request in database
4. 🎯 Ride becomes available to nearby drivers

---

### **Phase 2: Driver Receives Request**

#### **2.1 Driver is Online (Driver App - Home Screen)**

**What Driver Sees BEFORE Request:**
- 🗺️ Google Map showing their location (orange car marker 🚗)
- 🟢 **"GO ONLINE"** toggle at top (currently ON)
- 💳 Credits display: "Credits: 150 | Exp: 2026-03-15"
- 📍 Driver's real-time location updating every 10 seconds

**Driver Status:**
- App polls `/api/drivers/requests` every **3 seconds**
- Waiting for ride requests matching their vehicle type
- Location being sent to backend every 10 seconds

---

#### **2.2 Ride Request Arrives**

**🚨 FULL-SCREEN OVERLAY APPEARS WITH SIREN SOUND! 🚨**

**What Driver Sees:**

```
┌─────────────────────────────────────────────────────┐
│              🔔 NEW REQUEST                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 📍 Origin:                                          │
│    Av. Arequipa 1234, Lima                         │
│                                                     │
│ 🚩 Destination:                                     │
│    Plaza San Martin, Lima Centro                   │
│                                                     │
│ 🚦 Traffic delay: +3 mins  |  📏 5.2 km            │
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ 🛣️ Outstation Ride                          │   │ ← If applicable
│ │ Passengers: 2                                │   │
│ │ 📦 Parcel booking                            │   │
│ │ Note: Need to reach airport                  │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ [Placeholder: User Evidence Image/Video]     │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ 👤 ⭐ 4.5                                           │
│                                                     │
│ 💰 User Offer: S/ 12.48                            │
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │     [Mini Map showing route]                 │   │
│ │     Green pin (pickup) → Red pin (drop)      │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ ┌──────┐  ┌──────────┐  ┌──────┐                  │
│ │ACCEPT│  │COUNTER   │  │DECLINE│                 │
│ │      │  │OFFER     │  │       │                 │
│ └──────┘  └──────────┘  └──────┘                  │
└─────────────────────────────────────────────────────┘
```

**Driver Has 3 Options:**

---

#### **2.3 Option A: Driver Accepts**

**Driver Taps "ACCEPT"**

**What Happens:**
1. ✅ Wallet balance check (must have enough credits)
2. 📡 Backend creates bid matching user's price
3. 🔔 Driver sees: "Bid sent! Waiting for user to accept..."
4. 🎯 Driver's bid appears in user's bidding sheet
5. ⏳ Driver app starts polling `/api/drivers/my-bids` every 4 seconds

**If Wallet Insufficient:**
```
┌─────────────────────────────────────┐
│ ⚠️ Low Credit                       │
│                                     │
│ You need at least 13 credits for   │
│ this ride. Current balance: 5       │
│                                     │
│ [OK]  [Recharge Wallet]             │
└─────────────────────────────────────┘
```

---

#### **2.4 Option B: Driver Sends Counter Offer**

**Driver Taps "COUNTER OFFER"**

**Bottom Sheet Appears:**
```
┌─────────────────────────────────────┐
│ Counter Offer                       │
│                                     │
│ S/ 12.48  ← Current user offer      │
│                                     │
│ [+S/ 1.0] [+S/ 2.0] [+S/ 5.0] [+S/ 10.0] │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Send Counter: S/ 14.48          │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Driver Taps "+S/ 2.0":**
- Counter price becomes S/ 14.48
- Driver taps "Send Counter"
- Backend notifies user of counter offer
- User can accept/reject in their app

---

#### **2.5 Option C: Driver Declines**

**Driver Taps "DECLINE"**

**What Happens:**
1. ❌ Ride request disappears
2. 🔇 Siren stops
3. 🚫 This ride ID added to `_declinedRideIds` set
4. 🔄 Driver won't see this request again
5. ⏳ Driver continues waiting for next request

---

### **Phase 3: User Sees Bids (Bidding Sheet)**

#### **3.1 User's Bidding Sheet Opens**

**What User Sees:**

```
┌─────────────────────────────────────────────────────┐
│  🔍 Finding Drivers...                              │
│                                                     │
│  ┌───────────────────────────────────────────┐    │
│  │ Driver: Juan P.        ⭐ 4.8              │    │
│  │ 🚗 Toyota Corolla 2020                     │    │
│  │ 💰 Bid: S/ 12.48       [ACCEPT]            │    │
│  └───────────────────────────────────────────┘    │
│                                                     │
│  ┌───────────────────────────────────────────┐    │
│  │ Driver: Maria L.       ⭐ 4.9              │    │
│  │ 🚗 Hyundai Accent 2021                     │    │
│  │ 💰 Counter: S/ 14.00   [ACCEPT]            │    │
│  └───────────────────────────────────────────┘    │
│                                                     │
│  ┌───────────────────────────────────────────┐    │
│  │ Driver: Carlos R.      ⭐ 4.7              │    │
│  │ 🚗 Nissan Versa 2019                       │    │
│  │ 💰 Bid: S/ 12.48       [ACCEPT]            │    │
│  └───────────────────────────────────────────┘    │
│                                                     │
│  [Cancel Request]                                   │
└─────────────────────────────────────────────────────┘
```

**User Can:**
- ✅ Accept any driver's bid
- ❌ Cancel entire request
- ⏳ Wait for more bids

---

#### **3.2 User Accepts a Driver**

**User Taps "ACCEPT" on Juan P.'s bid**

**What Happens:**
1. ✅ Backend marks Juan's bid as "won"
2. 🔔 Juan's driver app receives notification
3. 📱 Bidding sheet closes for user
4. 🎉 Success dialog appears

---

### **Phase 4: Driver Wins Bid**

#### **4.1 Driver Receives Win Notification**

**Driver's App (Juan):**

**Polling `/api/drivers/my-bids` detects `isWon: true`**

**Dialog Appears:**
```
┌─────────────────────────────────────┐
│ 🎉 Bid Accepted!                    │
│                                     │
│ User accepted your offer!           │
│ Time to pick up the passenger.      │
│                                     │
│ [Let's Go!]                         │
└─────────────────────────────────────┘
```

**Driver Taps "Let's Go!"**

---

#### **4.2 Driver Navigation Begins**

**What Driver Sees:**

```
┌─────────────────────────────────────────────────────┐
│ 🗺️ Map View                                        │
│                                                     │
│ [Map showing:]                                      │
│ - 🚗 Driver's location (orange car, live updates)  │
│ - 📍 Pickup location (green pin)                   │
│ - 🚩 Drop location (red pin)                       │
│ - Orange route line                                 │
│                                                     │
├─────────────────────────────────────────────────────┤
│ 📍 TO PICKUP                                        │
│                                                     │
│ Av. Arequipa 1234, Lima                            │
│ 📏 2.1 km away | ⏱️ 8 mins                         │
│                                                     │
│ 👤 Juan (User)         ⭐ 4.5                      │
│ 📞 [Call User]                                      │
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ I'VE ARRIVED                                 │   │
│ └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Driver's Location:**
- Updates every 5 seconds
- Sent to backend via `/api/rides/{rideId}/driver-location`
- User can see driver approaching in real-time

---

#### **4.3 Driver Arrives at Pickup**

**Driver Taps "I'VE ARRIVED"**

**OTP Dialog Appears:**
```
┌─────────────────────────────────────┐
│ 🔢 User OTP                         │
│                                     │
│ Ask user for their 4-digit OTP      │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [____]                          │ │ ← Driver enters OTP
│ └─────────────────────────────────┘ │
│                                     │
│ [Cancel]  [Start Ride]              │
└─────────────────────────────────────┘
```

**User's App Shows:**
```
┌─────────────────────────────────────┐
│ 🚗 Driver Arrived!                  │
│                                     │
│ Your OTP: 1234                      │
│                                     │
│ Show this to your driver            │
└─────────────────────────────────────┘
```

**Driver Enters OTP "1234" and Taps "Start Ride"**

---

#### **4.4 Ride In Progress**

**What Driver Sees:**

```
┌─────────────────────────────────────────────────────┐
│ 🗺️ Map View                                        │
│                                                     │
│ [Map showing:]                                      │
│ - 🚗 Driver's location (moving)                    │
│ - 🚩 Drop location (red pin)                       │
│ - Orange route line                                 │
│                                                     │
├─────────────────────────────────────────────────────┤
│ 🚩 TO DROP-OFF                                      │
│                                                     │
│ Plaza San Martin, Lima Centro                       │
│ 📏 3.1 km remaining | ⏱️ 12 mins                   │
│                                                     │
│ 💰 Fare: S/ 12.48                                  │
│                                                     │
│ 💬 [Chat with User]                                 │
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ ← Slide to Complete Ride →                  │   │
│ └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**What User Sees:**
```
┌─────────────────────────────────────────────────────┐
│ 🗺️ Map View                                        │
│                                                     │
│ [Map showing:]                                      │
│ - 🚗 Driver's location (live tracking)             │
│ - 🚩 Your destination                              │
│                                                     │
├─────────────────────────────────────────────────────┤
│ 🚗 On the way                                       │
│                                                     │
│ Driver: Juan P.        ⭐ 4.8                      │
│ 🚗 Toyota Corolla - ABC-123                        │
│                                                     │
│ 📏 3.1 km to destination                           │
│ ⏱️ Estimated arrival: 12 mins                      │
│                                                     │
│ 📞 [Call Driver]  💬 [Chat]                        │
└─────────────────────────────────────────────────────┘
```

---

#### **4.5 Ride Completion**

**Driver Arrives at Destination**

**Driver Slides "← Slide to Complete Ride →"**

**What Happens:**
1. ✅ Backend marks ride as "completed"
2. 💳 Credits deducted from driver's wallet
3. 💰 Payment processed
4. ⭐ Rating screens appear for both

**Driver Sees:**
```
┌─────────────────────────────────────┐
│ ✅ Ride Completed!                  │
│                                     │
│ Earnings: S/ 12.48                  │
│ Credits used: 13                    │
│                                     │
│ Rate your passenger:                │
│ ⭐⭐⭐⭐⭐                            │
│                                     │
│ [Submit]                            │
└─────────────────────────────────────┘
```

**User Sees:**
```
┌─────────────────────────────────────┐
│ ✅ Trip Completed!                  │
│                                     │
│ Total: S/ 12.48                     │
│                                     │
│ Rate your driver:                   │
│ ⭐⭐⭐⭐⭐                            │
│                                     │
│ [Submit]                            │
└─────────────────────────────────────┘
```

---

## 🔄 **SUMMARY OF COMPLETE FLOW**

### **User Side:**
1. 📍 Enter pickup & destination
2. 🚗 Select vehicle type
3. 💰 Set bid price
4. 🔍 Wait for driver bids
5. ✅ Accept a driver
6. 🔢 Share OTP with driver
7. 🗺️ Track driver in real-time
8. ✅ Complete ride & rate

### **Driver Side:**
1. 🟢 Go online
2. 🔔 Receive ride request (with siren)
3. ✅ Accept / Counter / Decline
4. ⏳ Wait for user acceptance
5. 🎉 Win bid notification
6. 🗺️ Navigate to pickup
7. 🔢 Enter user's OTP
8. 🚗 Drive to destination
9. ✅ Complete ride & rate

---

## 📊 **KEY TECHNICAL DETAILS**

### **Polling Intervals:**
- Driver requests: Every **3 seconds**
- Driver bids: Every **4 seconds**
- Driver location: Every **5 seconds** (during ride)
- Driver online ping: Every **10 seconds**

### **API Endpoints Used:**
- `/api/drivers/requests` - Get available rides
- `/api/rides/{id}/bid` - Place/update bid
- `/api/rides/{id}/accept` - Accept ride (with wallet check)
- `/api/rides/{id}/counter` - Send counter offer
- `/api/rides/{id}/decline` - Decline ride
- `/api/drivers/my-bids` - Check bid status
- `/api/rides/{id}/driver-location` - Update location
- `/api/rides/{id}/arrived` - Mark arrived
- `/api/rides/{id}/start` - Start ride (OTP validation)
- `/api/rides/{id}/complete` - Complete ride

### **Real-Time Features:**
- ✅ Live driver location tracking
- ✅ Bidding system (InDriver style)
- ✅ OTP verification
- ✅ In-app chat
- ✅ Push notifications
- ✅ Wallet credit system

---

## ⚠️ **IMPORTANT NOTES**

### **Wallet System:**
- Drivers MUST have sufficient credits to accept rides
- Credits are deducted AFTER ride completion
- Low credit = Cannot accept rides
- Expired credits = Cannot accept rides

### **Security:**
- OTP required to start ride (prevents fraud)
- GPS tracking throughout ride
- Activity logs for all actions
- Driver verification required to go online

### **User Experience:**
- Users see multiple driver bids
- Users choose best price/rating
- Real-time driver tracking
- In-app communication

---

**This is the complete flow from user booking to ride completion!**
