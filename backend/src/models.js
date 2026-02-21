const { DataTypes } = require('sequelize');
const { sequelize } = require('./config/db');

const User = sequelize.define('User', {
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  country: { type: DataTypes.STRING, defaultValue: 'PE' },
  currency: { type: DataTypes.STRING, defaultValue: 'PEN' },
}, { timestamps: true, tableName: 'users' });

const Ride = sequelize.define('Ride', {
  pickupLat: { type: DataTypes.DOUBLE, allowNull: false },
  pickupLng: { type: DataTypes.DOUBLE, allowNull: false },
  dropLat: { type: DataTypes.DOUBLE, allowNull: false },
  dropLng: { type: DataTypes.DOUBLE, allowNull: false },
  pickupAddress: { type: DataTypes.STRING, allowNull: false },
  dropAddress: { type: DataTypes.STRING, allowNull: false },
  distanceKm: { type: DataTypes.DOUBLE, allowNull: false },
  trafficDelayMins: { type: DataTypes.INTEGER, allowNull: false },
  vehicleType: { type: DataTypes.STRING, allowNull: false },
  userPrice: { type: DataTypes.DOUBLE, allowNull: false },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending',
    // pending | accepted | declined | driver_arrived | ride_started | completed
  },
  userPhone: { type: DataTypes.STRING },
  driverPhone: { type: DataTypes.STRING },
  driverId: { type: DataTypes.STRING },
  userRating: { type: DataTypes.DOUBLE },
  userPhotoUrl: { type: DataTypes.STRING },
  counterPrice: { type: DataTypes.DOUBLE },
  otp: { type: DataTypes.STRING },
  driverLat: { type: DataTypes.DOUBLE },
  driverLng: { type: DataTypes.DOUBLE },
  // Outstation fields (taxi_outstation rides)
  outstationPassengers: { type: DataTypes.INTEGER, allowNull: true },
  outstationComments: { type: DataTypes.TEXT, allowNull: true },
  outstationIsParcel: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
  // Delivery fields
  deliveryComments: { type: DataTypes.TEXT, allowNull: true },
  deliveryWeight: { type: DataTypes.STRING, allowNull: true },
  deliveryPhotoUrl: { type: DataTypes.TEXT, allowNull: true },
}, { timestamps: true, tableName: 'rides' });

const Message = sequelize.define('Message', {
  rideId: { type: DataTypes.UUID, allowNull: false },
  from: { type: DataTypes.STRING, allowNull: false }, // 'user' | 'driver'
  text: { type: DataTypes.TEXT, allowNull: false },
}, { timestamps: true, updatedAt: false, tableName: 'messages' });

