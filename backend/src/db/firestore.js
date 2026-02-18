/**
 * Firestore as backend DB – replaces PostgreSQL/Sequelize.
 * Requires FIREBASE_SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS.
 */
const { getFirestore } = require('../services/firebase-admin');
const admin = require('firebase-admin');

const COL = {
  users: 'users',
  user_app_emails: 'user_app_emails',
  driver_app_emails: 'driver_app_emails',
  driver_fcm_tokens: 'driver_fcm_tokens',
  password_reset_otp: 'password_reset_otp',
  rides: 'rides',
  bids: 'bids',
  messages: 'messages',
  driver_wallets: 'driver_wallets',
  driver_verifications: 'driver_verifications',
  admin_settings: 'admin_settings',
  feature_flags: 'feature_flags',
  travel_agencies: 'travel_agencies',
  tours: 'tours',
  tour_pax_options: 'tour_pax_options',
  tour_slots: 'tour_slots',
  tour_bookings: 'tour_bookings',
  agency_wallets: 'agency_wallets',
  agency_payout_requests: 'agency_payout_requests',
  wallet_transactions: 'wallet_transactions',
  agency_documents: 'agency_documents',
  tour_reviews: 'tour_reviews',
};

// Production-grade bid state machine
const BID_STATUS = {
  PENDING: 'pending',
  COUNTERED: 'countered',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
};

// Valid bid state transitions
const BID_TRANSITIONS = {
  [BID_STATUS.PENDING]: [BID_STATUS.COUNTERED, BID_STATUS.ACCEPTED, BID_STATUS.REJECTED, BID_STATUS.EXPIRED],
  [BID_STATUS.COUNTERED]: [BID_STATUS.PENDING, BID_STATUS.ACCEPTED, BID_STATUS.REJECTED, BID_STATUS.EXPIRED],
  [BID_STATUS.ACCEPTED]: [], // terminal state
  [BID_STATUS.REJECTED]: [], // terminal state
  [BID_STATUS.EXPIRED]: [], // terminal state
};

/** Generate deterministic bid document ID for unique constraint enforcement.
 * Format: bid_{rideId}_{driverId}
 * This ensures exactly one bid per (rideId + driverId) combination.
 */
function generateBidId(rideId, driverId) {
  if (!rideId || !driverId) return null;
  // Sanitize IDs to ensure valid Firestore document IDs
  const sanitizedRideId = String(rideId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const sanitizedDriverId = String(driverId).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `bid_${sanitizedRideId}_${sanitizedDriverId}`;
}

// Ride status constants
const RIDE_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DRIVER_ARRIVED: 'driver_arrived',
  RIDE_STARTED: 'ride_started',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
};

// Ride expiry configuration (minutes)
const RIDE_EXPIRY_MINUTES = parseInt(process.env.RIDE_EXPIRY_MINUTES || '30', 10);

function getDb() {
  return getFirestore();
}

function _ts() {
  return new Date();
}

function _docToObject(snap) {
  if (!snap || !snap.exists) return null;
  const d = snap.data();
  return { id: snap.id, ...d, createdAt: d.createdAt?.toDate?.() || d.createdAt, updatedAt: d.updatedAt?.toDate?.() || d.updatedAt };
}

function _stableDriverIdFromPhone(phone) {
  // SECURITY FIX: Use SHA-256 hash of full phone digits to prevent ID collisions.
  // Old code used only last 5 digits → only 100K possible IDs → catastrophic collisions.
  // New code: SHA-256(full_digits) → first 12 hex chars → 281 trillion possible IDs.
  const crypto = require('crypto');
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits || digits.length < 7) {
    // Fallback: cryptographically random ID for invalid/short phone numbers
    return `DRV-${crypto.randomBytes(6).toString('hex')}`;
  }
  const hash = crypto.createHash('sha256').update(digits).digest('hex');
  return `DRV-${hash.slice(0, 12)}`;
}

/**
 * Validate bid state transition (production-grade state machine).
 * @throws Error if transition is invalid
 */
function _validateBidStateTransition(currentStatus, newStatus) {
  const current = currentStatus || BID_STATUS.PENDING;
  if (!BID_TRANSITIONS[current]) {
    throw new Error(`Invalid current bid status: ${current}`);
  }
  if (!BID_TRANSITIONS[current].includes(newStatus)) {
    throw new Error(`Invalid bid transition: ${current} -> ${newStatus}`);
  }
}

// ---------- Health ----------
async function healthCheck() {
  try {
    const db = getDb();
    if (!db) return false;
    const snap = await db.collection(COL.users).limit(1).get();
    return true;
  } catch (err) {
    return false;
  }
}

