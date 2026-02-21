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
  const colors = { ok: "#00ff9d", down: "#ff4e53", warn: "#ffaa00", nc: "#6b7280" }
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
  const colors = { ok:"#00ff9d", down:"#ff4e53", nc:"#6b7280", warn:"#ffaa00" }
  const color = colors[status]
  return (
    <div style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:"1px solid #1f2937",transition:"background 0.2s",background:status==="down"?"#2d1619":"transparent" }}>
      <Bullet status={status} />
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" }}>
          <span style={{ fontSize:14,fontWeight:500,color:"#e5e7eb" }}>{label}</span>
          {endpoint && <code style={{ fontSize:11,color:"#4b5563",background:"#1f2937",borderRadius:4,padding:"2px 6px" }}>{endpoint}</code>}
        </div>
        <div style={{ marginTop:5,height:4,borderRadius:2,background:"#1f2937",overflow:"hidden" }}>
          <div style={{ height:"100%",width:barW+"%",background:color,borderRadius:2,transition:"width 0.5s" }} />
        </div>
      </div>
      <div style={{ textAlign:"right",minWidth:80,flexShrink:0 }}>
        <span style={{ fontSize:13,fontWeight:700,color }}>{notConfigured?"N/A":ok?"UP":"DOWN"}</span>
        <div style={{ fontSize:12,color:"#6b7280" }}>{count} req {pct.toFixed(1)}%</div>
      </div>
    </div>
  )
}