const DriverVerification = sequelize.define('DriverVerification', {
  driverId: { type: DataTypes.STRING, allowNull: false, unique: true },
  authUid: { type: DataTypes.STRING, allowNull: true, unique: true }, // Firebase Auth UID - single source of truth for driver identity
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' }, // pending | approved | rejected | temp_blocked | suspended
  vehicleType: { type: DataTypes.STRING, allowNull: true, defaultValue: 'car' }, // car | bike | taxi | van | truck | ambulance
  vehiclePlate: { type: DataTypes.STRING, allowNull: true }, // for duplicate detection (same vehicle = temp_block)
  driverName: { type: DataTypes.STRING, allowNull: true },
  email: { type: DataTypes.STRING, allowNull: true, unique: true }, // Minimal fix: email field add kiya
  phone: { type: DataTypes.STRING, allowNull: true },
  city: { type: DataTypes.STRING, allowNull: true },
  dni: { type: DataTypes.STRING, allowNull: true, unique: true },
  license: { type: DataTypes.STRING, allowNull: true, unique: true },
  hasAntecedentesPoliciales: { type: DataTypes.BOOLEAN, allowNull: true },
  hasAntecedentesPenales: { type: DataTypes.BOOLEAN, allowNull: true },
  customRatePerKm: { type: DataTypes.DOUBLE, allowNull: true }, // optional per-driver fare override (S/ per km)
  blockReason: { type: DataTypes.TEXT, allowNull: true }, // admin or system reason (e.g. duplicate account)
  reuploadDocumentTypes: { type: DataTypes.JSONB, allowNull: true }, // ['soat','brevete_frente'] when admin requested reupload
  reuploadMessage: { type: DataTypes.TEXT, allowNull: true }, // instructions shown to driver
  adminNotes: { type: DataTypes.TEXT, allowNull: true }, // internal admin notes; not shown to driver
  // NEW: Vehicle detail fields (Peru compliance)
  vehicleBrand: { type: DataTypes.STRING, allowNull: true }, // Toyota, Nissan, Hyundai, etc.
  vehicleModel: { type: DataTypes.STRING, allowNull: true }, // Corolla, Sentra, Accent, etc.
  vehicleColor: { type: DataTypes.STRING, allowNull: true }, // Blanco, Negro, Plata, etc.
  registrationYear: { type: DataTypes.INTEGER, allowNull: true }, // 2020, 2021, etc. (must be < 10 years for taxi)
  vehicleCapacity: { type: DataTypes.INTEGER, allowNull: true }, // 2, 4, 6, 8 passengers
  // NEW: License detail fields
  licenseClass: { type: DataTypes.STRING, allowNull: true }, // A-I, A-IIa, A-IIb, A-IIIa, A-IIIb, A-IIIc
  licenseIssueDate: { type: DataTypes.DATEONLY, allowNull: true },
  licenseExpiryDate: { type: DataTypes.DATEONLY, allowNull: true },
  // NEW: DNI date fields
  dniIssueDate: { type: DataTypes.DATEONLY, allowNull: true },
  dniExpiryDate: { type: DataTypes.DATEONLY, allowNull: true },
  // NEW: Advanced fields (optional)
  engineNumber: { type: DataTypes.STRING, allowNull: true },
  chassisNumber: { type: DataTypes.STRING, allowNull: true },
  // NEW: Registration deadline tracking (24-hour completion window)
  registrationStartedAt: { type: DataTypes.DATE, allowNull: true },
  registrationDeadline: { type: DataTypes.DATE, allowNull: true },
  // Collision repair tracking
  collisionRepaired: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
  previousDriverId: { type: DataTypes.STRING(64), allowNull: true },
}, { timestamps: true });

/** Driver verification documents (Peru: brevete_frente, brevete_dorso, dni, selfie, soat, tarjeta_propiedad, foto_vehiculo). */
const DriverDocument = sequelize.define('DriverDocument', {
  driverId: { type: DataTypes.STRING, allowNull: false },
  documentType: { type: DataTypes.STRING, allowNull: false },
  fileUrl: { type: DataTypes.TEXT, allowNull: false },
  fileName: { type: DataTypes.STRING },
  expiryDate: { type: DataTypes.DATEONLY, allowNull: true }, // SOAT / brevete expiry; canGoOnline blocks if soat expired
  // NEW: Document metadata fields
  issueDate: { type: DataTypes.DATEONLY, allowNull: true }, // Document issue date
  policyNumber: { type: DataTypes.STRING, allowNull: true }, // For SOAT insurance
  insuranceCompany: { type: DataTypes.STRING, allowNull: true }, // For SOAT
  certificateNumber: { type: DataTypes.STRING, allowNull: true }, // For Revisión Técnica
  inspectionCenter: { type: DataTypes.STRING, allowNull: true }, // For Revisión Técnica
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' }, // pending | approved | rejected | expired
  adminFeedback: { type: DataTypes.TEXT, allowNull: true }, // Reason for rejection
}, { timestamps: true, updatedAt: false });

/** Audit log for driver verification actions (admin approve/reject/suspend/reupload_requested). */
const DriverVerificationAudit = sequelize.define('DriverVerificationAudit', {
  driverId: { type: DataTypes.STRING, allowNull: false },
  actor: { type: DataTypes.STRING, allowNull: false },
  action: { type: DataTypes.STRING, allowNull: false },
  reason: { type: DataTypes.TEXT },
  oldStatus: { type: DataTypes.STRING },
  newStatus: { type: DataTypes.STRING },
  metadata: { type: DataTypes.JSONB },
}, { timestamps: true, updatedAt: false });

/** Single row (key='global') for Firma settings – commission, notifications. */
const AdminSettings = sequelize.define('AdminSettings', {
  key: { type: DataTypes.STRING, primaryKey: true, defaultValue: 'global' },
  commissionPercent: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 10 },
  notificationsEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { timestamps: true });

/** App users – email+password auth for User & Driver apps (replaces Firebase Auth). */
const AppUser = sequelize.define('AppUser', {
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: true },
  phone: { type: DataTypes.STRING, allowNull: true },
  role: { type: DataTypes.STRING, allowNull: false, defaultValue: 'user' }, // user | driver
  emailVerified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' }, // active | disabled
}, { timestamps: true });