// ---------- Users (auth: phone, role, rating) ----------
async function getUserByPhone(phone) {
  const db = getDb();
  if (!db) return null;
  const snap = await db.collection(COL.users).where('phone', '==', phone).limit(1).get();
  if (snap.empty) return null;
  return _docToObject(snap.docs[0]);
}

async function upsertUserByPhone(phone, role) {
  const db = getDb();
  if (!db) return null;
  const existing = await getUserByPhone(phone);
  const now = _ts();
  if (existing) {
    // Backfill stable driverId for existing drivers if missing.
    if (role === 'driver' && (!existing.driverId || String(existing.driverId).trim().length === 0)) {
      const driverId = _stableDriverIdFromPhone(phone);
      await db.collection(COL.users).doc(existing.id).update({ role, driverId, updatedAt: now });
      return { id: existing.id, phone, role, rating: existing.rating ?? 0, driverId };
    }
    await db.collection(COL.users).doc(existing.id).update({ role, updatedAt: now });
    return { id: existing.id, phone, role, rating: existing.rating ?? 0, driverId: existing.driverId };
  }
  // Generate stable Driver ID for new driver signups.
  const driverId = role === 'driver' ? _stableDriverIdFromPhone(phone) : null;
  const ref = await db.collection(COL.users).add({
    phone,
    role,
    rating: 0,
    driverId,
    createdAt: now,
    updatedAt: now,
  });
  return { id: ref.id, phone, role, rating: 0, driverId };
}

// ---------- user_app_emails / driver_app_emails ----------
async function setUserAppEmail(phone, email) {
  const db = getDb();
  if (!db) return;
  await db.collection(COL.user_app_emails).doc(phone).set({ phone, email, updatedAt: _ts() }, { merge: true });
}

async function setDriverAppEmail(phone, email) {
  const db = getDb();
  if (!db) return;
  await db.collection(COL.driver_app_emails).doc(phone).set({ phone, email, updatedAt: _ts() }, { merge: true });
}

// ---------- Driver FCM tokens ----------
async function upsertDriverFcmToken({ phone, driverId, token, platform }) {
  const db = getDb();
  if (!db) return;
  const p = (phone && typeof phone === 'string') ? phone.trim() : '';
  const d = (driverId && typeof driverId === 'string') ? driverId.trim() : '';
  const t = (token && typeof token === 'string') ? token.trim() : '';
  if (!t) return;
  const docId = p || d;
  if (!docId) return;
  await db.collection(COL.driver_fcm_tokens).doc(docId).set({
    phone: p || null,
    driverId: d || null,
    token: t,
    platform: platform || null,
    updatedAt: _ts(),
  }, { merge: true });
}

async function listDriverFcmTokens({ limit = 500 } = {}) {
  const db = getDb();
  if (!db) return [];
  const snap = await db.collection(COL.driver_fcm_tokens).orderBy('updatedAt', 'desc').limit(Math.min(limit, 1000)).get();
  return snap.docs.map((d) => {
    const x = d.data() || {};
    return {
      id: d.id,
      phone: x.phone || null,
      driverId: x.driverId || null,
      token: x.token || null,
      platform: x.platform || null,
      updatedAt: x.updatedAt?.toDate?.() || x.updatedAt,
    };
  }).filter((r) => r.token);
}

async function getUserAppEmailByPhone(phone) {
  const db = getDb();
  if (!db) return null;
  const snap = await db.collection(COL.user_app_emails).doc(phone).get();
  return snap.exists ? snap.data()?.email : null;
}

async function getDriverAppEmailByPhone(phone) {
  const db = getDb();
  if (!db) return null;
  const snap = await db.collection(COL.driver_app_emails).doc(phone).get();
  return snap.exists ? snap.data()?.email : null;
}

// Bug fix: reverse lookup – get driver phone from linked email (needed for email login).
async function getDriverPhoneByEmail(email) {
  const db = getDb();
  if (!db) return null;
  const trimmed = (typeof email === 'string' ? email.trim() : '').toLowerCase();
  if (!trimmed) return null;
  const snap = await db.collection(COL.driver_app_emails)
    .where('email', '==', trimmed)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].data()?.phone || null;
}

// ---------- password_reset_otp (email/phone as key, scope, otp, expires_at) ----------
async function insertPasswordResetOtp(emailOrPhone, otp, scope, expiresAt) {
  const db = getDb();
  if (!db) return null;
  const ref = await db.collection(COL.password_reset_otp).add({
    email: emailOrPhone,
    otp,
    scope,
    expires_at: expiresAt,
    created_at: _ts(),
  });
  return ref.id;
}

