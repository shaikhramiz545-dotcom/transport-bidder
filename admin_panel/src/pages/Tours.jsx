import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Check, X, Pause, Eye } from 'lucide-react'
import api from '../services/api'
import '../App.css'

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'blocked', label: 'Blocked' },
]

const CATEGORY_LABELS = {
  full_day: 'Full Day',
  night_tour: 'Night Tour',
  adventure: 'Adventure',
  cultural: 'Cultural',
  family: 'Family',
}

function Tours() {
  const navigate = useNavigate()
  const [tours, setTours] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [actioningId, setActioningId] = useState(null)

  const fetchTours = () => {
    setLoading(true)
    const params = statusFilter ? { status: statusFilter } : {}
    api.get('/admin/tours', { params })
      .then(({ data }) => {
        setTours(data.tours || [])
        setError('')
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem('token')
          navigate('/login', { replace: true })
          return
        }
        setError(err.response?.data?.error || err.message || 'Failed to load tours')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchTours()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  const formatDate = (iso) => {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'short' })
    } catch (_) {
      return iso
    }
  }

  const statusColor = (s) => {
    switch (s) {
      case 'pending': return '#f59e0b'
      case 'approved': return '#10b981'
      case 'rejected': return '#ef4444'
      case 'suspended': return '#6b7280'
      case 'blocked': return '#7f1d1d'
      default: return '#6b7280'
    }
  }

  const handleAction = async (tourId, action) => {
    setActioningId(tourId)
    try {
      await api.post(`/admin/tours/${tourId}/${action}`)
      fetchTours()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Action failed')
    } finally {
      setActioningId(null)
    }
  }

  return (
    <>
      <div className="tours-filters">
          <label>
            Status:
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="tours-status-select"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>
        {loading && (
          <div className="dashboard-loading">
            <Loader2 size={32} className="spin" />
            <span>Loading tours...</span>
          </div>
        )}
        {error && <p className="dashboard-error">{error}</p>}
        {!loading && !error && (
          <div className="bookings-list">
            <p className="bookings-hint">Click a row to view details. Use Approve/Reject/Suspend to change status.</p>
            <table className="bookings-table">
              <thead>
                <tr>
                  <th style={{ width: 48 }}></th>
                  <th>Title</th>
                  <th>Agency</th>
                  <th>Country</th>
                  <th>City</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tours.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="bookings-empty">
                      No tours {statusFilter ? `with status "${statusFilter}"` : ''}.
                    </td>
                  </tr>
                ) : (
                  tours.map((t) => (
                    <tr
                      key={t.id}
                      className="bookings-row"
                      onClick={() => navigate(`/tours/${t.id}`)}
                    >
                      <td style={{ padding: '0.35rem', verticalAlign: 'middle' }}>
                        {t.thumbnailUrl ? (
                          <img
                            src={t.thumbnailUrl}
                            alt=""
                            style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }}
                          />
                        ) : (
                          <div style={{ width: 40, height: 40, background: '#e5e7eb', borderRadius: 6 }} />
                        )}
                      </td>
                      <td className="tours-title">
                        {t.title}
                        {t.hasPendingChanges && (
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#f59e0b', fontWeight: 500 }}>
                            (has changes)
                          </span>
                        )}
                      </td>
                      <td>{t.agencyName || '—'}</td>
                      <td>{t.country || '—'}</td>
                      <td>{t.city || '—'}</td>
                      <td>{CATEGORY_LABELS[t.category] || t.category || '—'}</td>
                      <td>
                        <span
                          className="bookings-status"
                          style={{ backgroundColor: statusColor(t.status) }}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td>{formatDate(t.createdAt)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="tours-actions">
                          <button
                            type="button"
                            className="tours-btn tours-btn-view"
                            onClick={() => navigate(`/tours/${t.id}`)}
                            title="View"
                          >
                            <Eye size={16} />
                          </button>
                          {t.status === 'pending' && (
                            <>
                              <button
                                type="button"
                                className="tours-btn tours-btn-approve"
                                onClick={() => handleAction(t.id, 'approve')}
                                disabled={actioningId === t.id}
                                title="Approve"
                              >
                                {actioningId === t.id ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                              </button>
                              <button
                                type="button"
                                className="tours-btn tours-btn-reject"
                                onClick={() => handleAction(t.id, 'reject')}
                                disabled={actioningId === t.id}
                                title="Reject"
                              >
                                <X size={14} />
                              </button>
                            </>
                          )}
                          {(t.status === 'approved' || t.status === 'pending') && (
                            <button
                              type="button"
                              className="tours-btn tours-btn-suspend"
                              onClick={() => handleAction(t.id, 'suspend')}
                              disabled={actioningId === t.id}
                              title="Suspend"
                            >
                              <Pause size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
    </>
  )
}

export default Tours
