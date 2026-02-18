# Production-Grade InDriver-Style Bidding System
## Schema, Endpoint Contracts & Architecture

---

## 1. UPDATED SCHEMA

### 1.1 Rides Collection (`rides`)

```javascript
{
  id: string,                    // Firestore auto-generated ID
  
  // Location data
  pickupLat: number,
  pickupLng: number,
  dropLat: number,
  dropLng: number,
  pickupAddress: string,
  dropAddress: string,
  distanceKm: number,
  trafficDelayMins: number,
  
  // Ride configuration
  vehicleType: 'car' | 'moto' | 'van' | 'premium',
  userPrice: number,             // User's offered price (S/)
  
  // Status (strict state machine)
  status: 'pending' | 'accepted' | 'driver_arrived' | 'ride_started' | 'completed' | 'cancelled' | 'expired',
  
  // User info
  userPhone: string | null,
  userRating: number | null,
  userPhotoUrl: string | null,
  
  // Driver assignment (after acceptance)
  driverId: string | null,
  driverPhone: string | null,
  driverName: string | null,
  driverLat: number | null,      // Live position
  driverLng: number | null,
  
  // Bid acceptance tracking
  acceptedBidId: string | null,  // Reference to winning bid
  acceptedPrice: number | null,  // Final agreed price
  otp: string | null,            // 4-digit ride start code
  
  // Outstation fields
  outstationPassengers: number | null,
  outstationComments: string | null,
  outstationIsParcel: boolean,
  
  // Delivery fields
  deliveryComments: string | null,
  deliveryWeight: string | null,
  deliveryPhotoUrl: string | null,
  
  // Timestamps
  createdAt: Timestamp,
  updatedAt: Timestamp,
  // Note: expiresAt is derived from createdAt + RIDE_EXPIRY_MINUTES (30 min default)
}
```

### 1.2 Bids Collection (`bids`)

**Document ID Format**: `bid_{rideId}_{driverId}` (deterministic for unique constraint)

```javascript
{
  id: string,                    // Format: bid_RIDE123_DRV45678
  
  // References
  rideId: string,                // Parent ride
  driverId: string,              // Driver who placed bid
  
  // Driver info (snapshot at bid time)
  driverName: string,
  driverPhone: string | null,
  carModel: string,
  rating: number,
  
  // Bid details
  price: number,                 // Driver's bid price (S/)
  
  // Status (strict state machine enforced)
  status: 'pending' | 'countered' | 'accepted' | 'rejected' | 'expired',
  
  // Negotiation
  userCounterPrice: number | null,  // User's counter-offer (if any)
  
  // Timestamps
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

---

## 2. BID STATE MACHINE

### 2.1 Valid State Transitions

```
                    ┌─────────────┐
                    │   PENDING   │ ◄────────────────┐
                    └──────┬──────┘                  │
                           │                         │
           ┌───────────────┼───────────────┐        │ Driver re-bids
           ▼               ▼               ▼        │ (price change)
    ┌──────────┐    ┌──────────┐    ┌──────────┐   │
    │ ACCEPTED │    │ REJECTED │    │ EXPIRED  │   │
    └──────────┘    └──────────┘    └──────────┘   │
                           ▲                        │
                           │ User counters          │
                    ┌──────┴──────┐                 │
                    │  COUNTERED  │─────────────────┘
                    └─────────────┘
                           │
                           ▼
                    (Driver can accept
                     counter or re-bid)