async function findLatestPasswordResetOtp(emailOrPhone, scope) {
  const db = getDb();
  if (!db) return null;
  const now = _ts();
  const snap = await db.collection(COL.password_reset_otp)
    .where('email', '==', emailOrPhone)
    .where('scope', '==', scope)
    .orderBy('created_at', 'desc')
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const d = doc.data();
  const expiresAt = d.expires_at?.toDate?.() || d.expires_at;
  if (expiresAt && new Date(expiresAt) <= now) return null;
  return { id: doc.id, otp: d.otp };
}

async function deletePasswordResetOtp(id) {
  const db = getDb();
  if (!db) return;
  await db.collection(COL.password_reset_otp).doc(id).delete();
}

// ---------- Rides ----------
function _rideToJson(doc) {
  const d = doc.data();
  const id = doc.id;
  return {
    id,
    pickupLat: d.pickupLat,
    pickupLng: d.pickupLng,
    dropLat: d.dropLat,
    dropLng: d.dropLng,
    pickupAddress: d.pickupAddress || '',
    dropAddress: d.dropAddress || '',
    distanceKm: d.distanceKm ?? 0,
    trafficDelayMins: d.trafficDelayMins ?? 0,
    vehicleType: d.vehicleType || 'car',
    userPrice: d.userPrice ?? 0,
    status: d.status || 'pending',
    userPhone: d.userPhone,
    driverPhone: d.driverPhone,
    driverId: d.driverId,
    userRating: d.userRating,
    userPhotoUrl: d.userPhotoUrl,
    counterPrice: d.counterPrice,
    acceptedBidId: d.acceptedBidId || null,
    otp: d.otp,
    driverLat: d.driverLat,
    driverLng: d.driverLng,
    // Outstation fields
    outstationPassengers: d.outstationPassengers ?? null,
    outstationComments: d.outstationComments || null,
    outstationIsParcel: d.outstationIsParcel ?? false,
    // Delivery fields
    deliveryComments: d.deliveryComments || null,
    deliveryWeight: d.deliveryWeight || null,
    deliveryPhotoUrl: d.deliveryPhotoUrl || null,
    createdAt: d.createdAt?.toDate?.() || d.createdAt,
    updatedAt: d.updatedAt?.toDate?.() || d.updatedAt,
  };
}

