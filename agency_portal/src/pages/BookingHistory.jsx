import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import api from '../services/api'
import '../App.css'

function formatDate(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString(undefined, { dateStyle: 'short' }) } catch (_) { return String(d) }
}

function formatDateTime(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) } catch (_) { return String(d) }
}

const FLAG_OPTIONS = [
  { value: '', label: 'All flags' },
  { value: 'new_arrival', label: 'New arrival' },
  { value: 'most_selling', label: 'Most selling' },
  { value: 'top_rated', label: 'Top rated' },
  { value: 'booked_yesterday', label: 'Booked yesterday' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending_payment', label: 'Pending payment' },
  { value: 'paid', label: 'Paid' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

function BookingHistory() {
  const [bookings, setBookings] = useState([])
  const [tours, setTours] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterTourId, setFilterTourId] = useState('')
  const [filterFlag, setFilterFlag] = useState('')

  const fetchTours = () => {
    api.get('/agency/tours')
      .then(({ data }) => setTours(data.tours || []))
      .catch(() => setTours([]))
  }

  const fetchBookings = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterFrom) params.set('from', filterFrom)
    if (filterTo) params.set('to', filterTo)
    if (filterStatus) params.set('status', filterStatus)
    if (filterTourId) params.set('tourId', filterTourId)
    if (filterFlag) params.set('flag', filterFlag)
    api.get(`/agency/bookings?${params.toString()}`)
      .then(({ data }) => { setBookings(data.bookings || []); setError('') })
      .catch((err) => {
        setError(err.response?.data?.error || err.message || 'Failed to load')
        setBookings([])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchTours() }, [])
  useEffect(() => { fetchBookings() }, [filterFrom, filterTo, filterStatus, filterTourId, filterFlag])

  return (
    <div>
      <h2 style={{ margin: '0 0 1rem' }}>Tour Booking History</h2>
      <p style={{ margin: '0 0 1rem', color: '#666', fontSize: '0.9375rem' }}>
        See which tour was booked, when (date & time), guest details, and filter by status or tour flags.
      </p>

      <div className="agency-card">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', alignItems: 'flex-end' }}>
          <div className="form-row" style={{ margin: 0 }}>
            <label>From (date)</label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              style={{ width: 'auto', minWidth: '140px' }}
            />
          </div>
          <div className="form-row" style={{ margin: 0 }}>
            <label>To (date)</label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              style={{ width: 'auto', minWidth: '140px' }}
            />
          </div>
          <div className="form-row" style={{ margin: 0 }}>
            <label>Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ width: 'auto', minWidth: '140px' }}
            >
              {STATUS_OPTIONS.map((o) => <option key={o.value || 'all'} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="form-row" style={{ margin: 0 }}>
            <label>Tour</label>
            <select
              value={filterTourId}
              onChange={(e) => setFilterTourId(e.target.value)}
              style={{ width: 'auto', minWidth: '180px' }}
            >
              <option value="">All tours</option>
              {tours.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
          <div className="form-row" style={{ margin: 0 }}>
            <label>Flag</label>
            <select
              value={filterFlag}
              onChange={(e) => setFilterFlag(e.target.value)}
              style={{ width: 'auto', minWidth: '140px' }}
            >
              {FLAG_OPTIONS.map((o) => <option key={o.value || 'all'} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {error && <p className="agency-error">{error}</p>}
        {loading ? (
          <div className="agency-loading">
            <Loader2 size={32} className="spin" />
            <span>Loading bookings...</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="agency-table">
              <thead>
                <tr>
                  <th>Booked at</th>
                  <th>Tour</th>
                  <th>Slot date & time</th>
                  <th>Guest</th>
                  <th>Pax</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                      No bookings for this filter.
                    </td>
                  </tr>
                ) : (
                  bookings.map((b) => (
                    <tr key={b.id}>
                      <td>{formatDateTime(b.createdAt)}</td>
                      <td>{b.tourTitle || '—'}</td>
                      <td>
                        {b.slotDate ? (
                          <>
                            {formatDate(b.slotDate)}
                            {b.slotStartTime && <span style={{ display: 'block', fontSize: '0.8em', color: '#666' }}>{b.slotStartTime}{b.slotEndTime ? ` – ${b.slotEndTime}` : ''}</span>}
                          </>
                        ) : '—'}
                      </td>
                      <td>
                        <div>{b.guestName || '—'}</div>
                        {b.guestEmail && <div style={{ fontSize: '0.8em', color: '#666' }}>{b.guestEmail}</div>}
                      </td>
                      <td>{b.paxCount ?? '—'}</td>
                      <td>{b.totalAmount != null ? `${Number(b.totalAmount).toFixed(2)} ${b.currency || 'USD'}` : '—'}</td>
                      <td>
                        <span className={`agency-status ${b.status === 'completed' || b.status === 'paid' ? 'approved' : b.status === 'cancelled' ? 'rejected' : 'pending'}`}>
                          {b.status}
                        </span>
                      </td>
                      <td>
                        {Array.isArray(b.flags) && b.flags.length > 0 ? (
                          <span style={{ fontSize: '0.8em' }}>
                            {b.flags.map((f) => f.text).join(', ')}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default BookingHistory
