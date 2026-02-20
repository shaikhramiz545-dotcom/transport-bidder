import { useState, useEffect, useCallback } from "react"
import {
  Activity, Users, ShieldCheck, Clock, Hash, RefreshCw, Loader2,
  Smartphone, Truck, LayoutDashboard, Building2, Server, Globe,
  Radio, Zap, AlertTriangle, Car, Wallet, Banknote, CalendarCheck,
  Power, Upload, CreditCard, Mail
} from "lucide-react"
import api from "../services/api"
import "../App.css"

const REFRESH_INTERVAL_MS = 15000

function Bullet({ status }) {
  const colors = { ok: "#22c55e", down: "#ef4444", warn: "#f59e0b", nc: "#6b7280" }
  const color = colors[status] || colors.nc
  return (
    <span style={{ position:"relative",display:"inline-flex",alignItems:"center",justifyContent:"center",width:14,height:14,flexShrink:0 }}>
      {status==="ok" && <span style={{ position:"absolute",inset:0,borderRadius:"50%",background:color,opacity:0.35,animation:"health-ping 1.4s cubic-bezier(0,0,0.2,1) infinite" }} />}
      <span style={{ width:10,height:10,borderRadius:"50%",background:color,display:"block",flexShrink:0 }} />
    </span>
  )
}

