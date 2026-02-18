import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, MessageSquare, Phone, Loader2, MapPin, Calendar } from 'lucide-react'
import api from '../services/api'
import '../App.css'

function RideDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [ride, setRide] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    api.get(`/admin/rides/${id}`)
      .then(({ data }) => setRide(data))
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem('token')
          navigate('/login', { replace: true })
          return
        }
        setError(err.response?.data?.error || err.message || 'Failed to load ride')
      })
      .finally(() => setLoading(false))
  }, [id, navigate])

  const formatAt = (iso) => {
    if (!iso) return '—'
    try {
      const d = new Date(iso)
      return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' })
    } catch (_) {
      return iso
    }
  }

  const formatDate = (iso) => {
    if (!iso) return '—'
    try {
      const d = new Date(iso)
      return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
    } catch (_) {
      return iso
    }
  }

  if (loading) {
    return (
      <div className="dashboard-content">
        <div className="dashboard-loading">
          <Loader2 size={32} className="spin" />
          <span>Loading ride...</span>
        </div>
      </div>
    )
  }

  if (error || !ride) {
    return (
      <div className="dashboard-content">
        <button type="button" className="ride-detail-back" onClick={() => navigate('/bookings')}>
          <ArrowLeft size={18} /> Back to Bookings
        </button>
        <p className="dashboard-error">{error || 'Ride not found'}</p>
      </div>
    )
  }

  const messages = ride.messages || []

  return (
    <div className="dashboard-content ride-detail">
      <button type="button" className="ride-detail-back" onClick={() => navigate('/bookings')}>
        <ArrowLeft size={18} /> Back to Bookings
      </button>

      <section className="ride-detail-info">
        <h2>Ride #{ride.id}</h2>
        <p className="ride-detail-meta">
          <Calendar size={16} />
          Created: {formatDate(ride.createdAt)}
        </p>
        <p className="ride-detail-status">Status: <strong>{ride.status || '—'}</strong></p>
        <p>Vehicle Type: <strong>{ride.vehicleType || '—'}</strong></p>
        <div className="ride-detail-addresses">
          <p><MapPin size={16} /> Pickup: {ride.pickupAddress || '—'}</p>
          <p><MapPin size={16} /> Drop: {ride.dropAddress || '—'}</p>
        </div>
        <p>Distance: {ride.distanceKm != null ? `${Number(ride.distanceKm).toFixed(1)} km` : '—'}</p>
        <p>Price (S/): {ride.userPrice != null ? Number(ride.userPrice).toFixed(2) : '—'}</p>
        <div className="ride-detail-phones">
          <p><Phone size={16} /> User: {ride.userPhone || '—'}</p>
          <p><Phone size={16} /> Driver: {ride.driverPhone || '—'}</p>
        </div>

        {ride.outstationPassengers && (
          <div style={{ marginTop: 12, padding: 12, background: '#fff7ed', borderRadius: 8, border: '1px solid #fed7aa' }}>
            <strong>🛣️ Outstation Details</strong>
            <p>Passengers: {ride.outstationPassengers}</p>
            {ride.outstationIsParcel && <p>📦 Parcel booking</p>}
            {ride.outstationComments && <p>Comments: {ride.outstationComments}</p>}
          </div>
        )}

        {(ride.deliveryComments || ride.deliveryWeight || ride.deliveryPhotoUrl) && (
          <div style={{ marginTop: 12, padding: 12, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
            <strong>📦 Delivery Details</strong>
            {ride.deliveryWeight && <p>Weight: {ride.deliveryWeight} kg</p>}
            {ride.deliveryComments && <p>Comments: {ride.deliveryComments}</p>}
            {ride.deliveryPhotoUrl && <p>📷 Photo attached</p>}
          </div>
        )}
      </section>

      <section className="ride-detail-chat">
        <h3><MessageSquare size={20} /> Communication history (date &amp; time)</h3>
        {messages.length === 0 ? (
          <p className="ride-detail-chat-empty">No messages for this booking.</p>
        ) : (
          <ul className="ride-detail-messages">
            {messages.map((m, i) => (
              <li key={i} className={`ride-detail-msg ride-detail-msg-${m.from || 'unknown'}`}>
                <span className="ride-detail-msg-from">{m.from === 'user' ? 'User' : 'Driver'}</span>
                <span className="ride-detail-msg-text">{m.text || '—'}</span>
                <span className="ride-detail-msg-at">{formatAt(m.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default RideDetail
