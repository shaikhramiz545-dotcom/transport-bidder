import axios from 'axios'

// Dev: proxy /api → backend (vite.config). Production: VITE_API_URL=https://api.transportbidder.com
const baseURL = import.meta.env.VITE_API_URL
  ? (import.meta.env.VITE_API_URL.replace(/\/$/, '') + '/api/v1')
  : '/api/v1'
const api = axios.create({ baseURL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Graceful fallback: on 500 for GET list/stats, return empty data so UI loads (backend/DB may be down)
const FALLBACK_PATHS = [
  '/admin/stats',
  '/admin/drivers',
  '/admin/rides',
  '/admin/recharge-requests',
  '/admin/wallet-transactions',
  '/admin/travel-agencies',
  '/admin/tours',
  '/admin/agency-payouts',
  '/admin/agencies',
  '/admin/income-by-month',
]
const fallbackData = {
  '/admin/stats': {
    onlineDrivers: 0,
    pendingVerifications: 0,
    todaysRides: 0,
    pendingRides: 0,
    totalRides: 0,
    incomeCurrentMonth: 0,
    incomePreviousMonth: 0,
    currentMonthLabel: '',
    previousMonthLabel: '',
    totalDriversByVehicle: { car: 0, bike: 0, taxi: 0, van: 0, truck: 0, car_hauler: 0, ambulance: 0 },
    activeDriversByVehicle: { car: 0, bike: 0, taxi: 0, van: 0, truck: 0, car_hauler: 0, ambulance: 0 },
    liveDrivers: [],
  },
  '/admin/drivers': { drivers: [] },
  '/admin/rides': { rides: [] },
  '/admin/recharge-requests': { requests: [] },
  '/admin/wallet-transactions': { transactions: [] },
  '/admin/travel-agencies': { agencies: [] },
  '/admin/tours': { tours: [] },
  '/admin/agency-payouts': { payouts: [] },
  '/admin/agencies': { agencies: [] },
  '/admin/income-by-month': { incomeByMonth: [] },
}
function getFallback(path) {
  const p = (path || '').split('?')[0]
  if (/^\/admin\/drivers\/[^/]+$/.test(p)) return { driver: null }
  if (/^\/admin\/rides\/[^/]+$/.test(p)) return { id: null, messages: [] }
  if (/^\/admin\/travel-agencies\/[^/]+$/.test(p)) return { agency: null }
  if (/^\/admin\/tours\/[^/]+$/.test(p)) return { tour: null }
  const base = FALLBACK_PATHS.find((b) => p === b || p.startsWith(b + '/'))
  if (base) return fallbackData[base] || {}
  return null
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status
    const path = err.config?.url || ''
    if (status === 500 && err.config?.method === 'get') {
      // Never swallow document/audit endpoint errors — show them to admin
      const isDocOrAudit = /\/documents|\/audit/.test(path)
      if (!isDocOrAudit) {
        const data = getFallback(path)
        if (data) {
          return Promise.resolve({ data, status: 200, config: err.config })
        }
      }
    }
    return Promise.reject(err)
  }
)

export default api