async function createRide(data) {
  const db = getDb();
  if (!db) throw new Error('Firestore not configured');

  // Single-active-ride enforcement: prevent duplicate rides per user.
  // Check if user already has a pending/accepted/driver_arrived/ride_started ride.
  const userPhone = data.userPhone || null;
  if (userPhone) {
    const activeStatuses = [RIDE_STATUS.PENDING, RIDE_STATUS.ACCEPTED, RIDE_STATUS.DRIVER_ARRIVED, RIDE_STATUS.RIDE_STARTED];
    const existingSnap = await db.collection(COL.rides)
      .where('userPhone', '==', userPhone)
      .where('status', 'in', activeStatuses)
      .limit(1)
      .get();
    if (!existingSnap.empty) {
      const existingRide = existingSnap.docs[0];
      const existingData = existingRide.data();
      // Auto-expire stale pending rides older than RIDE_EXPIRY_MINUTES
      if (existingData.status === RIDE_STATUS.PENDING) {
        const createdAt = existingData.createdAt?.toDate?.() || existingData.createdAt;
        const ageMs = Date.now() - new Date(createdAt).getTime();
        if (ageMs > RIDE_EXPIRY_MINUTES * 60 * 1000) {
          // Stale pending ride — expire it and allow new ride creation
          try { await expireRideAndBids(existingRide.id); } catch (_) {}
        } else {
          throw new Error('ACTIVE_RIDE_EXISTS:' + existingRide.id);
        }
      } else {
        throw new Error('ACTIVE_RIDE_EXISTS:' + existingRide.id);
      }
    }
  }

  const now = _ts();
  const doc = {
    pickupLat: data.pickupLat,
    pickupLng: data.pickupLng,
    dropLat: data.dropLat,
    dropLng: data.dropLng,
    pickupAddress: data.pickupAddress || '',
    dropAddress: data.dropAddress || '',
    distanceKm: data.distanceKm ?? 0,
    trafficDelayMins: data.trafficDelayMins ?? 0,
    vehicleType: data.vehicleType || 'car',
    userPrice: data.userPrice ?? 0,
    userPhone: userPhone,
    userRating: data.userRating ?? null,
    userPhotoUrl: data.userPhotoUrl || null,
    // Outstation fields
    outstationPassengers: data.outstationPassengers ?? null,
    outstationComments: data.outstationComments || null,
    outstationIsParcel: data.outstationIsParcel ?? false,
    // Delivery fields
    deliveryComments: data.deliveryComments || null,
    deliveryWeight: data.deliveryWeight || null,
    deliveryPhotoUrl: data.deliveryPhotoUrl || null,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
  const ref = await db.collection(COL.rides).add(doc);
  return ref.id;
}

async function getRideById(id) {
  const db = getDb();
  if (!db) return null;
  const snap = await db.collection(COL.rides).doc(id).get();
  if (!snap.exists) return null;
  return _rideToJson(snap);
}

async function updateRide(id, updates) {
  const db = getDb();
  if (!db) throw new Error('Firestore not configured');
  await db.collection(COL.rides).doc(id).update({ ...updates, updatedAt: _ts() });
}

async function listRides({ status, userPhone, from, to, limit = 50 }) {
  const db = getDb();
  if (!db) return [];
  const maxFetch = 500;
  let q = db.collection(COL.rides).orderBy('createdAt', 'desc').limit(maxFetch);
  const snap = await q.get();
  let list = snap.docs.map((d) => {
    const data = d.data();
    const createdAt = data.createdAt?.toDate?.() || data.createdAt;
    return {
      id: d.id,
      pickupAddress: data.pickupAddress,
      dropAddress: data.dropAddress,
      pickupLat: data.pickupLat,
      pickupLng: data.pickupLng,
      dropLat: data.dropLat,
      dropLng: data.dropLng,
      vehicleType: data.vehicleType,
      userPrice: data.userPrice,
      counterPrice: data.counterPrice,
      status: data.status,
      userPhone: data.userPhone,
      distanceKm: data.distanceKm,
      trafficDelayMins: data.trafficDelayMins,
      userRating: data.userRating,
      userPhotoUrl: data.userPhotoUrl,
      // Outstation fields
      outstationPassengers: data.outstationPassengers ?? null,
      outstationComments: data.outstationComments || null,
      outstationIsParcel: data.outstationIsParcel ?? false,
      // Delivery fields
      deliveryComments: data.deliveryComments || null,
      deliveryWeight: data.deliveryWeight || null,
      deliveryPhotoUrl: data.deliveryPhotoUrl || null,
      createdAt,
    };
  });
  if (status) list = list.filter((r) => r.status === status);
  if (userPhone) list = list.filter((r) => r.userPhone === userPhone);
  if (from) {
    const fromDate = new Date(from + 'T00:00:00.000Z');
    list = list.filter((r) => r.createdAt && new Date(r.createdAt) >= fromDate);
  }
  if (to) {
    const toDate = new Date(to + 'T23:59:59.999Z');
    list = list.filter((r) => r.createdAt && new Date(r.createdAt) <= toDate);
  }
  return list.slice(0, Math.min(limit, 100));
}

// ---------- Bids (Production-Grade) ----------

/**
 * Production-grade: Transaction-based bid upsert with deterministic ID.
 * Enforces exactly one bid per (rideId + driverId) combination.
 * Uses Firestore transaction for atomicity and race condition prevention.
 */
async function upsertBid(rideId, { driverId, driverName, driverPhone, carModel, rating, price }) {
  const db = getDb();
  if (!db) throw new Error('Firestore not configured');
  if (!driverId) throw new Error('driverId required for bid upsert');
  if (!rideId) throw new Error('rideId required for bid upsert');

  const bidId = generateBidId(rideId, driverId);
  const bidRef = db.collection(COL.bids).doc(bidId);
  const now = _ts();

  return await db.runTransaction(async (transaction) => {
    const bidDoc = await transaction.get(bidRef);
    const existing = bidDoc.exists ? bidDoc.data() : null;

    if (existing) {
      // Validate state transition - can only update if not in terminal state
      const currentStatus = existing.status || BID_STATUS.PENDING;
      if (currentStatus === BID_STATUS.ACCEPTED || currentStatus === BID_STATUS.REJECTED || currentStatus === BID_STATUS.EXPIRED) {
        throw new Error(`Cannot modify bid in ${currentStatus} state`);
      }

      // Update existing bid (driver is re-bidding)
      const updates = {
        price: price ?? existing.price,
        driverName: driverName || existing.driverName,
        driverPhone: driverPhone || existing.driverPhone,
        carModel: carModel || existing.carModel,
        rating: rating ?? existing.rating,
        status: BID_STATUS.PENDING, // Reset to pending on new bid
        userCounterPrice: null, // Clear any previous counter
        updatedAt: now,
      };
      transaction.update(bidRef, updates);
      return { bidId, action: 'updated', previousStatus: currentStatus };
    } else {
      // Create new bid with deterministic ID
      const newBid = {
        rideId,
        driverId,
        driverName: driverName || 'Driver',
        driverPhone: driverPhone || null,
        carModel: carModel || 'Auto',
        rating: rating ?? 4.5,
        price: price ?? 0,
        status: BID_STATUS.PENDING,
        userCounterPrice: null,
        createdAt: now,
        updatedAt: now,
      };
      const rideRef = db.collection(COL.rides).doc(rideId);
      transaction.set(bidRef, newBid);
      transaction.update(rideRef, {
        bidIds: admin.firestore.FieldValue.arrayUnion(bidId),
      });
      return { bidId, action: 'created' };
    }
  });
}

/**
 * Production-grade: Update bid with state machine validation.
 * Validates that the requested state transition is legal.
 */
async function updateBidById(bidId, updates) {
  const db = getDb();
  if (!db) throw new Error('Firestore not configured');

  const bidRef = db.collection(COL.bids).doc(bidId);

  return await db.runTransaction(async (transaction) => {
    const bidDoc = await transaction.get(bidRef);
    if (!bidDoc.exists) throw new Error('Bid not found');

    const existing = bidDoc.data();
    const currentStatus = existing.status || BID_STATUS.PENDING;

    // Validate state transition if status is being updated
    if (updates.status && updates.status !== currentStatus) {
      const allowed = BID_TRANSITIONS[currentStatus] || [];
      if (!allowed.includes(updates.status)) {
        throw new Error(`Invalid bid transition: ${currentStatus} -> ${updates.status}`);
      }
    }

    updates.updatedAt = _ts();
    transaction.update(bidRef, updates);
    return { bidId, previousStatus: currentStatus, newStatus: updates.status || currentStatus };
  });
}

/**
 * Production-grade: Get bids by ride ID, sorted by price ASC (lowest first).
 * Optimized for performance - only returns active bids by default.
 */
async function getBidsByRideId(rideId, { includeInactive = false } = {}) {
  const db = getDb();
  if (!db) return [];

  let query = db.collection(COL.bids)
    .where('rideId', '==', rideId)
    .where('price', '>', 0); // Exclude declined bids (price=0)

  if (!includeInactive) {
    // Only return bids that can still be acted upon
    query = query.where('status', 'in', [BID_STATUS.PENDING, BID_STATUS.COUNTERED]);
  }

  const snap = await query.get();
  const list = snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      rideId: x.rideId,
      driverId: x.driverId,
      driverName: x.driverName || 'Driver',
      driverPhone: x.driverPhone,
      carModel: x.carModel || 'Auto',
      rating: x.rating ?? 4.5,
      price: x.price ?? 0,
      status: x.status || BID_STATUS.PENDING,
      userCounterPrice: x.userCounterPrice ?? null,
      createdAt: x.createdAt?.toDate?.() || x.createdAt,
      updatedAt: x.updatedAt?.toDate?.() || x.updatedAt || null,
    };
  });

  // Sort by price ASC (lowest bid first) - this is what users want to see
  list.sort((a, b) => a.price - b.price);
  return list;
}