function ServiceCard({ icon: Icon, title, ok, configured=true, msg }) {
  const status = !configured ? "nc" : ok ? "ok" : "down"
  const colors = { ok:"#00ff9d", down:"#ff4e53", nc:"#6b7280" }
  const color = colors[status]
  return (
    <div style={{ background:"linear-gradient(145deg, #1a202c, #16202e)",border:"1px solid "+color+"33",borderRadius:14,padding:"16px 18px",display:"flex",alignItems:"center",gap:16,boxShadow:"0 4px 6px rgba(0,0,0,0.3), inset 0 0 10px rgba(0,255,157,0.1)" }}>
      <div style={{ width:42,height:42,borderRadius:12,background:color+"22",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 0 8px "+color+"44" }}>
        <Icon size={22} color={color} />
      </div>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <Bullet status={status} />
          <span style={{ fontSize:15,fontWeight:600,color:"#f3f4f6" }}>{title}</span>
        </div>
        {msg && <span style={{ fontSize:12,color:"#9ca3af",display:"block",marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{msg}</span>}
      </div>
      <span style={{ fontSize:14,fontWeight:700,color,flexShrink:0 }}>{!configured?"N/A":ok?"OK":"DOWN"}</span>
    </div>
  )
}

function Section({ icon: Icon, title, color="#f97316", badge, children }) {
  return (
    <div style={{ background:"#0f172a",border:"1px solid #1e293b",borderRadius:16,overflow:"hidden",marginBottom:24,boxShadow:"0 4px 10px rgba(0,0,0,0.4)" }}>
      <div style={{ display:"flex",alignItems:"center",gap:12,padding:"16px 20px",borderBottom:"1px solid #1e293b",background:"linear-gradient(to right, #111827, #141925)" }}>
        <Icon size={18} color={color} />
        <span style={{ fontWeight:700,fontSize:15,color:"#f3f4f6",flex:1 }}>{title}</span>
        {badge && <span style={{ fontSize:12,background:"#1f2937",color:"#9ca3af",borderRadius:14,padding:"3px 12px" }}>{badge}</span>}
      </div>
      <div style={{ padding:"6px 20px 16px" }}>{children}</div>
    </div>
  )
}

function StatTile({ icon: Icon, value, label, color="#f97316" }) {
  return (
    <div style={{ background:"linear-gradient(145deg, #1a202c, #16202e)",border:"1px solid #1e293b",borderRadius:14,padding:"18px",display:"flex",flexDirection:"column",alignItems:"center",gap:8,textAlign:"center",boxShadow:"0 3px 5px rgba(0,0,0,0.3)" }}>
      <Icon size={24} color={color} />
      <span style={{ fontSize:24,fontWeight:700,color:"#f3f4f6" }}>{value}</span>
      <span style={{ fontSize:12,color:"#9ca3af" }}>{label}</span>
    </div>
  )
}

function RestartModal({ onConfirm, onCancel, restarting }) {
  return (
    <div style={{ position:"fixed",inset:0,background:"#000000dd",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:"linear-gradient(to bottom, #1f2937, #18212e)",borderRadius:18,padding:36,maxWidth:440,width:"100%",border:"1px solid #374151",boxShadow:"0 10px 30px rgba(0,0,0,0.5)" }}>
        <div style={{ display:"flex",alignItems:"center",gap:14,marginBottom:16 }}>
          <Power size={28} color="#ff4e53" />
          <h2 style={{ margin:0,color:"#f3f4f6",fontSize:20 }}>Restart Backend?</h2>
        </div>
        <p style={{ color:"#a0aec0",fontSize:15,margin:"0 0 28px",lineHeight:1.7 }}>
          This will immediately restart the backend on Elastic Beanstalk. The server will be unavailable for ~10 seconds. All active socket connections will drop temporarily.
        </p>
        <div style={{ display:"flex",gap:14,justifyContent:"flex-end" }}>
          <button onClick={onCancel} disabled={restarting} style={{ padding:"12px 24px",borderRadius:10,border:"1px solid #374151",background:"transparent",color:"#9ca3af",cursor:"pointer",fontSize:15,transition:"all 0.2s" }}>Cancel</button>
          <button onClick={onConfirm} disabled={restarting} style={{ padding:"12px 24px",borderRadius:10,border:"none",background:"#ff4e53",color:"#fff",cursor:restarting?"not-allowed":"pointer",fontSize:15,fontWeight:600,display:"flex",alignItems:"center",gap:10,opacity:restarting?0.7:1,transition:"all 0.2s" }}>
            {restarting ? <><Loader2 size={18} className="spin" /> Restarting...</> : <><Power size={16}/> Yes, Restart Now</>}
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
    setLoading(true)
    setError("")
    if (isManual) setRefreshing(true)
    try {
      const res = await api.getHealthStatus()
      setData(res.data)
    } catch (err) {
      setError(err.message || "Failed to fetch health status")
    } finally {
      setLoading(false)
      if (isManual) setTimeout(() => setRefreshing(false), 500)
      setSecondsAgo(0)
    }
  }, [])

  useEffect(() => {
    fetchHealth(true)
    const interval = setInterval(() => {
      fetchHealth(false)
      if (data?.timestamp) {
        const ts = new Date(data.timestamp).getTime()
        const now = Date.now()
        setSecondsAgo(Math.round((now - ts) / 1000))
      }
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchHealth, data?.timestamp])

  const doRestart = async () => {
    setRestarting(true)
    setRestartMsg("")
    try {
      await api.restartBackend()
      setRestartMsg("Backend restarted successfully. Wait 10-15 seconds for full recovery.")
      setTimeout(() => {
        setShowRestart(false)
        setRestarting(false)
        fetchHealth(true)
      }, 5000)
    } catch (err) {
      setRestartMsg("Failed to restart: " + err.message)
      setTimeout(() => setRestarting(false), 1000)
    }
  }

  const d = data || {}
  return (
    <>
      <style>{`
        @keyframes health-ping {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.5); }
        }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
      {showRestart && <RestartModal onConfirm={doRestart} onCancel={() => setShowRestart(false)} restarting={restarting} />}
      <div style={{ background:"linear-gradient(to bottom, #0f172a, #1a202c)",minHeight:"100vh",color:"#fff",padding:24 }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:30,gap:16,flexWrap:"wrap" }}>
          <div>
            <h1 style={{ fontSize:28,margin:0,color:"#f3f4f6",display:"flex",alignItems:"center",gap:12 }}><Globe size={28} color="#f97316" /> TBidder System Health</h1>
            <span style={{ fontSize:14,color:"#9ca3af",display:"block",marginTop:6 }}>
              {loading ? "Loading..." : data ? `Updated ${secondsAgo}s ago` : error || "Not loaded"}
            </span>
          </div>
          <div style={{ display:"flex",gap:12 }}>
            <button onClick={() => fetchHealth(true)} disabled={refreshing} style={{ background:"#f97316",border:"none",color:"#fff",padding:"10px 20px",borderRadius:8,cursor:refreshing?"not-allowed":"pointer",fontSize:14,fontWeight:500,display:"flex",alignItems:"center",gap:8,opacity:refreshing?0.7:1,transition:"all 0.2s" }}>
              {refreshing ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />} Refresh
            </button>
            <button onClick={() => setShowRestart(true)} style={{ background:"#dc2626",border:"none",color:"#fff",padding:"10px 20px",borderRadius:8,cursor:"pointer",fontSize:14,fontWeight:500,display:"flex",alignItems:"center",gap:8,transition:"all 0.2s" }}>
              <Power size={16} /> Restart Backend
            </button>
          </div>
        </div>
        {restartMsg && <div style={{ padding:16,background:"#2d1619",borderRadius:10,marginBottom:20,color:"#fff",display:"flex",alignItems:"center",gap:12 }}><AlertTriangle size={20} color="#ff4e53" /> {restartMsg}</div>}
        {loading ? (
          <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:300,gap:16 }}>
            <Loader2 size={32} color="#f97316" className="spin" />
            <span style={{ color:"#9ca3af" }}>Loading system health data...</span>
          </div>
        ) : error ? (
          <div style={{ padding:24,background:"#2d1619",borderRadius:12,marginBottom:20,color:"#f87171",textAlign:"center" }}>{error}</div>
        ) : (
          <>
            <Section icon={Server} title="Core Services" color="#f97316">
              <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16,paddingTop:12 }}>
                <ServiceCard icon={Server} title="Backend API" ok={d.services?.backend} />
                <ServiceCard icon={Zap} title="Database (PostgreSQL)" ok={d.ok} msg={d.db} />
                <ServiceCard icon={Mail} title="Email Service (AWS SES)" ok={d.email?.ok} configured={d.email?.provider !== "not configured"} msg={d.email?.msg} />
                <ServiceCard icon={Globe} title="Google Maps API" ok={d.googleMaps?.ok} msg={d.googleMaps?.msg} />
              </div>
            </Section>

            <Section icon={Radio} title="API Traffic (last 24h)" color="#3b82f6" badge="live">
              <div style={{ display:"flex",flexWrap:"wrap",gap:20,paddingTop:12 }}>
                <div style={{ flex:1,minWidth:200 }}>
                  <h3 style={{ fontSize:14,fontWeight:600,color:"#f3f4f6",margin:"0 0 12px" }}>User App</h3>
                  <ApiRow label="All APIs" ok={d.traffic?.userApp?.ok} traffic={d.traffic?.userApp} />
                  <ApiRow label="Rides" endpoint="/api/v1/rides" ok={d.apis?.userApp?.rides} traffic={d.traffic?.userApp?.rides} />
                  <ApiRow label="Google Places" endpoint="/api/v1/places/*" ok={d.services?.places} notConfigured={d.services?.placesMsg==="No API key"} traffic={d.traffic?.userApp?.places} />
                  <ApiRow label="Place Details" endpoint="/api/v1/places/details" ok={d.apis?.userApp?.placesDetails} traffic={d.traffic?.userApp?.placesDetails} />
                  <ApiRow label="Google Directions" endpoint="/api/v1/directions" ok={d.services?.directions} notConfigured={d.services?.directionsMsg==="No API key"} traffic={d.traffic?.userApp?.directions} />
                  <ApiRow label="Payment Gateway (dLocal)" endpoint="dlocal.com" ok={d.services?.paymentGateway?.ok} notConfigured={!d.services?.paymentGateway?.configured} />
                  <ApiRow label="SMTP Email" endpoint="smtp" ok={d.services?.smtp?.ok} notConfigured={d.services?.smtp?.msg==="SMTP_HOST not set"} />
                </div>
                <div style={{ flex:1,minWidth:200 }}>
                  <h3 style={{ fontSize:14,fontWeight:600,color:"#f3f4f6",margin:"0 0 12px" }}>Driver App</h3>
                  <ApiRow label="All APIs" ok={d.traffic?.driverApp?.ok} traffic={d.traffic?.driverApp} />
                  <ApiRow label="Rides" endpoint="/api/v1/rides" ok={d.apis?.driverApp?.rides} traffic={d.traffic?.driverApp?.rides} />
                  <ApiRow label="Google Places" endpoint="/api/v1/places/*" ok={d.services?.places} notConfigured={d.services?.placesMsg==="No API key"} traffic={d.traffic?.driverApp?.places} />
                  <ApiRow label="Place Details" endpoint="/api/v1/places/details" ok={d.apis?.driverApp?.placesDetails} traffic={d.traffic?.driverApp?.placesDetails} />
                  <ApiRow label="Google Directions" endpoint="/api/v1/directions" ok={d.services?.directions} notConfigured={d.services?.directionsMsg==="No API key"} traffic={d.traffic?.driverApp?.directions} />
                </div>
              </div>
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

            <Section icon={Activity} title="Business Health (Live)" color="#00ff9d">
              <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:16,paddingTop:14 }}>
                <StatTile icon={Users} value={d.stats?.onlineDrivers??0} label="Online drivers" color="#00ff9d" />
                <StatTile icon={ShieldCheck} value={d.stats?.pendingVerifications??0} label="Pending verifications" color="#ffaa00" />
                <StatTile icon={Clock} value={d.stats?.pendingRides??0} label="Pending rides" color="#3b82f6" />
                <StatTile icon={Car} value={d.stats?.activeRides??0} label="Active rides" color="#06b6d4" />
                <StatTile icon={Hash} value={d.stats?.totalRides??0} label="Total rides" color="#8b5cf6" />
                <StatTile icon={Users} value={d.stats?.totalUsers??0} label="Total users" color="#ec4899" />
                <StatTile icon={Truck} value={d.stats?.totalDrivers??0} label="Total drivers" color="#f97316" />
                <StatTile icon={Wallet} value={d.stats?.pendingWalletRecharge??0} label="Pending recharge" color="#ffaa00" />
                <StatTile icon={Banknote} value={d.stats?.pendingPayouts??0} label="Pending payouts" color="#ff4e53" />
                <StatTile icon={CalendarCheck} value={d.stats?.pendingTourBookings??0} label="Tour bookings" color="#14b8a6" />
                <StatTile icon={Car} value={d.stats?.completedRidesToday??0} label="Rides today" color="#00ff9d" />
                <StatTile icon={Banknote} value={"S/"+(d.stats?.totalRevenue??0).toFixed(0)} label="Total revenue" color="#00ff9d" />
              </div>
            </Section>
          </>
        )}
      </div>
    </>
  )
}

export default TBidderHealth
