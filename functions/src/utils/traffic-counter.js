/**
 * In-memory traffic counter – last 60 seconds sliding window.
 * Maps API paths to display keys for TBidder Health.
 */
const WINDOW_MS = 60 * 1000; // 60 seconds
const entries = [];

// Path pattern -> { section, key } for display
const PATH_MAP = [
  { pattern: /^\/api\/places\/autocomplete/, section: 'userApp', key: 'places' },
  { pattern: /^\/api\/places\/details/, section: 'userApp', key: 'placesDetails' },
  { pattern: /^\/api\/directions/, section: 'userApp', key: 'directions' },
  { pattern: /^\/api\/rides/, section: 'rides', key: 'rides' }, // shared
  { pattern: /^\/api\/auth\/verify/, section: 'authVerify', key: 'authVerify' },
  { pattern: /^\/api\/auth\//, section: 'auth', key: 'auth' }, // shared
  { pattern: /^\/api\/drivers\/requests/, section: 'driverApp', key: 'drivers' },
  { pattern: /^\/api\/drivers\/verification/, section: 'driverApp', key: 'driverVerification' },
  { pattern: /^\/api\/drivers\//, section: 'driverApp', key: 'drivers' },
  { pattern: /^\/api\/wallet\/balance/, section: 'driverApp', key: 'wallet' },
  { pattern: /^\/api\/wallet\/transactions/, section: 'driverApp', key: 'walletTransactions' },
  { pattern: /^\/api\/wallet\/recharge/, section: 'driverApp', key: 'walletRecharge' },
  { pattern: /^\/api\/wallet\//, section: 'driverApp', key: 'wallet' },
  { pattern: /^\/api\/admin\//, section: 'adminPanel', key: 'admin' },
  { pattern: /^\/api\/tours\/ticker-messages/, section: 'userApp', key: 'tourTicker' },
  { pattern: /^\/api\/tours\/feature-flag/, section: 'userApp', key: 'tourFeatureFlag' },
  { pattern: /^\/api\/tours\/bookings/, section: 'partnerPanel', key: 'tourBookings' },
  { pattern: /^\/api\/tours\//, section: 'partnerPanel', key: 'tours' },
  { pattern: /^\/api\/tours$/, section: 'partnerPanel', key: 'tours' },
  { pattern: /^\/api\/agency\/signup/, section: 'partnerPanel', key: 'agencySignup' },
  { pattern: /^\/api\/agency\/login/, section: 'partnerPanel', key: 'agencyLogin' },
  { pattern: /^\/api\/agency\/payout-requests/, section: 'partnerPanel', key: 'agencyPayouts' },
  { pattern: /^\/api\/agency\/wallet/, section: 'partnerPanel', key: 'agencyWallet' },
  { pattern: /^\/api\/agency\//, section: 'partnerPanel', key: 'agency' },
  { pattern: /^\/uploads/, section: 'uploads', key: 'uploads' },
];

function pathToKey(path) {
  for (const { pattern, section, key } of PATH_MAP) {
    if (pattern.test(path)) return { section, key };
  }
  return null;
}

function record(path) {
  const key = pathToKey(path);
  if (!key) return;
  const now = Date.now();
  entries.push({ ...key, time: now });
  // prune old
  const cutoff = now - WINDOW_MS;
  while (entries.length > 0 && entries[0].time < cutoff) {
    entries.shift();
  }
}

function getStats() {
  const cutoff = Date.now() - WINDOW_MS;
  const recent = entries.filter((e) => e.time >= cutoff);

  const counts = {
    userApp: { places: 0, placesDetails: 0, directions: 0, rides: 0, auth: 0, authVerify: 0, tourTicker: 0, tourFeatureFlag: 0 },
    driverApp: { auth: 0, drivers: 0, driverVerification: 0, wallet: 0, walletTransactions: 0, walletRecharge: 0, rides: 0 },
    adminPanel: { admin: 0 },
    partnerPanel: { tours: 0, agency: 0, agencySignup: 0, agencyLogin: 0, agencyPayouts: 0, agencyWallet: 0, tourBookings: 0 },
    uploads: 0,
    rides: 0,
    auth: 0,
  };

  for (const { section, key } of recent) {
    if (section === 'uploads') {
      counts.uploads = (counts.uploads || 0) + 1;
    } else if (section === 'rides') {
      counts.userApp.rides += 1;
      counts.driverApp.rides += 1;
    } else if (section === 'auth') {
      counts.userApp.auth += 1;
      counts.driverApp.auth += 1;
    } else if (section === 'authVerify') {
      counts.userApp.authVerify += 1;
    } else if (counts[section] && counts[section][key] !== undefined) {
      counts[section][key] += 1;
    }
  }

  const total = recent.length;
  const withPercent = {};
  for (const [section, obj] of Object.entries(counts)) {
    if (typeof obj === 'number') {
      withPercent[section] = { count: obj, percent: total > 0 ? ((obj / total) * 100).toFixed(1) : 0 };
    } else {
      withPercent[section] = {};
      for (const [k, v] of Object.entries(obj)) {
        withPercent[section][k] = { count: v, percent: total > 0 ? ((v / total) * 100).toFixed(1) : 0 };
      }
    }
  }
  withPercent.total = total;

  return withPercent;
}

module.exports = { record, getStats };