/**
 * Production-grade: Get all bids for a driver across all rides.
 * Driver-focused endpoint for the driver app.
 */
async function getBidsByDriverId(driverId, { status, limit = 50 } = {}) {
  const db = getDb();
  if (!db) return [];

  let query = db.collection(COL.bids)
    .where('driverId', '==', driverId)
    .where('price', '>', 0)
    .orderBy('updatedAt', 'desc')
    .limit(Math.min(limit, 100));

  if (status) {
    query = query.where('status', '==', status);
  }

  const snap = await query.get();
  const list = snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      rideId: x.rideId,
      driverId: x.driverId,
      driverName: x.driverName || 'Driver',
      driverPhone: x.driverPhone,
      carModel: x.carModel || 'Auto',
      rating: x.rating ?? 4.5,
      price: x.price ?? 0,
      status: x.status || BID_STATUS.PENDING,
      userCounterPrice: x.userCounterPrice ?? null,
      createdAt: x.createdAt?.toDate?.() || x.createdAt,
      updatedAt: x.updatedAt?.toDate?.() || x.updatedAt || null,
    };
  });

  return list;
}

/**
 * Production-grade: Accept a bid in a strict transaction.
 * - Validates ride is still pending
 * - Marks accepted bid as accepted
 * - Marks all other bids as rejected
 * - Sets ride status to accepted
 * Prevents race conditions completely.
 */
