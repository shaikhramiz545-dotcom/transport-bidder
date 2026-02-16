import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Eye } from 'lucide-react'
import api from '../services/api'
import '../App.css'

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'needs_documents', label: 'Needs documents' },
]

function AgencyVerificationList() {
  const navigate = useNavigate()
  const [agencies, setAgencies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const fetchAgencies = () => {
    setLoading(true)
    const params = statusFilter ? { status: statusFilter } : {}
    api.get('/admin/travel-agencies', { params })
      .then(({ data }) => {
        setAgencies(data.agencies || [])
        setError('')
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem('token')
          navigate('/login', { replace: true })
          return
        }
        setError(err.response?.data?.error || err.message || 'Failed to load agencies')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchAgencies()
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
      case 'needs_documents': return '#8b5cf6'
      default: return '#6b7280'
    }
  }

  return (
    <>
      <p className="page-placeholder-desc">
        Verify travel agency accounts. View documents, then Approve, Reject, or request more documents. Status is sent by email to the agency.
      </p>
      <div className="tours-filters" style={{ marginBottom: '1rem' }}>
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
          <span>Loading agencies...</span>
        </div>
      )}
      {error && <p className="dashboard-error">{error}</p>}
      {!loading && !error && (
        <div className="bookings-list">
          <table className="bookings-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Country</th>
                <th>Status</th>
                <th>Note</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {agencies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="bookings-empty">
                    No travel agencies to verify.
                  </td>
                </tr>
              ) : (
                agencies.map((a) => (
                  <tr key={a.id} className="bookings-row">
                    <td>{a.name || '—'}</td>
                    <td>{a.email || '—'}</td>
                    <td>{a.country || '—'}</td>
                    <td>
                      <span
                        className="bookings-status"
                        style={{ backgroundColor: statusColor(a.status) }}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td style={{ maxWidth: 200, fontSize: 12 }}>{a.verificationNote || '—'}</td>
                    <td>{formatDate(a.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="dashboard-btn small"
                        onClick={() => navigate(`/tours/agency-verification/${a.id}`)}
                        title="View & verify"
                      >
                        <Eye size={14} /> View
                      </button>
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

export default AgencyVerificationList
