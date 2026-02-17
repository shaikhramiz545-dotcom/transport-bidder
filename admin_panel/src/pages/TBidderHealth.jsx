import { useState, useEffect } from 'react'
import {
  Activity, Users, ShieldCheck, Clock, Hash, RefreshCw, Loader2, CheckCircle2, XCircle,
  AlertCircle, Smartphone, Truck, LayoutDashboard, Building2, Server, Globe, Upload,
  Radio, Zap, AlertTriangle, CreditCard, Mail, Car, Wallet, Banknote, CalendarCheck
} from 'lucide-react'
import api from '../services/api'
import '../App.css'

const REFRESH_INTERVAL_MS = 15000

function StatusBadge({ ok, label, msg, notConfigured }) {
  let Icon = CheckCircle2
  let color = '#22c55e'
  let displayText = 'OK'
  if (notConfigured) {
    Icon = AlertCircle
    color = '#6b7280'
    displayText = 'Not configured'
  } else if (!ok) {
    Icon = msg && (msg.includes('key') || msg.includes('Not configured')) ? AlertCircle : XCircle
    color = msg && msg.includes('key') ? '#f59e0b' : '#ef4444'
    displayText = msg || 'Down'
  }
  return (
    <div className="health-status-badge" style={{ borderColor: color }}>
      <Icon size={20} color={color} />
      <div className="health-status-badge-text">
        <span className="health-status-badge-label">{label}</span>
        <span className="health-status-badge-value">{displayText}</span>
      </div>
    </div>
  )
}

function ApiStatusRow({ ok, label, notConfigured, traffic }) {
  let Icon = ok ? CheckCircle2 : XCircle
  let color = ok ? '#22c55e' : '#ef4444'
  if (notConfigured) {
    Icon = AlertCircle
    color = '#6b7280'
  }
  const count = traffic?.count ?? 0
  const percent = traffic?.percent ?? '0.0'
  return (
    <div className="health-api-row">
      <Icon size={18} color={color} />
      <span className="health-api-label">{label}</span>
      <span className="health-api-traffic">{count} ({percent}%)</span>
    </div>
  )
}

