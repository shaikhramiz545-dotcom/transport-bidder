import { useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import * as Lucide from 'lucide-react'
import { FIRM_ADMIN_TITLE, FIRM_FEATURES, getFeatureByPath } from '../config/firm'
import { getAdminSession, hasPermission } from '../services/admin_session'
import '../App.css'

function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const session = getAdminSession()

  useEffect(() => {
    const feature = getFeatureByPath(location.pathname)
    if (feature?.permission && !hasPermission(feature.permission)) {
      // Redirect sub-users away from locked modules.
      navigate('/dashboard', { replace: true })
    }
  }, [location.pathname, navigate, session?.role, session?.permissions?.join(',')])

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login', { replace: true })
  }

  return (
    <div className="dashboard-layout">
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <img src="/logo.png" alt="TBidder" className="sidebar-logo" onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling?.classList?.add('show'); }} />
          <span className="sidebar-brand-text">T-Bidder</span>
        </div>
        <nav className="sidebar-nav">
          {FIRM_FEATURES.filter((feature) => hasPermission(feature.permission)).map(({ path, label, icon: iconName }) => {
            const Icon = Lucide[iconName] || Lucide.LayoutDashboard
            return (
              <a
                key={path}
                href={path}
                className={`sidebar-link ${location.pathname === path || (path !== '/' && location.pathname.startsWith(path)) ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault()
                  navigate(path)
                }}
              >
                <Icon size={20} />
                <span>{label}</span>
              </a>
            )
          })}
        </nav>
        <div className="sidebar-footer">
          {session && (
            <div style={{ padding: '0 0 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 8 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {session.name || session.email || 'Admin'}
              </div>
              {session.department && (
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,95,0,0.9)', marginTop: 2 }}>{session.department}</div>
              )}
              <div style={{
                display: 'inline-block',
                marginTop: 4,
                padding: '1px 6px',
                borderRadius: 4,
                fontSize: '0.65rem',
                fontWeight: 600,
                background: session.role === 'admin' ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.2)',
                color: session.role === 'admin' ? '#34d399' : '#60a5fa',
              }}>
                {session.role === 'admin' ? 'Admin' : 'Agent'}
              </div>
            </div>
          )}
          <button type="button" className="sidebar-footer-btn" onClick={handleLogout}>Logout</button>
        </div>
      </aside>
      <main className="dashboard-main">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