async function acceptBidTransaction(rideId, bidId, { driverId, driverPhone, driverName, acceptedPrice }) {
  const db = getDb();
  if (!db) throw new Error('Firestore not configured');

  const rideRef = db.collection(COL.rides).doc(rideId);
  const acceptedBidRef = db.collection(COL.bids).doc(bidId);

  return await db.runTransaction(async (transaction) => {
    // 1. Verify ride is still pending
    const rideDoc = await transaction.get(rideRef);
    if (!rideDoc.exists) throw new Error('RIDE_NOT_FOUND');

    const ride = rideDoc.data();
    if (ride.status !== RIDE_STATUS.PENDING) {
      throw new Error('RIDE_NOT_PENDING');
    }

    // 2. Verify the bid exists and is in a valid state
    const bidDoc = await transaction.get(acceptedBidRef);
    if (!bidDoc.exists) throw new Error('BID_NOT_FOUND');

    const bid = bidDoc.data();
    const bidStatus = bid.status || BID_STATUS.PENDING;

    // Can only accept bids that are pending or countered
    if (bidStatus !== BID_STATUS.PENDING && bidStatus !== BID_STATUS.COUNTERED) {
      throw new Error('BID_NOT_ACCEPTABLE');
    }

    const now = _ts();

    // 3. Mark all other bids as rejected using ride.bidIds[] — all reads via transaction.get()
    // This prevents the race condition where a non-transactional collection query
    // could allow two concurrent accept-bid calls to both succeed.
    const bidIds = Array.isArray(ride.bidIds) ? ride.bidIds : [];
    const otherBidRefs = bidIds
      .filter(id => id !== bidId)
      .map(id => db.collection(COL.bids).doc(id));
    const otherBidDocs = await Promise.all(
      otherBidRefs.map(ref => transaction.get(ref))
    );
    for (const otherBidDoc of otherBidDocs) {
      if (!otherBidDoc.exists) continue;
      const otherStatus = otherBidDoc.data().status || BID_STATUS.PENDING;
      if (otherStatus !== BID_STATUS.ACCEPTED &&
          otherStatus !== BID_STATUS.REJECTED &&
          otherStatus !== BID_STATUS.EXPIRED) {
        transaction.update(otherBidDoc.ref, {
          status: BID_STATUS.REJECTED,
          updatedAt: now,
        });
      }
    }

    // 4. Mark the accepted bid
    transaction.update(acceptedBidRef, {
      status: BID_STATUS.ACCEPTED,
      updatedAt: now,
    });

    // 5. Update ride with acceptance info
    const otp = String(Math.floor(1000 + Math.random() * 9000));
    transaction.update(rideRef, {
      status: RIDE_STATUS.ACCEPTED,
      acceptedBidId: bidId,
      driverId: driverId || bid.driverId,
      driverPhone: driverPhone || bid.driverPhone,
      driverName: driverName || bid.driverName,
      acceptedPrice: acceptedPrice || bid.price,
      otp,
      updatedAt: now,
    });

    return {
      rideId,
      bidId,
      driverId: driverId || bid.driverId,
      driverName: driverName || bid.driverName,
      acceptedPrice: acceptedPrice || bid.price,
      otp,
    };
  });
}

/**
 * Production-grade: Expire a ride and all its bids.
 * Called when ride expires (after timeout) or manually cancelled.
 */
async function expireRideAndBids(rideId) {
  const db = getDb();
  if (!db) throw new Error('Firestore not configured');

  const rideRef = db.collection(COL.rides).doc(rideId);
  const now = _ts();

  return await db.runTransaction(async (transaction) => {
    // 1. Get ride and verify it can be expired
    const rideDoc = await transaction.get(rideRef);
    if (!rideDoc.exists) throw new Error('RIDE_NOT_FOUND');

    const ride = rideDoc.data();
    // Can only expire pending rides
    if (ride.status !== RIDE_STATUS.PENDING) {
      throw new Error('RIDE_NOT_EXPIRABLE');
    }

    // 2. Expire all pending/countered bids for this ride
    const bidsSnap = await db.collection(COL.bids)
      .where('rideId', '==', rideId)
      .where('status', 'in', [BID_STATUS.PENDING, BID_STATUS.COUNTERED])
      .get();

    for (const bidDoc of bidsSnap.docs) {
      transaction.update(bidDoc.ref, {
        status: BID_STATUS.EXPIRED,
        updatedAt: now,
      });
    }

    // 3. Mark ride as expired
    transaction.update(rideRef, {
      status: RIDE_STATUS.EXPIRED,
      updatedAt: now,
    });

    return { rideId, expiredBids: bidsSnap.docs.length };
  });
}

/**
 * Legacy createBid - kept for backward compatibility but redirects to upsertBid.
 * @deprecated Use upsertBid for production-grade unique constraint enforcement.
 */
