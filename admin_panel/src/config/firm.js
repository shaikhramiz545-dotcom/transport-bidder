/**
 * Firma (company) config – Control panel branding & features.
 * Filhaal: TBidder. Baad mein Firma-specific changes yahan se honge.
 * Jo features honge wo baad mein update karenge — structure abhi set hai.
 */

export const FIRM_NAME = 'TBidder'
export const FIRM_ADMIN_TITLE = `${FIRM_NAME} Admin`
export const FIRM_LOGIN_PLACEHOLDER_EMAIL = 'admin@tbidder.com'

/** Sidebar menu + feature scope. Icon names match lucide-react (e.g. LayoutDashboard). */
export const FIRM_FEATURES = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: 'LayoutDashboard',
    description: 'Stats: online drivers, pending verifications, today’s rides, pending/total rides.',
    permission: 'dashboard',
  },
  {
    path: '/bookings',
    label: 'Bookings',
    icon: 'MessageSquare',
    description: 'List all rides; open ride detail & chat history.',
    permission: 'bookings',
  },
  {
    path: '/dispatcher',
    label: 'Dispatcher',
    icon: 'Radio',
    description: 'Manual booking interface (create ride on behalf of user).',
    permission: 'dispatcher',
  },
  {
    path: '/verification-hub',
    label: 'Verification Hub',
    icon: 'ShieldCheck',
    description: 'Approve driver documents & 360° vehicle videos.',
    permission: 'verification',
  },
  {
    path: '/drivers',
    label: 'Drivers',
    icon: 'Users',
    description: 'Full driver management: list, filters, detail, approve/reject.',
    permission: 'drivers',
  },
  {
    path: '/finance',
    label: 'Finance',
    icon: 'Wallet',
    description: 'Wallet recharges — view screenshots → credit balance.',
    permission: 'finance',
  },
  {
    path: '/agencies',
    label: 'Agencies',
    icon: 'Building2',
    description: 'Manage fleet owners / agencies.',
    permission: 'agencies',
  },
  {
    path: '/tours',
    label: 'Tours',
    icon: 'MapPin',
    description: 'Approve / reject Attractions tours. Manage travel agencies.',
    permission: 'tours',
  },
  {
    path: '/agency-payouts',
    label: 'Agency Payouts',
    icon: 'Banknote',
    description: 'Complete travel agency payouts (gateway/transfer fee deducted). Pay any agency anytime. Email with PDF/Excel.',
    permission: 'agency_payouts',
  },
  {
    path: '/tbidder-health',
    label: 'TBidder Health',
    icon: 'Activity',
    description: 'Live status of all services: backend, database, Places API, Directions API. Business health: online drivers, pending verifications, rides.',
    permission: 'health',
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: 'Settings',
    description: 'Commission rates, push notifications, Firma settings.',
    permission: 'settings',
  },
  {
    path: '/team',
    label: 'Team Management',
    icon: 'UsersRound',
    description: 'Manage team members, departments, and module access for agents across your organization.',
    permission: 'team',
  },
]

export function getFeatureByPath(path) {
  return FIRM_FEATURES.find((f) => f.path === path || (path && path.startsWith(f.path + '/'))) || null
}