```

### 2.2 Transition Rules

| From Status | To Status | Allowed By | Condition |
|-------------|-----------|------------|-----------|
| `pending` | `countered` | User | User sends counter-offer |
| `pending` | `accepted` | System | User accepts this bid |
| `pending` | `rejected` | System | Another bid accepted |
| `pending` | `expired` | System | Ride expires |
| `countered` | `pending` | System | Driver re-bids (new price) |
| `countered` | `accepted` | System | User accepts despite counter |
| `countered` | `rejected` | System | Another bid accepted |
| `countered` | `expired` | System | Ride expires |
| `accepted` | * | NONE | Terminal state |
| `rejected` | * | NONE | Terminal state |
| `expired` | * | NONE | Terminal state |

---

## 3. ENDPOINT CONTRACTS

### 3.1 User App Endpoints

#### POST `/api/rides/:id/accept-bid`
**Production-grade transaction-safe bid acceptance**

**Request:**
```json
{
  "bidId": "string"
}
```

**Success Response (200):**
```json
{
  "ok": true,
  "otp": "1234",
  "driverName": "Juan P.",
  "acceptedPrice": 25.50
}
```

**Error Responses:**
- `400` - Ride not in pending state / Bid not acceptable
- `403` - User does not own this ride
- `404` - Ride or bid not found
- `409` - Race condition: another bid already accepted

---

#### POST `/api/rides/:id/user-counter`

**Request:**
```json
{
  "bidId": "string",
  "counterPrice": 20.00
}
```

**Success Response (200):**
```json
{ "ok": true }
```

---

### 3.2 Driver App Endpoints

#### POST `/api/rides/:id/bid`

**Request:**
```json
{
  "driverId": "DRV-12345",
  "driverName": "Carlos M.",
  "carModel": "Toyota Corolla",
  "rating": 4.8,
  "price": 14.50
}
```

**Success Response (201):**
```json
{
  "ok": true,
  "bidId": "bid_ride123_drv12345",
  "action": "created" | "updated"
}
```

#### GET `/api/drivers/:id/bids`

**Query Parameters:**
- `status` (optional): Filter by status

**Success Response (200):**
```json
{
  "bids": [
    {
      "id": "bid_ride123_drv12345",
      "rideId": "ride123",
      "price": 14.50,
      "status": "countered",
      "userCounterPrice": 13.00,
      "ride": {
        "pickupAddress": "Av. Principal 123",
        "dropAddress": "Centro Comercial Plaza",
        "userPrice": 12.00
      }
    }
  ]
}
```

---

## 4. TRANSACTION IMPLEMENTATION

### 4.1 Bid Acceptance Transaction Flow

```
User sends POST /rides/:id/accept-bid
                │
                ▼
    START Firestore Transaction
                │
                ▼
    READ rideRef (with lock)
    Verify ride.status === 'pending'
    If NOT pending -> ABORT
                │
                ▼
    READ acceptedBidRef (with lock)
    Verify bid.status in ['pending', 'countered']
                │
                ▼
    QUERY all bids for this ride
                │
                ▼
    BATCH UPDATE within transaction:
    - rideRef: status='accepted'
    - acceptedBidRef: status='accepted'
    - otherBidRefs: status='rejected'
                │
                ▼
    COMMIT transaction (atomic)
                │
                ▼
    RETURN success with OTP
```

---

## 5. FIRESTORE INDEXING STRATEGY

### Required Composite Indexes

```javascript
// bids: getBidsByRideId sorted by price
{ rideId: ASC, price: ASC }

// bids: getBidsByDriverId sorted by recency
{ driverId: ASC, updatedAt: DESC }

// bids: filter by status + price
{ rideId: ASC, status: ASC, price: ASC }

// rides: expiry job
{ status: ASC, createdAt: ASC }
```

---

## 6. EXPIRY SYSTEM

```javascript
RIDE_EXPIRY_MINUTES = 30  // Via env var

// Cron job every 5 minutes
checkAndExpireRides():
  1. Find pending rides older than threshold
  2. Mark ride.status = 'expired'
  3. Mark all pending/countered bids = 'expired'
```

---

## 7. SCALABILITY TARGET

**50k concurrent rides**

- Firestore: 10k+ writes/second per database
- Transactions: Limited to 500 docs/batch
- Consider sharding if limits approached

---

## 8. ERROR CODES

| Code | Status | Meaning |
|------|--------|---------|
| RIDE_NOT_FOUND | 404 | Ride does not exist |
| RIDE_NOT_PENDING | 400 | Ride already accepted |
| BID_NOT_ACCEPTABLE | 400 | Bid in terminal state |
| INVALID_TRANSITION | 400 | Illegal state change |

