import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFeatureByPath } from '../config/firm'
import api from '../services/api'
import { Loader2 } from 'lucide-react'
import '../App.css'

function Agencies() {
  const navigate = useNavigate()
  const feature = getFeatureByPath('/agencies')
  const title = feature?.label ?? 'Agencies'
  const [agencies, setAgencies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/admin/agencies')
      .then(({ data }) => { setAgencies(data.agencies || []); setError(''); })
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem('token')
          navigate('/login', { replace: true })
          return
        }
        if (err.response?.status === 404) { setAgencies([]); setError(''); return }
        setError(err.response?.data?.error || err.message || 'Failed to load')
      })
      .finally(() => setLoading(false))
  }, [navigate])

  return (
    <>
      <header className="dashboard-header">
        <h1 className="dashboard-header-title">{title}</h1>
      </header>
      <div className="dashboard-content">
        <p className="page-placeholder-desc">Manage fleet owners / agencies.</p>
        {loading && (
          <div className="dashboard-loading">
            <Loader2 size={32} className="spin" />
            <span>Loading...</span>
          </div>
        )}
        {error && <p className="dashboard-error">{error}</p>}
        {!loading && !error && (
          <div className="bookings-list">
            <table className="bookings-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Drivers</th>
                </tr>
              </thead>
              <tbody>
                {agencies.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="bookings-empty">No agencies yet.</td>
                  </tr>
                ) : (
                  agencies.map((a, i) => (
                    <tr key={i}>
                      <td>{a.name || '—'}</td>
                      <td>{a.contact || '—'}</td>
                      <td>{a.driversCount != null ? a.driversCount : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

export default Agencies