/** Email OTPs – verification & password reset (sent via MSG91). */
const EmailOtp = sequelize.define('EmailOtp', {
  email: { type: DataTypes.STRING, allowNull: false },
  otp: { type: DataTypes.STRING, allowNull: false },
  scope: { type: DataTypes.STRING, allowNull: false, defaultValue: 'verification' }, // verification | password_reset
  role: { type: DataTypes.STRING, allowNull: true, defaultValue: 'user' }, // user | driver | admin | agency
  expiresAt: { type: DataTypes.DATE, allowNull: false },
}, { timestamps: true, updatedAt: false });

/** Admin sub-users (manager accounts) with permissions. */
const AdminUser = sequelize.define('AdminUser', {
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: true }, // display name
  department: { type: DataTypes.STRING, allowNull: true }, // e.g. Customer Service, Dispatch, Finance
  role: { type: DataTypes.STRING, allowNull: false, defaultValue: 'manager' }, // admin | manager
  permissions: { type: DataTypes.JSONB, allowNull: true }, // ['drivers','finance',...]
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' }, // active | disabled
}, { timestamps: true });

/** Admin role templates – team wise modules access. */
const AdminRole = sequelize.define('AdminRole', {
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  permissions: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
}, { timestamps: true });

/** Driver identity mapping (phone -> driverId) for stable IDs across reinstalls. */
const DriverIdentity = sequelize.define('DriverIdentity', {
  phone: { type: DataTypes.STRING, allowNull: false, unique: true },
  driverId: { type: DataTypes.STRING, allowNull: false, unique: true },
}, { timestamps: true });

// ─── Attractions / Tours Module (worldwide) ───────────────────────────────────

/** Feature flags – Admin can toggle. attractions_enabled default ON. */
const FeatureFlag = sequelize.define('FeatureFlag', {
  key: { type: DataTypes.STRING, primaryKey: true },
  value: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { timestamps: true, updatedAt: 'updatedAt' });

/** Travel agencies (partners) – worldwide, separate from taxi fleet agencies. */
const TravelAgency = sequelize.define('TravelAgency', {
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false },
  passwordHash: { type: DataTypes.STRING }, // hashed password for portal login
  phone: { type: DataTypes.STRING },
  country: { type: DataTypes.STRING, allowNull: false },
  currency: { type: DataTypes.STRING, allowNull: false, defaultValue: 'USD' },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending',
    // pending | approved | rejected | suspended | needs_documents
  },
  verificationNote: { type: DataTypes.TEXT }, // admin message when rejected or needs_documents (shown to agency)
  userId: { type: DataTypes.INTEGER }, // link to User when auth ready
}, { timestamps: true });

/** Agency verification documents – one row per uploaded file (type: business_license | tax_id | id_proof | company_registration). */
const AgencyDocument = sequelize.define('AgencyDocument', {
  travelAgencyId: { type: DataTypes.INTEGER, allowNull: false },
  documentType: { type: DataTypes.STRING, allowNull: false }, // business_license | tax_id | id_proof | company_registration
  fileUrl: { type: DataTypes.TEXT, allowNull: false }, // path or URL to file
  fileName: { type: DataTypes.STRING }, // original filename
}, { timestamps: true, updatedAt: false });

/** Tours – one per travel agency. */
const Tour = sequelize.define('Tour', {
  travelAgencyId: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  country: { type: DataTypes.STRING, allowNull: false },
  city: { type: DataTypes.STRING, allowNull: false },
  location: { type: DataTypes.STRING },
  category: {
    type: DataTypes.STRING,
    allowNull: false,
    // full_day | night_tour | adventure | cultural | family
  },
  description: { type: DataTypes.TEXT },
  includedServices: { type: DataTypes.TEXT }, // JSON string or bullet list
  images: { type: DataTypes.JSON, defaultValue: [] }, // array of URLs, max 10
  videoUrl: { type: DataTypes.STRING }, // single video URL
  durationMins: { type: DataTypes.INTEGER },
  meetingPoint: { type: DataTypes.STRING },
  cancellationPolicy: { type: DataTypes.TEXT },
  freeCancellation: { type: DataTypes.BOOLEAN, defaultValue: true },
  freeCancellationHours: { type: DataTypes.INTEGER }, // e.g. 24 = cancel 24h before for full refund
  languages: { type: DataTypes.JSON, defaultValue: [] }, // ['en','es']
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending',
    // pending | approved | rejected | suspended | blocked
  },
  pendingChangeSummary: { type: DataTypes.TEXT }, // Shown to admin when tour goes to pending after edit
  suspendReason: { type: DataTypes.TEXT }, // Why suspended (temporary)
  suspendFixInstructions: { type: DataTypes.TEXT }, // How to fix, shown to agency
}, { timestamps: true });