async function createBid(rideId, bidData) {
  // Redirect to upsertBid for consistency
  return upsertBid(rideId, bidData);
}

// ---------- Messages ----------
async function getMessagesByRideId(rideId) {
  const db = getDb();
  if (!db) return [];
  const snap = await db.collection(COL.messages).where('rideId', '==', rideId).get();
  const list = snap.docs.map((d) => {
    const x = d.data();
    const at = x.createdAt?.toDate?.() || x.createdAt;
    return { from: x.from, text: x.text, at };
  });
  // Sort client-side to avoid Firestore composite index requirement
  list.sort((a, b) => {
    const ta = a.at instanceof Date ? a.at.getTime() : (new Date(a.at)).getTime();
    const tb = b.at instanceof Date ? b.at.getTime() : (new Date(b.at)).getTime();
    return ta - tb;
  });
  return list;
}

async function createMessage(rideId, from, text) {
  const db = getDb();
  if (!db) throw new Error('Firestore not configured');
  await db.collection(COL.messages).add({
    rideId,
    from,
    text,
    createdAt: _ts(),
  });
}

// ---------- DriverWallet ----------
async function getDriverWallet(driverId) {
  const db = getDb();
  if (!db) return null;
  const snap = await db.collection(COL.driver_wallets).where('driverId', '==', driverId).limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0].data();
  return {
    id: snap.docs[0].id,
    driverId,
    balance: d.balance ?? 0,
    creditsValidUntil: d.creditsValidUntil,
  };
}

async function getOrCreateDriverWallet(driverId) {
  const db = getDb();
  if (!db) throw new Error('Firestore not configured');
  let w = await getDriverWallet(driverId);
  if (w) return w;
  const now = _ts();
  const ref = await db.collection(COL.driver_wallets).add({
    driverId,
    balance: 0,
    lastScratchAt: null,
    creditsValidUntil: null,
    createdAt: now,
    updatedAt: now,
  });
  const snap = await ref.get();
  const d = snap.data();
  return { id: snap.id, driverId, balance: 0, creditsValidUntil: null };
}

async function updateDriverWalletBalance(driverId, delta) {
  const db = getDb();
  if (!db) throw new Error('Firestore not configured');
  await getOrCreateDriverWallet(driverId);
  const snap = await db.collection(COL.driver_wallets).where('driverId', '==', driverId).limit(1).get();
  if (snap.empty) return;
  const docRef = snap.docs[0].ref;
  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);
    if (!doc.exists) return;
    const current = doc.data().balance ?? 0;
    transaction.update(docRef, { balance: current + delta, updatedAt: _ts() });
  });
}

// ---------- DriverVerification ----------
async function getDriverVerificationByDriverId(driverId) {
  const db = getDb();
  if (!db) return null;
  const snap = await db.collection(COL.driver_verifications).where('driverId', '==', String(driverId)).limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0].data();
  return {
    id: snap.docs[0].id,
    driverId: d.driverId,
    status: d.status || 'pending',
    vehicleType: d.vehicleType,
    vehiclePlate: d.vehiclePlate,
    driverName: d.driverName,
    email: d.email,
    city: d.city || null,
    dni: d.dni || null,
    phone: d.phone || null,
    license: d.license || null,
    photoUrl: d.photoUrl || null,
    vehicleBrand: d.vehicleBrand || null,
    vehicleModel: d.vehicleModel || null,
    vehicleColor: d.vehicleColor || null,
    registrationYear: d.registrationYear ?? null,
    vehicleCapacity: d.vehicleCapacity ?? null,
    licenseClass: d.licenseClass || null,
    licenseIssueDate: d.licenseIssueDate || null,
    licenseExpiryDate: d.licenseExpiryDate || null,
    dniIssueDate: d.dniIssueDate || null,
    dniExpiryDate: d.dniExpiryDate || null,
    engineNumber: d.engineNumber || null,
    chassisNumber: d.chassisNumber || null,
    hasAntecedentesPoliciales: d.hasAntecedentesPoliciales ?? null,
    hasAntecedentesPenales: d.hasAntecedentesPenales ?? null,
    customRatePerKm: d.customRatePerKm ?? null,
    reuploadDocumentTypes: Array.isArray(d.reuploadDocumentTypes) ? d.reuploadDocumentTypes : [],
    reuploadMessage: d.reuploadMessage || null,
    blockReason: d.blockReason,
    createdAt: d.createdAt?.toDate?.(), updatedAt: d.updatedAt?.toDate?.(),
  };
}

async function getDriverVerificationByVehiclePlate(vehiclePlate) {
  const db = getDb();
  if (!db) return null;
  const snap = await db.collection(COL.driver_verifications).where('vehiclePlate', '==', vehiclePlate).limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0].data();
  return { id: snap.docs[0].id, driverId: d.driverId, status: d.status };
}