function ApiRow({ label, endpoint, ok, notConfigured, traffic }) {
  const status = notConfigured ? "nc" : ok===true ? "ok" : ok===false ? "down" : "nc"
  const count = traffic?.count ?? 0
  const pct = parseFloat(traffic?.percent ?? "0")
  const barW = Math.min(pct * 3, 100)
  const colors = { ok:"#22c55e", down:"#ef4444", nc:"#6b7280", warn:"#f59e0b" }
  const color = colors[status]
  return (
    <div style={{ display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid #1f2937" }}>
      <Bullet status={status} />
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" }}>
          <span style={{ fontSize:13,fontWeight:500,color:"#e5e7eb" }}>{label}</span>
          {endpoint && <code style={{ fontSize:10,color:"#4b5563",background:"#1f2937",borderRadius:3,padding:"1px 5px" }}>{endpoint}</code>}
        </div>
        <div style={{ marginTop:4,height:3,borderRadius:2,background:"#1f2937",overflow:"hidden" }}>
          <div style={{ height:"100%",width:barW+"%",background:color,borderRadius:2,transition:"width 0.5s" }} />
        </div>
      </div>
      <div style={{ textAlign:"right",minWidth:80,flexShrink:0 }}>
        <span style={{ fontSize:12,fontWeight:700,color }}>{notConfigured?"N/A":ok?"UP":"DOWN"}</span>
        <div style={{ fontSize:11,color:"#6b7280" }}>{count} req {pct.toFixed(1)}%</div>
      </div>
    </div>
  )
}

function ServiceCard({ icon: Icon, title, ok, configured=true, msg }) {
  const status = !configured ? "nc" : ok ? "ok" : "down"
  const colors = { ok:"#22c55e", down:"#ef4444", nc:"#6b7280" }
  const color = colors[status]
  return (
    <div style={{ background:"#111827",border:"1px solid "+color+"44",borderRadius:12,padding:"14px 16px",display:"flex",alignItems:"center",gap:14 }}>
      <div style={{ width:40,height:40,borderRadius:10,background:color+"18",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
        <Icon size={20} color={color} />
      </div>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
          <Bullet status={status} />
          <span style={{ fontSize:14,fontWeight:600,color:"#f3f4f6" }}>{title}</span>
        </div>
        {msg && <span style={{ fontSize:11,color:"#6b7280",display:"block",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{msg}</span>}
      </div>
      <span style={{ fontSize:13,fontWeight:700,color,flexShrink:0 }}>{!configured?"N/A":ok?"OK":"DOWN"}</span>
    </div>
  )
}

function Section({ icon: Icon, title, color="#f97316", badge, children }) {
  return (
    <div style={{ background:"#0f172a",border:"1px solid #1e293b",borderRadius:14,overflow:"hidden",marginBottom:20 }}>
      <div style={{ display:"flex",alignItems:"center",gap:10,padding:"13px 18px",borderBottom:"1px solid #1e293b",background:"#111827" }}>
        <Icon size={17} color={color} />
        <span style={{ fontWeight:700,fontSize:14,color:"#f3f4f6",flex:1 }}>{title}</span>
        {badge && <span style={{ fontSize:11,background:"#1f2937",color:"#9ca3af",borderRadius:12,padding:"2px 10px" }}>{badge}</span>}
      </div>
      <div style={{ padding:"4px 18px 12px" }}>{children}</div>
    </div>
  )
}

function StatTile({ icon: Icon, value, label, color="#f97316" }) {
  return (
    <div style={{ background:"#111827",border:"1px solid #1e293b",borderRadius:12,padding:"16px",display:"flex",flexDirection:"column",alignItems:"center",gap:6,textAlign:"center" }}>
      <Icon size={22} color={color} />
      <span style={{ fontSize:22,fontWeight:700,color:"#f3f4f6" }}>{value}</span>
      <span style={{ fontSize:11,color:"#6b7280" }}>{label}</span>
    </div>
  )
}

function RestartModal({ onConfirm, onCancel, restarting }) {
  return (
    <div style={{ position:"fixed",inset:0,background:"#000000cc",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:"#1f2937",borderRadius:16,padding:32,maxWidth:420,width:"100%",border:"1px solid #374151" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:14 }}>
          <Power size={26} color="#ef4444" />
          <h2 style={{ margin:0,color:"#f3f4f6",fontSize:18 }}>Restart Backend?</h2>
        </div>
        <p style={{ color:"#9ca3af",fontSize:14,margin:"0 0 24px",lineHeight:1.7 }}>
          This will immediately restart the backend on Elastic Beanstalk. The server will be unavailable for ~10 seconds. All active socket connections will drop temporarily.
        </p>
        <div style={{ display:"flex",gap:12,justifyContent:"flex-end" }}>
          <button onClick={onCancel} disabled={restarting} style={{ padding:"10px 20px",borderRadius:8,border:"1px solid #374151",background:"transparent",color:"#9ca3af",cursor:"pointer",fontSize:14 }}>Cancel</button>
          <button onClick={onConfirm} disabled={restarting} style={{ padding:"10px 20px",borderRadius:8,border:"none",background:"#dc2626",color:"#fff",cursor:restarting?"not-allowed":"pointer",fontSize:14,fontWeight:600,display:"flex",alignItems:"center",gap:8,opacity:restarting?0.7:1 }}>
            {restarting ? <><Loader2 size={16} className="spin" /> Restarting...</> : <><Power size={15}/> Yes, Restart Now</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function TBidderHealth() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [refreshing, setRefreshing] = useState(false)
  const [secondsAgo, setSecondsAgo] = useState(0)
  const [showRestart, setShowRestart] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [restartMsg, setRestartMsg] = useState("")

  const fetchHealth = useCallback(async (isManual=false) => {
    if (isManual) setRefreshing(true); else if (!data) setLoading(true)
    setError("")
    try {
      const { data: res } = await api.get("/admin/health-status")
      setData(res); setSecondsAgo(0)
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Backend not reachable")
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }, [data])

  useEffect(() => { fetchHealth() }, [])

  useEffect(() => {
    if (loading || error) return
    const t = setInterval(() => fetchHealth(), REFRESH_INTERVAL_MS)
    return () => clearInterval(t)
  }, [loading, error])

  useEffect(() => {
    if (!data || error) return
    const tick = setInterval(() => setSecondsAgo(s => Math.min(s+1, REFRESH_INTERVAL_MS/1000)), 1000)
    return () => clearInterval(tick)
  }, [data, error])

  const handleRestart = async () => {
    setRestarting(true)
    try {
      const { data: r } = await api.post("/admin/restart")
      setRestartMsg(r.message || "Restarting...")
      setShowRestart(false)
      setTimeout(() => { setRestartMsg(""); fetchHealth(true) }, 12000)
    } catch (err) {
      setRestartMsg("Restart failed: " + (err.response?.data?.message || err.message))
      setShowRestart(false)
    } finally {
      setRestarting(false)
    }
  }

  const d = data
  const allOk = d?.ok ?? false
  const fs = d?.services?.firestore
  const fsNC = fs && fs.configured === false
  const emailData = d?.services?.msg91
  const emailNC = emailData && emailData.configured === false

  const allApiValues = d ? Object.values(d.apis || {}).flatMap(g => typeof g === "object" ? Object.values(g) : [g]) : []
  const totalApis = allApiValues.length
  const okApis = allApiValues.filter(Boolean).length

  return (
    <>
      {showRestart && <RestartModal onConfirm={handleRestart} onCancel={() => setShowRestart(false)} restarting={restarting} />}
      <style>{`@keyframes health-ping{0%{transform:scale(1);opacity:0.4}70%{transform:scale(2.2);opacity:0}100%{transform:scale(2.2);opacity:0}}`}</style>

      <header className="dashboard-header">
        <h1 className="dashboard-header-title">
          <Activity size={26} style={{ marginRight:"0.5rem",verticalAlign:"middle" }} />
          TBidder Health
          <span className="health-live-badge"><span className="health-live-dot" />LIVE</span>
        </h1>
        <div className="dashboard-header-actions">
          {data && !error && <span className="health-updated-ago">Updated {secondsAgo}s ago</span>}
          <button type="button" className="dashboard-btn" onClick={() => fetchHealth(true)} disabled={refreshing}>
            {refreshing ? <Loader2 size={17} className="spin" /> : <RefreshCw size={17} />}
            <span>{refreshing?"Checking...":"Refresh"}</span>
          </button>
          <button type="button" onClick={() => setShowRestart(true)}
            style={{ display:"flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:8,border:"1px solid #ef4444",background:"transparent",color:"#ef4444",cursor:"pointer",fontSize:13,fontWeight:600 }}>
            <Power size={15}/> Restart Backend
          </button>
        </div>
      </header>

      {restartMsg && (
        <div style={{ margin:"12px 24px 0",padding:"12px 16px",borderRadius:10,background:"#1f2937",border:"1px solid #374151",color:"#f3f4f6",fontSize:13 }}>
          {restartMsg}
        </div>
      )}

      <div className="dashboard-content">
        {loading && !data && (
          <div className="dashboard-loading"><Loader2 size={32} className="spin" /><span>Loading health status...</span></div>
        )}
        {error && (
          <div className="health-error-banner">
            <div style={{ fontSize:22 }}>X</div>
            <div><strong>Backend not reachable</strong><p>{error}</p></div>
          </div>
        )}

        {data && !error && (
          <>
            <div style={{ display:"flex",alignItems:"center",gap:16,flexWrap:"wrap",padding:"12px 18px",borderRadius:12,background:allOk?"#052e16":"#1c0a0a",border:"1px solid "+(allOk?"#166534":"#7f1d1d"),marginBottom:20 }}>
              <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                <Bullet status={allOk?"ok":"down"} />
                <span style={{ fontWeight:700,fontSize:15,color:allOk?"#4ade80":"#f87171" }}>
                  {allOk?"All systems operational":"Some services degraded"}
                </span>
              </div>
              <span style={{ fontSize:12,color:"#6b7280",marginLeft:"auto" }}>
                {okApis}/{totalApis} APIs up &middot; {new Date(d.lastChecked).toLocaleTimeString()} &middot; Auto-refresh 15s &middot; Traffic last {d.trafficWindowSec||60}s
              </span>
            </div>

            <Section icon={Server} title="Infrastructure" color="#6366f1">
              <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:12,paddingTop:12 }}>
                <ServiceCard icon={Server} title="Backend API" ok={d.services?.backend} msg="Express + Node.js" />
                <ServiceCard icon={Server} title="PostgreSQL" ok={d.services?.database} msg="Primary database" />
                <ServiceCard icon={Server} title="Firestore" ok={fsNC?null:fs?.ok} configured={!fsNC} msg={fs?.msg || (fsNC?"Not configured":"Realtime DB")} />
                <ServiceCard icon={Mail} title="Email / AWS SES" ok={emailNC?null:emailData?.ok} configured={!emailNC} msg={emailData?.msg || (emailNC?"Not configured":"")} />
              </div>
            </Section>

            <Section icon={Activity} title="Live Metrics (last 60s)" color="#22c55e">
              <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:12,paddingTop:12 }}>
                <div className="health-live-metric-card"><Radio size={20}/><span className="health-live-metric-value">{d.live?.socketio?.connections??0}</span><span className="health-live-metric-label">Socket.io connections</span></div>
                <div className="health-live-metric-card"><Zap size={20}/><span className="health-live-metric-value">{d.live?.metrics?.avgResponseTimeMs??0}ms</span><span className="health-live-metric-label">Avg response time</span></div>
                <div className="health-live-metric-card"><AlertTriangle size={20}/><span className="health-live-metric-value">{d.live?.metrics?.errorRatePercent??0}%</span><span className="health-live-metric-label">Error rate</span></div>
                <div className="health-live-metric-card"><Server size={20}/><span className="health-live-metric-value">{d.live?.dbConnections??0}</span><span className="health-live-metric-label">DB connections</span></div>
              </div>
            </Section>

            <Section icon={Globe} title="External APIs" color="#3b82f6">
              <ApiRow label="Google Places (autocomplete)" endpoint="/api/v1/places/autocomplete" ok={d.services?.places} notConfigured={d.services?.placesMsg==="No API key"} traffic={d.traffic?.userApp?.places} />
              <ApiRow label="Google Places (details)" endpoint="/api/v1/places/details" ok={d.apis?.userApp?.placesDetails} traffic={d.traffic?.userApp?.placesDetails} />
              <ApiRow label="Google Directions" endpoint="/api/v1/directions" ok={d.services?.directions} notConfigured={d.services?.directionsMsg==="No API key"} traffic={d.traffic?.userApp?.directions} />
              <ApiRow label="Payment Gateway (dLocal)" endpoint="dlocal.com" ok={d.services?.paymentGateway?.ok} notConfigured={!d.services?.paymentGateway?.configured} />
              <ApiRow label="SMTP Email" endpoint="smtp" ok={d.services?.smtp?.ok} notConfigured={d.services?.smtp?.msg==="SMTP_HOST not set"} />
            </Section>

            <Section icon={Smartphone} title="Auth APIs (User + Driver shared)" color="#8b5cf6" badge="shared">
              <ApiRow label="Login (phone OTP)" endpoint="POST /api/v1/auth/login" ok={d.apis?.userApp?.auth} traffic={d.traffic?.userApp?.auth} />
              <ApiRow label="Verify OTP" endpoint="POST /api/v1/auth/verify" ok={d.apis?.userApp?.authVerify} traffic={d.traffic?.userApp?.authVerify} />
              <ApiRow label="Sign Up" endpoint="POST /api/v1/auth/signup" ok={d.apis?.userApp?.authSignup} traffic={d.traffic?.userApp?.authSignup} />
              <ApiRow label="Email Login" endpoint="POST /api/v1/auth/email-login" ok={d.apis?.userApp?.authEmailLogin} traffic={d.traffic?.userApp?.authEmailLogin} />
              <ApiRow label="Verify Email OTP" endpoint="POST /api/v1/auth/verify-email" ok={d.apis?.userApp?.authVerifyEmail} traffic={d.traffic?.userApp?.authVerifyEmail} />
              <ApiRow label="Forgot Password" endpoint="POST /api/v1/auth/forgot-password" ok={d.apis?.userApp?.authForgotPassword} traffic={d.traffic?.userApp?.authForgotPassword} />
            </Section>

            <Section icon={Smartphone} title="User App APIs" color="#06b6d4">
              <ApiRow label="Rides" endpoint="GET /api/v1/rides" ok={d.apis?.userApp?.rides} traffic={d.traffic?.userApp?.rides} />
              <ApiRow label="Tour Ticker Messages" endpoint="GET /api/v1/tours/ticker-messages" ok={d.apis?.userApp?.tourTicker} traffic={d.traffic?.userApp?.tourTicker} />
              <ApiRow label="Tour Feature Flag" endpoint="GET /api/v1/tours/feature-flag" ok={d.apis?.userApp?.tourFeatureFlag} traffic={d.traffic?.userApp?.tourFeatureFlag} />
            </Section>

            <Section icon={Truck} title="Driver App APIs" color="#f97316">
              <ApiRow label="Driver Requests" endpoint="GET /api/v1/drivers/requests" ok={d.apis?.driverApp?.drivers} traffic={d.traffic?.driverApp?.drivers} />
              <ApiRow label="Verification Status" endpoint="GET /api/v1/drivers/verification-status" ok={d.apis?.driverApp?.driverVerification} traffic={d.traffic?.driverApp?.driverVerification} />
              <ApiRow label="Document Upload" endpoint="POST /api/v1/drivers/documents" ok={d.apis?.driverApp?.driverDocuments} traffic={d.traffic?.driverApp?.driverDocuments} />
              <ApiRow label="Verification Submit" endpoint="POST /api/v1/drivers/verification-register" ok={d.apis?.driverApp?.driverVerificationRegister} traffic={d.traffic?.driverApp?.driverVerificationRegister} />
              <ApiRow label="Wallet Balance" endpoint="GET /api/v1/wallet/balance" ok={d.apis?.driverApp?.wallet} traffic={d.traffic?.driverApp?.wallet} />
              <ApiRow label="Wallet Transactions" endpoint="GET /api/v1/wallet/transactions" ok={d.apis?.driverApp?.walletTransactions} traffic={d.traffic?.driverApp?.walletTransactions} />
              <ApiRow label="Wallet Recharge" endpoint="POST /api/v1/wallet/recharge" ok={d.apis?.driverApp?.walletRecharge} traffic={d.traffic?.driverApp?.walletRecharge} />
              <ApiRow label="Rides" endpoint="GET /api/v1/rides" ok={d.apis?.driverApp?.rides} traffic={d.traffic?.driverApp?.rides} />
            </Section>

            <Section icon={LayoutDashboard} title="Admin Panel APIs" color="#ec4899">
              <ApiRow label="Admin Stats" endpoint="GET /api/v1/admin/stats" ok={d.apis?.adminPanel?.admin} traffic={d.traffic?.adminPanel?.admin} />
              <ApiRow label="Health Status" endpoint="GET /api/v1/admin/health-status" ok={d.services?.backend} />
              <ApiRow label="Backend Restart" endpoint="POST /api/v1/admin/restart" ok={d.services?.backend} />
            </Section>

            <Section icon={Building2} title="Partner Portal (Agency) APIs" color="#14b8a6">
              <ApiRow label="Tours List" endpoint="GET /api/v1/tours" ok={d.apis?.partnerPanel?.tours} traffic={d.traffic?.partnerPanel?.tours} />
              <ApiRow label="Tour Bookings" endpoint="POST /api/v1/tours/bookings" ok={d.apis?.partnerPanel?.tourBookings} traffic={d.traffic?.partnerPanel?.tourBookings} />
              <ApiRow label="Agency Profile" endpoint="GET /api/v1/agency/me" ok={d.apis?.partnerPanel?.agency} traffic={d.traffic?.partnerPanel?.agency} />
              <ApiRow label="Agency Signup" endpoint="POST /api/v1/agency/signup" ok={d.apis?.partnerPanel?.agencySignup} traffic={d.traffic?.partnerPanel?.agencySignup} />
              <ApiRow label="Agency Login" endpoint="POST /api/v1/agency/login" ok={d.apis?.partnerPanel?.agencyLogin} traffic={d.traffic?.partnerPanel?.agencyLogin} />
              <ApiRow label="Agency Payouts" endpoint="GET /api/v1/agency/payout-requests" ok={d.apis?.partnerPanel?.agencyPayouts} traffic={d.traffic?.partnerPanel?.agencyPayouts} />
              <ApiRow label="Agency Wallet" endpoint="GET /api/v1/agency/wallet" ok={d.apis?.partnerPanel?.agencyWallet} traffic={d.traffic?.partnerPanel?.agencyWallet} />
              <ApiRow label="File Uploads" endpoint="/uploads/" ok={d.apis?.uploads} traffic={d.traffic?.uploads} />
            </Section>

            <Section icon={Activity} title="Business Health (Live)" color="#22c55e">
              <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:12,paddingTop:12 }}>
                <StatTile icon={Users} value={d.stats?.onlineDrivers??0} label="Online drivers" color="#22c55e" />
                <StatTile icon={ShieldCheck} value={d.stats?.pendingVerifications??0} label="Pending verifications" color="#f59e0b" />
                <StatTile icon={Clock} value={d.stats?.pendingRides??0} label="Pending rides" color="#3b82f6" />
                <StatTile icon={Car} value={d.stats?.activeRides??0} label="Active rides" color="#06b6d4" />
                <StatTile icon={Hash} value={d.stats?.totalRides??0} label="Total rides" color="#8b5cf6" />
                <StatTile icon={Users} value={d.stats?.totalUsers??0} label="Total users" color="#ec4899" />
                <StatTile icon={Truck} value={d.stats?.totalDrivers??0} label="Total drivers" color="#f97316" />
                <StatTile icon={Wallet} value={d.stats?.pendingWalletRecharge??0} label="Pending recharge" color="#f59e0b" />
                <StatTile icon={Banknote} value={d.stats?.pendingPayouts??0} label="Pending payouts" color="#ef4444" />
                <StatTile icon={CalendarCheck} value={d.stats?.pendingTourBookings??0} label="Tour bookings" color="#14b8a6" />
                <StatTile icon={Car} value={d.stats?.completedRidesToday??0} label="Rides today" color="#22c55e" />
                <StatTile icon={Banknote} value={"S/"+(d.stats?.totalRevenue??0).toFixed(0)} label="Total revenue" color="#22c55e" />
              </div>
            </Section>
          </>
        )}
      </div>
    </>
  )
}

export default TBidderHealth
