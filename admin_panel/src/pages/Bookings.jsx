import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, Loader2, Calendar } from 'lucide-react'
import api from '../services/api'
import { getFeatureByPath } from '../config/firm'
import '../App.css'

function Bookings() {
  const navigate = useNavigate()
  const [rides, setRides] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/admin/rides')
      .then(({ data }) => setRides(data.rides || []))
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem('token')
          navigate('/login', { replace: true })
          return
        }
        setError(err.response?.data?.error || err.message || 'Failed to load bookings')
      })
      .finally(() => setLoading(false))
  }, [navigate])

  const formatDate = (iso) => {
    if (!iso) return '—'
    try {
      const d = new Date(iso)
      return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
    } catch (_) {
      return iso
    }
  }

  const statusColor = (s) => {
    switch (s) {
      case 'pending': return '#f59e0b'
      case 'accepted': return '#10b981'
      case 'driver_arrived': return '#3b82f6'
      case 'ride_started': return '#8b5cf6'
      case 'completed': return '#6b7280'
      default: return '#6b7280'
    }
  }

  const feature = getFeatureByPath('/bookings')
  const pageTitle = feature?.label ?? 'Bookings'

  return (
    <>
      <header className="dashboard-header">
        <h1 className="dashboard-header-title">{pageTitle}</h1>
      </header>
      <div className="dashboard-content">
        {loading && (
          <div className="dashboard-loading">
            <Loader2 size={32} className="spin" />
            <span>Loading bookings...</span>
          </div>
        )}
        {error && <p className="dashboard-error">{error}</p>}
        {!loading && !error && (
          <div className="bookings-list">
            <p className="bookings-hint">Click a row to open ride detail and chat history.</p>
            <table className="bookings-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Date &amp; Time</th>
                  <th>Vehicle</th>
                  <th>Pickup</th>
                  <th>Drop</th>
                  <th>Status</th>
                  <th>Price (S/)</th>
                  <th>Chat</th>
                </tr>
              </thead>
              <tbody>
                {rides.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="bookings-empty">No bookings yet.</td>
                  </tr>
                ) : (
                  rides.map((r) => (
                    <tr
                      key={r.id}
                      className="bookings-row"
                      onClick={() => navigate(`/bookings/${r.id}`)}
                    >
                      <td>{r.id}</td>
                      <td>
                        <span className="bookings-date">
                          <Calendar size={14} />
                          {formatDate(r.createdAt)}
                        </span>
                      </td>
                      <td><span style={{ fontSize: '0.85em', fontWeight: 500 }}>{r.vehicleType || '—'}</span></td>
                      <td className="bookings-address">{r.pickupAddress || '—'}</td>
                      <td className="bookings-address">{r.dropAddress || '—'}</td>
                      <td>
                        <span className="bookings-status" style={{ backgroundColor: statusColor(r.status) }}>
                          {r.status || '—'}
                        </span>
                      </td>
                      <td>{r.userPrice != null ? Number(r.userPrice).toFixed(2) : '—'}</td>
                      <td>
                        {(r.messagesCount || 0) > 0 ? (
                          <span className="bookings-chat-badge">
                            <MessageSquare size={14} />
                            {r.messagesCount}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
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

export default Bookings