async function findOrCreateDriverVerification(driverId, defaults = {}) {
  const db = getDb();
  if (!db) throw new Error('Firestore not configured');
  let row = await getDriverVerificationByDriverId(driverId);
  if (row) return { row, created: false };
  const now = _ts();
  const ref = await db.collection(COL.driver_verifications).add({
    driverId: String(driverId),
    authUid: defaults.authUid || null,
    status: defaults.status || 'pending',
    vehicleType: defaults.vehicleType || 'car',
    vehiclePlate: defaults.vehiclePlate || null,
    driverName: defaults.driverName || null,
    email: defaults.email || null,
    city: defaults.city || null,
    dni: defaults.dni || null,
    phone: defaults.phone || null,
    license: defaults.license || null,
    photoUrl: defaults.photoUrl || null,
    vehicleBrand: defaults.vehicleBrand || null,
    vehicleModel: defaults.vehicleModel || null,
    vehicleColor: defaults.vehicleColor || null,
    registrationYear: defaults.registrationYear ?? null,
    vehicleCapacity: defaults.vehicleCapacity ?? null,
    licenseClass: defaults.licenseClass || null,
    licenseIssueDate: defaults.licenseIssueDate || null,
    licenseExpiryDate: defaults.licenseExpiryDate || null,
    dniIssueDate: defaults.dniIssueDate || null,
    dniExpiryDate: defaults.dniExpiryDate || null,
    engineNumber: defaults.engineNumber || null,
    chassisNumber: defaults.chassisNumber || null,
    hasAntecedentesPoliciales: defaults.hasAntecedentesPoliciales ?? null,
    hasAntecedentesPenales: defaults.hasAntecedentesPenales ?? null,
    customRatePerKm: defaults.customRatePerKm ?? null,
    reuploadDocumentTypes: Array.isArray(defaults.reuploadDocumentTypes) ? defaults.reuploadDocumentTypes : [],
    reuploadMessage: defaults.reuploadMessage || null,
    blockReason: defaults.blockReason || null,
    createdAt: now,
    updatedAt: now,
  });
  row = await getDriverVerificationByDriverId(driverId);
  return { row, created: true };
}

async function updateDriverVerification(driverId, updates) {
  const db = getDb();
  if (!db) throw new Error('Firestore not configured');
  const snap = await db.collection(COL.driver_verifications).where('driverId', '==', String(driverId)).limit(1).get();
  if (snap.empty) return null;
  await snap.docs[0].ref.update({ ...updates, updatedAt: _ts() });
  return getDriverVerificationByDriverId(driverId);
}

async function listDriverVerifications(orderByUpdated = true) {
  const db = getDb();
  if (!db) return [];
  let q = db.collection(COL.driver_verifications);
  if (orderByUpdated) q = q.orderBy('updatedAt', 'desc');
  const snap = await q.get();
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      driverId: x.driverId,
      status: x.status,
      vehicleType: x.vehicleType,
      vehiclePlate: x.vehiclePlate,
      driverName: x.driverName,
      email: x.email || null,
      city: x.city || null,
      dni: x.dni || null,
      phone: x.phone || null,
      license: x.license || null,
      photoUrl: x.photoUrl || null,
      blockReason: x.blockReason,
      updatedAt: x.updatedAt?.toDate?.(),
      createdAt: x.createdAt?.toDate?.(),
    };
  });
}

module.exports = {
  getDb,
  COL,
  BID_STATUS,
  RIDE_STATUS,
  RIDE_EXPIRY_MINUTES,
  healthCheck,
  getUserByPhone,
  upsertUserByPhone,
  setUserAppEmail,
  setDriverAppEmail,
  upsertDriverFcmToken,
  listDriverFcmTokens,
  getUserAppEmailByPhone,
  getDriverAppEmailByPhone,
  getDriverPhoneByEmail,
  insertPasswordResetOtp,
  findLatestPasswordResetOtp,
  deletePasswordResetOtp,
  createRide,
  getRideById,
  updateRide,
  listRides,
  createBid,
  upsertBid,
  updateBidById,
  getBidsByRideId,
  getBidsByDriverId,
  acceptBidTransaction,
  expireRideAndBids,
  getMessagesByRideId,
  createMessage,
  getDriverWallet,
  getOrCreateDriverWallet,
  updateDriverWalletBalance,
  getDriverVerificationByDriverId,
  getDriverVerificationByVehiclePlate,
  findOrCreateDriverVerification,
  updateDriverVerification,
  listDriverVerifications,
};
