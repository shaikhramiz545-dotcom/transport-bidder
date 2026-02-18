import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { MapPin, LayoutDashboard, List, PlusCircle, Wallet, CalendarCheck, LogOut, ShieldCheck } from 'lucide-react'
import api from '../services/api'
import './Layout.css'

const NAV = [
  { path: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { path: '/verification', label: 'Verification', icon: 'ShieldCheck' },
  { path: '/tours', label: 'My Tours', icon: 'List' },
  { path: '/tours/add', label: 'Add Tour', icon: 'PlusCircle' },
  { path: '/payment', label: 'Payment', icon: 'Wallet' },
  { path: '/bookings', label: 'Booking History', icon: 'CalendarCheck' },
]

const icons = { MapPin, LayoutDashboard, List, PlusCircle, Wallet, CalendarCheck, ShieldCheck }

function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [agency, setAgency] = useState(null)

  useEffect(() => {
    const stored = localStorage.getItem('agency_data')
    if (stored) {
      try {
        setAgency(JSON.parse(stored))
      } catch (_) {}
    }
    api.get('/agency/me').then(({ data }) => {
      setAgency(data)
      localStorage.setItem('agency_data', JSON.stringify(data))
    }).catch(() => {})
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('agency_token')
    localStorage.removeItem('agency_data')
    navigate('/login', { replace: true })
  }

  return (
    <div className="agency-layout">
      <aside className="agency-sidebar">
        <div className="agency-sidebar-brand">
          <img src="/logo.png" alt="TBidder" style={{ height: 32, marginRight: 8, verticalAlign: 'middle' }} onError={(e) => { e.target.style.display = 'none'; }} />
          T-Bidder
        </div>
        <nav className="agency-sidebar-nav">
          {NAV.map(({ path, label, icon }) => {
            const Icon = icons[icon] || MapPin
            const active = location.pathname === path || (path !== '/' && path !== '/tours' && location.pathname.startsWith(path)) || (path === '/tours' && location.pathname === '/tours')
            return (
              <a
                key={path}
                href={path}
                className={`agency-nav-link ${active ? 'active' : ''}`}
                onClick={(e) => { e.preventDefault(); navigate(path) }}
              >
                <Icon size={18} />
                <span>{label}</span>
              </a>
            )
          })}
        </nav>
      </aside>
      <main className="agency-main">
        <header className="agency-header">
          <span className="agency-header-name">{agency?.name || 'Partner Portal'}</span>
          <button type="button" className="agency-logout" onClick={handleLogout}>
            <LogOut size={16} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />
            Logout
          </button>
        </header>
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
