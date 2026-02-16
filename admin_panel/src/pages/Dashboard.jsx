import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Car, ShieldCheck, MapPin, Clock, Hash, LogOut, Loader2, Users, UserCheck } from 'lucide-react'
import api from '../services/api'
import { FIRM_NAME } from '../config/firm'
import DriversMap from '../components/DriversMap'
import '../App.css'

const VEHICLE_LABELS = { car: 'Car', bike: 'Bike', taxi: 'Taxi', van: 'Van', truck: 'Truck', car_hauler: 'Car Hauler', ambulance: 'Ambulance' }
const VEHICLE_FILTER_OPTIONS = [
  { value: 'all', label: 'All vehicles' },
  { value: 'car', label: 'Car' },
  { value: 'bike', label: 'Bike' },
  { value: 'taxi', label: 'Taxi' },
  { value: 'van', label: 'Van' },
  { value: 'truck', label: 'Truck' },
  { value: 'car_hauler', label: 'Car Hauler' },
  { value: 'ambulance', label: 'Ambulance' },
]

function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [driverModal, setDriverModal] = useState(null) // 'total' | 'active' | null
  const [incomeCustom, setIncomeCustom] = useState({ from: '', to: '' })
  const [incomeByMonth, setIncomeByMonth] = useState([])
  const [loadingIncome, setLoadingIncome] = useState(false)
  const [mapVehicleFilter, setMapVehicleFilter] = useState('all')

  const fetchStats = () => {
    api.get('/admin/stats')
      .then(({ data }) => setStats(data))
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem('token')
          navigate('/login', { replace: true })
          return
        }
        setError(err.response?.data?.error || err.message || 'Failed to load stats')
      })
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    fetchStats()
  }, [navigate])
  // Refresh live drivers for map every 15s
  useEffect(() => {
    if (loading || error) return
    const t = setInterval(fetchStats, 15000)
    return () => clearInterval(t)
  }, [loading, error])

  useEffect(() => {
    if (!incomeCustom.from || !incomeCustom.to) return
    setLoadingIncome(true)
    api.get('/admin/income-by-month', { params: { from: incomeCustom.from, to: incomeCustom.to } })
      .then(({ data }) => setIncomeByMonth(data.incomeByMonth || []))
      .catch(() => setIncomeByMonth([]))
      .finally(() => setLoadingIncome(false))
  }, [incomeCustom.from, incomeCustom.to])

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login', { replace: true })
  }

  const totalDrivers = stats?.totalDriversByVehicle
    ? Object.values(stats.totalDriversByVehicle).reduce((a, b) => a + b, 0)
    : 0
  const activeDrivers = stats?.activeDriversByVehicle
    ? Object.values(stats.activeDriversByVehicle).reduce((a, b) => a + b, 0)
    : (stats?.onlineDrivers ?? 0)

  const statCards = stats
    ? [
        { label: 'Total Drivers', value: String(totalDrivers), icon: Users, key: 'total', clickable: true },
        { label: 'Active Drivers', value: String(activeDrivers), icon: UserCheck, key: 'active', clickable: true },
        { label: 'Pending Verifications', value: String(stats.pendingVerifications ?? 0), icon: ShieldCheck, key: 'pending', clickable: true },
        { label: "Today's Rides", value: String(stats.todaysRides ?? 0), icon: MapPin },
        { label: 'Pending Rides', value: String(stats.pendingRides ?? 0), icon: Clock },
        { label: 'Total Rides', value: String(stats.totalRides ?? 0), icon: Hash },
      ]
    : []

  const maxIncome = Math.max(
    stats?.incomeCurrentMonth ?? 0,
    stats?.incomePreviousMonth ?? 0,
    ...(incomeByMonth.length ? incomeByMonth.map((m) => m.total) : [1])
  ) || 1

  const setCustomMonths = () => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const prev = m === 0 ? 11 : m - 1
    const prevY = m === 0 ? y - 1 : y
    setIncomeCustom({
      from: `${prevY}-${String(prev + 1).padStart(2, '0')}`,
      to: `${y}-${String(m + 1).padStart(2, '0')}`,
    })
  }

  return (
    <>
      <header className="dashboard-header">
        <h1 className="dashboard-header-title">{FIRM_NAME} Dashboard</h1>
        <button type="button" className="dashboard-logout" onClick={handleLogout}>
          <LogOut size={18} />
          Logout
        </button>
      </header>
      <div className="dashboard-content">
        {loading && (
          <div className="dashboard-loading">
            <Loader2 size={32} className="spin" />
            <span>Loading stats...</span>
          </div>
        )}
        {error && <p className="dashboard-error">{error}</p>}
        {!loading && !error && (
          <>
            <div className="stats-grid">
              {statCards.map(({ label, value, icon: Icon, key, clickable }) => (
                <div
                  key={label}
                  className={`stat-card ${clickable ? 'clickable' : ''}`}
                  onClick={clickable ? () => (key === 'pending' ? navigate('/verification-hub') : setDriverModal(key)) : undefined}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onKeyDown={clickable ? (e) => e.key === 'Enter' && (key === 'pending' ? navigate('/verification-hub') : setDriverModal(key)) : undefined}
                >
                  <div className="stat-icon">
                    <Icon size={24} />
                  </div>
                  <div className="stat-body">
                    <span className="stat-value">{value}</span>
                    <span className="stat-label">{label}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Income graph: current vs previous month + custom months */}
            <section className="income-graph-section">
              <h3>Income by month (S/)</h3>
              <div className="income-graph-custom">
                <span>From</span>
                <select
                  value={incomeCustom.from}
                  onChange={(e) => setIncomeCustom((s) => ({ ...s, from: e.target.value }))}
                >
                  <option value="">Select month</option>
                  {Array.from({ length: 24 }, (_, i) => {
                    const d = new Date()
                    d.setMonth(d.getMonth() - i)
                    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                    return (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    )
                  })}
                </select>
                <span>To</span>
                <select
                  value={incomeCustom.to}
                  onChange={(e) => setIncomeCustom((s) => ({ ...s, to: e.target.value }))}
                >
                  <option value="">Select month</option>
                  {Array.from({ length: 24 }, (_, i) => {
                    const d = new Date()
                    d.setMonth(d.getMonth() - i)
                    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                    return (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    )
                  })}
                </select>
                <button type="button" className="dashboard-btn small" onClick={setCustomMonths}>
                  Last 2 months
                </button>
              </div>
              {loadingIncome && (
                <div className="dashboard-loading">
                  <Loader2 size={24} className="spin" />
                  <span>Loading income...</span>
                </div>
              )}
              {!loadingIncome && (
                <div className="income-graph-bars">
                  {incomeByMonth.length > 0
                    ? incomeByMonth.map(({ month, total }) => (
                        <div key={month} className="income-bar-wrap">
                          <span className="income-bar-value">S/ {Number(total).toFixed(0)}</span>
                          <div
                            className="income-bar"
                            style={{ height: `${Math.max(12, (total / maxIncome) * 140)}px` }}
                          />
                          <span className="income-bar-label">{month}</span>
                        </div>
                      ))
                    : stats && (
                        <>
                          <div className="income-bar-wrap">
                            <span className="income-bar-value">
                              S/ {Number(stats.incomePreviousMonth ?? 0).toFixed(0)}
                            </span>
                            <div
                              className="income-bar"
                              style={{
                                height: `${Math.max(12, ((stats.incomePreviousMonth ?? 0) / maxIncome) * 140)}px`,
                              }}
                            />
                            <span className="income-bar-label">{stats.previousMonthLabel || 'Prev'}</span>
                          </div>
                          <div className="income-bar-wrap">
                            <span className="income-bar-value">
                              S/ {Number(stats.incomeCurrentMonth ?? 0).toFixed(0)}
                            </span>
                            <div
                              className="income-bar"
                              style={{
                                height: `${Math.max(12, ((stats.incomeCurrentMonth ?? 0) / maxIncome) * 140)}px`,
                              }}
                            />
                            <span className="income-bar-label">{stats.currentMonthLabel || 'Current'}</span>
                          </div>
                        </>
                      )}
                </div>
              )}
            </section>

            {/* Live tracking: live drivers list */}
            <section className="live-tracking-section">
              <h3>Live tracking</h3>
              <p className="live-tracking-count">
                {stats?.liveDrivers?.length ?? 0} driver(s) currently online
              </p>
              <div className="live-drivers-list">
                {(stats?.liveDrivers ?? []).length === 0 ? (
                  <p className="page-placeholder-desc">No drivers live at the moment.</p>
                ) : (
                  (stats?.liveDrivers ?? []).map((d, i) => (
                    <div key={d.driverId || i} className="live-driver-row">
                      <span>{String(d.driverId).slice(0, 20)}</span>
                      <span className="vehicle-badge">{VEHICLE_LABELS[d.vehicleType] || d.vehicleType}</span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        )}
      </div>

      {/* Modal: Total / Active drivers by vehicle */}
      {driverModal && (
        <div
          className="driver-breakdown-overlay"
          onClick={() => setDriverModal(null)}
          role="presentation"
        >
          <div className="driver-breakdown-modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              {driverModal === 'total' ? 'Total drivers by vehicle' : 'Active drivers by vehicle'}
            </h3>
            <ul className="driver-breakdown-list">
              {['car', 'bike', 'taxi', 'van', 'truck', 'car_hauler', 'ambulance'].map((vt) => (
                <li key={vt}>
                  <span>{VEHICLE_LABELS[vt]}</span>
                  <span className="count">
                    {driverModal === 'total'
                      ? (stats?.totalDriversByVehicle?.[vt] ?? 0)
                      : (stats?.activeDriversByVehicle?.[vt] ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
            <button type="button" className="dashboard-btn" style={{ marginTop: '1rem' }} onClick={() => setDriverModal(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default Dashboard