/** Driver wallet – credits balance per driver. Credits valid 1 year from last top-up. */
const DriverWallet = sequelize.define('DriverWallet', {
  driverId: { type: DataTypes.STRING, allowNull: false, unique: true },
  appUserId: { type: DataTypes.INTEGER, allowNull: true, unique: true }, // FK → AppUser.id (wallet isolation fix)
  ownerPhone: { type: DataTypes.STRING(32), allowNull: true }, // cross-reference audit field
  balance: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, // credits
  lastScratchAt: { type: DataTypes.DATEONLY, allowNull: true }, // YYYY-MM-DD for daily scratch card
  creditsValidUntil: { type: DataTypes.DATEONLY, allowNull: true }, // YYYY-MM-DD – credits expire after 1 year from last recharge/scratch
  lastRechargeAt: { type: DataTypes.DATE, allowNull: true },
  rejectedRechargeCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, // block new recharge when >= 3
}, { timestamps: true });

/** Wallet transaction – driver recharge (manual, admin-approved). */
const WalletTransaction = sequelize.define('WalletTransaction', {
  driverId: { type: DataTypes.STRING, allowNull: false },
  amountSoles: { type: DataTypes.DOUBLE, allowNull: false },
  creditsAmount: { type: DataTypes.INTEGER, allowNull: false },
  transactionId: { type: DataTypes.STRING, allowNull: false },
  screenshotUrl: { type: DataTypes.TEXT, allowNull: true },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending',
    // pending | approved | declined | needs_pdf
  },
  adminNote: { type: DataTypes.TEXT, allowNull: true },
  approvedAt: { type: DataTypes.DATE, allowNull: true },
}, { timestamps: true });

/** Wallet ledger – audit of every balance change (recharge, deduction, expiry, adjustment). */
const WalletLedger = sequelize.define('WalletLedger', {
  driverId: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.STRING, allowNull: false }, // recharge | deduction | expiry | adjustment
  creditsChange: { type: DataTypes.INTEGER, allowNull: false },
  refId: { type: DataTypes.STRING, allowNull: true },
}, { timestamps: true, updatedAt: false });

/** Pax options – e.g. Adult $50, Child $25. */
const TourPaxOption = sequelize.define('TourPaxOption', {
  tourId: { type: DataTypes.INTEGER, allowNull: false },
  label: { type: DataTypes.STRING, allowNull: false }, // Adult, Child, etc
  pricePerPax: { type: DataTypes.DOUBLE, allowNull: false },
  currency: { type: DataTypes.STRING, allowNull: false, defaultValue: 'USD' },
  minCount: { type: DataTypes.INTEGER, defaultValue: 1 },
  maxCount: { type: DataTypes.INTEGER },
}, { timestamps: true });

/** Available slots – date + time slot. */
const TourSlot = sequelize.define('TourSlot', {
  tourId: { type: DataTypes.INTEGER, allowNull: false },
  slotDate: { type: DataTypes.DATEONLY, allowNull: false },
  startTime: { type: DataTypes.STRING, allowNull: false }, // "09:00"
  endTime: { type: DataTypes.STRING },
  maxPax: { type: DataTypes.INTEGER, allowNull: false },
  bookedPax: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { timestamps: true });

/** Tour booking – user books a tour. Payment via dLocal Go. */
const TourBooking = sequelize.define('TourBooking', {
  tourId: { type: DataTypes.INTEGER, allowNull: false },
  tourSlotId: { type: DataTypes.INTEGER, allowNull: false },
  travelAgencyId: { type: DataTypes.INTEGER, allowNull: false },
  totalAmount: { type: DataTypes.DOUBLE, allowNull: false },
  currency: { type: DataTypes.STRING, allowNull: false, defaultValue: 'USD' },
  paxCount: { type: DataTypes.INTEGER, allowNull: false },
  guestName: { type: DataTypes.STRING, allowNull: false },
  guestEmail: { type: DataTypes.STRING, allowNull: false },
  guestPhone: { type: DataTypes.STRING },
  guestWhatsApp: { type: DataTypes.STRING },
  specialInstructions: { type: DataTypes.TEXT },
  preferredLanguage: { type: DataTypes.STRING, defaultValue: 'en' },
  meetingPoint: { type: DataTypes.STRING },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending_payment',
    // pending_payment | paid | completed | cancelled
  },
  dlocalPaymentId: { type: DataTypes.STRING },
  dlocalStatus: { type: DataTypes.STRING },
  voucherCode: { type: DataTypes.STRING },
}, { timestamps: true });