function TBidderHealth() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [secondsAgo, setSecondsAgo] = useState(0)

  const fetchHealth = async (isManual = false) => {
    if (isManual) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const { data: res } = await api.get('/admin/health-status')
      setData(res)
      setSecondsAgo(0)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Backend not reachable. Run: cd backend && npm start')
      setData(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchHealth()
  }, [])

  useEffect(() => {
    if (loading || error) return
    const t = setInterval(() => fetchHealth(), REFRESH_INTERVAL_MS)
    return () => clearInterval(t)
  }, [loading, error])

  // Live "seconds ago" ticker
  useEffect(() => {
    if (!data || error) return
    const tick = setInterval(() => {
      setSecondsAgo((s) => Math.min(s + 1, REFRESH_INTERVAL_MS / 1000))
    }, 1000)
    return () => clearInterval(tick)
  }, [data, error])

  const allOk = data?.ok ?? false
  const firestoreData = data?.services?.firestore
  const firestoreNotConfigured = firestoreData && typeof firestoreData === 'object' && firestoreData.configured === false

  const msg91Data = data?.services?.msg91
  const msg91NotConfigured = msg91Data && typeof msg91Data === 'object' && msg91Data.configured === false

  return (
    <>
      <header className="dashboard-header">
        <h1 className="dashboard-header-title">
          <Activity size={28} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
          TBidder Health
          <span className="health-live-badge">
            <span className="health-live-dot" />
            LIVE
          </span>
        </h1>
        <div className="dashboard-header-actions">
          <span className="health-updated-ago">
            {data && !error && `Updated ${secondsAgo}s ago`}
          </span>
          <button
            type="button"
            className="dashboard-btn"
            onClick={() => fetchHealth(true)}
            disabled={refreshing}
          >
            {refreshing ? <Loader2 size={18} className="spin" /> : <RefreshCw size={18} />}
            <span>{refreshing ? 'Checking…' : 'Refresh'}</span>
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        {loading && !data && (
          <div className="dashboard-loading">
            <Loader2 size={32} className="spin" />
            <span>Loading health status…</span>
          </div>
        )}

        {error && (
          <div className="health-error-banner">
            <XCircle size={24} />
            <div>
              <strong>Backend not reachable</strong>
              <p>{error}</p>
              <p className="health-hint">Start backend: <code>cd backend && npm start</code></p>
            </div>
          </div>
        )}

        {data && !error && (
          <>
            <div className={`health-overall-badge ${allOk ? 'ok' : 'degraded'}`}>
              <span className="health-overall-text">
                {allOk ? 'All systems operational' : 'Some services degraded'}
              </span>
              <span className="health-last-checked">
                Last checked: {new Date(data.lastChecked).toLocaleTimeString()}
              </span>
              <span className="health-auto-refresh">
                Auto-refresh every 15s · Traffic % = last {data.trafficWindowSec || 60}s
              </span>
            </div>

            <section className="health-section">
              <h3>Infrastructure</h3>
              <div className="health-apis-grid">
                <div className="health-api-card">
                  <Server size={20} className="health-api-card-icon" />
                  <div className="health-api-card-body">
                    <ApiStatusRow ok={data.services?.backend} label="Backend API" />
                    <ApiStatusRow ok={data.services?.database} label="Database (PostgreSQL)" />
                    <ApiStatusRow
                      ok={firestoreNotConfigured ? null : firestoreData?.ok}
                      label={firestoreNotConfigured ? 'Firestore (Not configured)' : 'Firestore'}
                      notConfigured={firestoreNotConfigured}
                    />
                    <ApiStatusRow
                      ok={msg91NotConfigured ? null : msg91Data?.ok}
                      label={msg91NotConfigured ? 'MSG91 (Not configured)' : 'MSG91 (Email OTP)'}
                      notConfigured={msg91NotConfigured}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="health-section">
              <h3>Live Metrics (last 60s)</h3>
              <div className="health-live-metrics-grid">
                <div className="health-live-metric-card">
                  <Radio size={20} />
                  <span className="health-live-metric-value">{data.live?.socketio?.connections ?? 0}</span>
                  <span className="health-live-metric-label">Socket.io connections</span>
                </div>
                <div className="health-live-metric-card">
                  <Zap size={20} />
                  <span className="health-live-metric-value">{data.live?.metrics?.avgResponseTimeMs ?? 0}ms</span>
                  <span className="health-live-metric-label">Avg response time</span>
                </div>
                <div className="health-live-metric-card">
                  <AlertTriangle size={20} />
                  <span className="health-live-metric-value">{data.live?.metrics?.errorRatePercent ?? 0}%</span>
                  <span className="health-live-metric-label">Error rate</span>
                </div>
                <div className="health-live-metric-card">
                  <Server size={20} />
                  <span className="health-live-metric-value">{data.live?.dbConnections ?? 0}</span>
                  <span className="health-live-metric-label">DB connections</span>
                </div>
              </div>
            </section>

            <section className="health-section">
              <h3>External APIs & Services</h3>
              <div className="health-apis-grid">
                <div className="health-api-card">
                  <Globe size={20} className="health-api-card-icon" />
                  <div className="health-api-card-body">
                    <ApiStatusRow 
                      ok={data.services?.places} 
                      label="Places API" 
                      traffic={data.traffic?.userApp?.places}
                      notConfigured={!data.services?.places && data.services?.placesMsg === 'No API key'}
                    />
                    <ApiStatusRow 
                      ok={data.services?.directions} 
                      label="Directions API" 
                      traffic={data.traffic?.userApp?.directions}
                      notConfigured={!data.services?.directions && data.services?.directionsMsg === 'No API key'}
                    />
                  </div>
                </div>
                <div className="health-api-card">
                  <CreditCard size={20} className="health-api-card-icon" />
                  <div className="health-api-card-body">
                    <ApiStatusRow
                      ok={data.services?.paymentGateway?.configured ? data.services?.paymentGateway?.ok : null}
                      label={data.services?.paymentGateway?.configured ? 'Payment (dLocal)' : 'Payment (Not configured)'}
                      notConfigured={!data.services?.paymentGateway?.configured}
                    />
                  </div>
                </div>
                <div className="health-api-card">
                  <Mail size={20} className="health-api-card-icon" />
                  <div className="health-api-card-body">
                    <ApiStatusRow 
                      ok={data.services?.smtp?.ok} 
                      label="SMTP (Email)" 
                      notConfigured={!data.services?.smtp?.ok && (data.services?.smtp?.msg === 'Not configured' || data.services?.smtp?.msg?.includes('connect ECONNREFUSED'))}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="health-section">
              <h3>User App APIs</h3>
              <div className="health-apis-grid">
                <div className="health-api-card">
                  <Smartphone size={20} className="health-api-card-icon" />
                  <div className="health-api-card-body">
                    <ApiStatusRow ok={data.apis?.userApp?.places} label="Places (search)" traffic={data.traffic?.userApp?.places} />
                    <ApiStatusRow ok={data.apis?.userApp?.placesDetails} label="Places (details)" traffic={data.traffic?.userApp?.placesDetails} />
                    <ApiStatusRow ok={data.apis?.userApp?.directions} label="Directions (routes)" traffic={data.traffic?.userApp?.directions} />
                    <ApiStatusRow ok={data.apis?.userApp?.rides} label="Rides" traffic={data.traffic?.userApp?.rides} />
                    <ApiStatusRow ok={data.apis?.userApp?.auth} label="Auth (login)" traffic={data.traffic?.userApp?.auth} />
                    <ApiStatusRow ok={data.apis?.userApp?.authVerify} label="Auth (verify OTP)" traffic={data.traffic?.userApp?.authVerify} />
                    <ApiStatusRow ok={data.apis?.userApp?.tourTicker} label="Tour ticker" traffic={data.traffic?.userApp?.tourTicker} />
                    <ApiStatusRow ok={data.apis?.userApp?.tourFeatureFlag} label="Tour feature-flag" traffic={data.traffic?.userApp?.tourFeatureFlag} />
                  </div>
                </div>
              </div>
            </section>

            <section className="health-section">
              <h3>Driver App APIs</h3>
              <div className="health-apis-grid">
                <div className="health-api-card">
                  <Truck size={20} className="health-api-card-icon" />
                  <div className="health-api-card-body">
                    <ApiStatusRow ok={data.apis?.driverApp?.auth} label="Auth" traffic={data.traffic?.driverApp?.auth} />
                    <ApiStatusRow ok={data.apis?.driverApp?.drivers} label="Driver requests" traffic={data.traffic?.driverApp?.drivers} />
                    <ApiStatusRow ok={data.apis?.driverApp?.driverVerification} label="Driver verification" traffic={data.traffic?.driverApp?.driverVerification} />
                    <ApiStatusRow ok={data.apis?.driverApp?.wallet} label="Wallet (balance)" traffic={data.traffic?.driverApp?.wallet} />
                    <ApiStatusRow ok={data.apis?.driverApp?.walletTransactions} label="Wallet (transactions)" traffic={data.traffic?.driverApp?.walletTransactions} />
                    <ApiStatusRow ok={data.apis?.driverApp?.walletRecharge} label="Wallet (recharge)" traffic={data.traffic?.driverApp?.walletRecharge} />
                    <ApiStatusRow ok={data.apis?.driverApp?.rides} label="Rides" traffic={data.traffic?.driverApp?.rides} />
                  </div>
                </div>
              </div>
            </section>

            <section className="health-section">
              <h3>Admin Panel & Partner Panel APIs</h3>
              <div className="health-apis-grid health-apis-grid-two">
                <div className="health-api-card">
                  <LayoutDashboard size={20} className="health-api-card-icon" />
                  <div className="health-api-card-body">
                    <ApiStatusRow ok={data.apis?.adminPanel?.admin} label="Admin stats" traffic={data.traffic?.adminPanel?.admin} />
                  </div>
                </div>
                <div className="health-api-card">
                  <Building2 size={20} className="health-api-card-icon" />
                  <div className="health-api-card-body">
                    <ApiStatusRow ok={data.apis?.partnerPanel?.tours} label="Tours API" traffic={data.traffic?.partnerPanel?.tours} />
                    <ApiStatusRow ok={data.apis?.partnerPanel?.agency} label="Agency (me)" traffic={data.traffic?.partnerPanel?.agency} />
                    <ApiStatusRow ok={data.apis?.partnerPanel?.agencySignup} label="Agency (signup)" traffic={data.traffic?.partnerPanel?.agencySignup} />
                    <ApiStatusRow ok={data.apis?.partnerPanel?.agencyLogin} label="Agency (login)" traffic={data.traffic?.partnerPanel?.agencyLogin} />
                    <ApiStatusRow ok={data.apis?.partnerPanel?.agencyPayouts} label="Agency (payouts)" traffic={data.traffic?.partnerPanel?.agencyPayouts} />
                    <ApiStatusRow ok={data.apis?.partnerPanel?.agencyWallet} label="Agency (wallet)" traffic={data.traffic?.partnerPanel?.agencyWallet} />
                    <ApiStatusRow ok={data.apis?.partnerPanel?.tourBookings} label="Tour bookings" traffic={data.traffic?.partnerPanel?.tourBookings} />
                  </div>
                </div>
              </div>
            </section>

            <section className="health-section">
              <h3>Uploads & Static</h3>
              <div className="health-apis-grid">
                <div className="health-api-card">
                  <Upload size={20} className="health-api-card-icon" />
                  <div className="health-api-card-body">
                    <ApiStatusRow ok={data.apis?.uploads} label="Uploads (screenshots, docs)" traffic={data.traffic?.uploads} />
                  </div>
                </div>
              </div>
            </section>

            <section className="health-section">
              <h3>Business Health (Live)</h3>
              <div className="health-stats-grid">
                <div className="health-stat-card health-stat-card-live">
                  <Users size={24} />
                  <span className="health-stat-value">{data.stats?.onlineDrivers ?? 0}</span>
                  <span className="health-stat-label">Online drivers</span>
                </div>
                <div className="health-stat-card health-stat-card-live">
                  <ShieldCheck size={24} />
                  <span className="health-stat-value">{data.stats?.pendingVerifications ?? 0}</span>
                  <span className="health-stat-label">Pending verifications</span>
                </div>
                <div className="health-stat-card health-stat-card-live">
                  <Clock size={24} />
                  <span className="health-stat-value">{data.stats?.pendingRides ?? 0}</span>
                  <span className="health-stat-label">Pending rides</span>
                </div>
                <div className="health-stat-card health-stat-card-live">
                  <Car size={24} />
                  <span className="health-stat-value">{data.stats?.activeRides ?? 0}</span>
                  <span className="health-stat-label">Active rides</span>
                </div>
                <div className="health-stat-card health-stat-card-live">
                  <Hash size={24} />
                  <span className="health-stat-value">{data.stats?.totalRides ?? 0}</span>
                  <span className="health-stat-label">Total rides</span>
                </div>
                <div className="health-stat-card health-stat-card-live">
                  <Wallet size={24} />
                  <span className="health-stat-value">{data.stats?.pendingWalletRecharge ?? 0}</span>
                  <span className="health-stat-label">Pending wallet recharge</span>
                </div>
                <div className="health-stat-card health-stat-card-live">
                  <Banknote size={24} />
                  <span className="health-stat-value">{data.stats?.pendingPayouts ?? 0}</span>
                  <span className="health-stat-label">Pending payouts</span>
                </div>
                <div className="health-stat-card health-stat-card-live">
                  <CalendarCheck size={24} />
                  <span className="health-stat-value">{data.stats?.pendingTourBookings ?? 0}</span>
                  <span className="health-stat-label">Pending tour bookings</span>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </>
  )
}

export default TBidderHealth
