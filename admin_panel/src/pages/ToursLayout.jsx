import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { getFeatureByPath } from '../config/firm'
import '../App.css'

function ToursLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const feature = getFeatureByPath('/tours')
  const pageTitle = feature?.label ?? 'Tours'
  const isAgencyVerification = location.pathname.includes('/agency-verification')

  return (
    <>
      <header className="dashboard-header">
        <h1 className="dashboard-header-title">{pageTitle}</h1>
      </header>
      <div className="tours-subnav">
        <button
          type="button"
          className={`tours-subnav-btn ${!isAgencyVerification ? 'active' : ''}`}
          onClick={() => navigate('/tours')}
        >
          Tours
        </button>
        <button
          type="button"
          className={`tours-subnav-btn ${isAgencyVerification ? 'active' : ''}`}
          onClick={() => navigate('/tours/agency-verification')}
        >
          Travel Agencies / Verification
        </button>
      </div>
      <div className="dashboard-content">
        <Outlet />
      </div>
    </>
  )
}

export default ToursLayout