/** Agency earnings balance – accumulated from paid tour bookings (after commission). */
const AgencyWallet = sequelize.define('AgencyWallet', {
  travelAgencyId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  balance: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0 },
  currency: { type: DataTypes.STRING, allowNull: false, defaultValue: 'USD' },
}, { timestamps: true });

/** Tour review/rating – after tour completion. */
const TourReview = sequelize.define('TourReview', {
  tourId: { type: DataTypes.INTEGER, allowNull: false },
  bookingId: { type: DataTypes.INTEGER },
  rating: { type: DataTypes.INTEGER, allowNull: false }, // 1-5
  reviewText: { type: DataTypes.TEXT },
}, { timestamps: true });

/** Agency payout request – agency withdraws earnings to bank. Gateway & transfer fee deducted; net sent. */
const AgencyPayoutRequest = sequelize.define('AgencyPayoutRequest', {
  travelAgencyId: { type: DataTypes.INTEGER, allowNull: false },
  amount: { type: DataTypes.DOUBLE, allowNull: false },
  currency: { type: DataTypes.STRING, allowNull: false, defaultValue: 'USD' },
  bankDetails: { type: DataTypes.JSON },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending',
    // pending | processing | completed | rejected
  },
  adminNote: { type: DataTypes.TEXT },
  processedAt: { type: DataTypes.DATE },
  gatewayCharges: { type: DataTypes.DOUBLE, allowNull: true }, // deducted
  transferFee: { type: DataTypes.DOUBLE, allowNull: true }, // deducted
  netAmount: { type: DataTypes.DOUBLE, allowNull: true }, // amount - gatewayCharges - transferFee
}, { timestamps: true });

Ride.hasMany(Message, { foreignKey: 'rideId' });
Message.belongsTo(Ride, { foreignKey: 'rideId' });

TravelAgency.hasMany(Tour, { foreignKey: 'travelAgencyId' });
Tour.belongsTo(TravelAgency, { foreignKey: 'travelAgencyId' });
Tour.hasMany(TourPaxOption, { foreignKey: 'tourId' });
TourPaxOption.belongsTo(Tour, { foreignKey: 'tourId' });
Tour.hasMany(TourSlot, { foreignKey: 'tourId' });
TourSlot.belongsTo(Tour, { foreignKey: 'tourId' });

Tour.hasMany(TourBooking, { foreignKey: 'tourId' });
TourBooking.belongsTo(Tour, { foreignKey: 'tourId' });
Tour.hasMany(TourReview, { foreignKey: 'tourId' });
TourReview.belongsTo(Tour, { foreignKey: 'tourId' });
TourSlot.hasMany(TourBooking, { foreignKey: 'tourSlotId' });
TourBooking.belongsTo(TourSlot, { foreignKey: 'tourSlotId' });
TravelAgency.hasMany(TourBooking, { foreignKey: 'travelAgencyId' });
TourBooking.belongsTo(TravelAgency, { foreignKey: 'travelAgencyId' });

TravelAgency.hasOne(AgencyWallet, { foreignKey: 'travelAgencyId' });
AgencyWallet.belongsTo(TravelAgency, { foreignKey: 'travelAgencyId' });
TravelAgency.hasMany(AgencyPayoutRequest, { foreignKey: 'travelAgencyId' });
AgencyPayoutRequest.belongsTo(TravelAgency, { foreignKey: 'travelAgencyId' });

TravelAgency.hasMany(AgencyDocument, { foreignKey: 'travelAgencyId' });
AgencyDocument.belongsTo(TravelAgency, { foreignKey: 'travelAgencyId' });

module.exports = {
  User, Ride, Message, DriverVerification, DriverDocument, DriverVerificationAudit, AdminSettings, AdminUser, DriverIdentity,
  FeatureFlag, TravelAgency, Tour, TourPaxOption, TourSlot,
  TourBooking, TourReview, AgencyWallet, AgencyPayoutRequest,
  DriverWallet, WalletTransaction, WalletLedger, AgencyDocument, AdminRole,
  AppUser, EmailOtp,
};
