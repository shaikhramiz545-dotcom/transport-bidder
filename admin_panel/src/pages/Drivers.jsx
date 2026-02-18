import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Search, MoreVertical, Eye, Mail } from 'lucide-react'
import api from '../services/api'
import '../App.css'

const uploadsBase = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, '') : ''

function Drivers() {
  const navigate = useNavigate()
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actioningId, setActioningId] = useState(null)

  const [activeTab, setActiveTab] = useState('all') // all | pending | approved | rejected | suspended | temp_blocked
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [cityFilter, setCityFilter] = useState('all')
  const [vehicleFilter, setVehicleFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all') // all | today | week | month

  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  const [reasonModal, setReasonModal] = useState(null)
  const [reasonText, setReasonText] = useState('')

  useEffect(() => {
    api.get('/admin/drivers')
      .then(({ data }) => {
        setDrivers(data.drivers || [])
        setError('')
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem('token')
          navigate('/login', { replace: true })
          return
        }
        setError(err.response?.data?.error || err.message || 'Failed to load drivers')
      })
      .finally(() => setLoading(false))
  }, [navigate])

  const handleResetFilters = () => {
    setActiveTab('all')
    setStatusFilter('all')
    setCityFilter('all')
    setVehicleFilter('all')
    setDateFilter('all')
    setSearch('')
    setPage(0)
  }

  const allStatuses = useMemo(() => {
    const set = new Set(drivers.map((d) => d.status || 'pending'))
    return Array.from(set)
  }, [drivers])

  const allVehicleTypes = useMemo(() => {
    const set = new Set(drivers.map((d) => (d.vehicleType || 'car')))
    return Array.from(set)
  }, [drivers])

  const allCities = useMemo(() => {
    const set = new Set(drivers.map((d) => d.city).filter(Boolean))
    return Array.from(set)
  }, [drivers])

  const formatDate = (iso) => {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
    } catch (_) {
      return iso
    }
  }

  const statusLabel = (s) => {
    if (!s) return 'pending'
    return s
  }

  const statusColor = (s) => {
    switch (s) {
      case 'approved': return '#10b981'
      case 'rejected': return '#ef4444'
      case 'suspended':
      case 'temp_blocked': return '#6b7280'
      case 'pending':
      default: return '#f59e0b'
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const tabStatus = activeTab === 'all' ? null
      : activeTab === 'approved' ? 'approved'
      : activeTab === 'suspended' ? 'suspended'
      : activeTab === 'pending' ? 'pending'
      : activeTab === 'rejected' ? 'rejected'
      : null

    const statusSel = statusFilter === 'all' ? null : statusFilter

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(startOfToday)
    startOfWeek.setDate(startOfToday.getDate() - ((startOfToday.getDay() || 7) - 1))
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    return drivers.filter((d) => {
      const s = d.status || 'pending'
      if (tabStatus && s !== tabStatus) return false
      if (statusSel && s !== statusSel) return false

      if (vehicleFilter !== 'all' && (d.vehicleType || 'car') !== vehicleFilter) return false
      if (cityFilter !== 'all' && (d.city || '') !== cityFilter) return false

      if (dateFilter !== 'all' && d.updatedAt) {
        const dt = new Date(d.updatedAt)
        if (Number.isNaN(dt.getTime())) {
          // ignore invalid dates for date filter
        } else if (dateFilter === 'today' && dt < startOfToday) {
          return false
        } else if (dateFilter === 'week' && dt < startOfWeek) {
          return false
        } else if (dateFilter === 'month' && dt < startOfMonth) {
          return false
        }
      }

      if (q) {
        const name = (d.driverName || '').toLowerCase()
        const phone = (d.phone || '').toLowerCase()
        const id = (d.driverId || '').toLowerCase()
        const plate = (d.vehiclePlate || '').toLowerCase()
        if (!name.includes(q) && !phone.includes(q) && !id.includes(q) && !plate.includes(q)) {
          return false
        }
      }

      return true
    })
  }, [drivers, search, activeTab, statusFilter, cityFilter, vehicleFilter, dateFilter])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const startIndex = currentPage * pageSize
  const endIndex = Math.min(startIndex + pageSize, filtered.length)
  const pageRows = filtered.slice(startIndex, endIndex)

  const handleVerify = (driverId, status, blockReason = null) => {
    setActioningId(driverId)
    const body = blockReason != null ? { status, blockReason } : { status }
    api.post(`/admin/drivers/${encodeURIComponent(driverId)}/verify`, body)
      .then(({ data }) => {
        setDrivers((prev) => prev.map((d) => (d.driverId === driverId ? { ...d, status: data.status, blockReason: data.blockReason } : d)))
        setError('')
      })
      .catch((err) => {
        setError(err.response?.data?.error || err.message || 'Failed to update driver')
      })
      .finally(() => {
        setActioningId(null)
        setReasonModal(null)
        setReasonText('')
      })
  }

  const openReasonModal = (driverId, action) => {
    setReasonModal({ driverId, action })
    setReasonText('')
  }

  return (
    <>
      <header className="dashboard-header">
        <h1 className="dashboard-header-title">Drivers</h1>
      </header>
      <div className="dashboard-content">
        <p className="page-placeholder-desc">
          Review and control all drivers. Use filters to find Pending, Verified, Rejected, or Suspended profiles.
        </p>

        {loading && (
          <div className="dashboard-loading">
            <Loader2 size={32} className="spin" />
            <span>Loading drivers...</span>
          </div>
        )}
        {error && <p className="dashboard-error">{error}</p>}

        {!loading && !error && (
          <>
            <div className="drivers-tabs">
              {[
                { id: 'all', label: 'All' },
                { id: 'pending', label: 'Pending' },
                { id: 'approved', label: 'Approved' },
                { id: 'rejected', label: 'Rejected' },
                { id: 'suspended', label: 'Suspended' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`drivers-tab ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => { setActiveTab(tab.id); setPage(0); }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="drivers-filters">
              <div className="drivers-search-wrap">
                <Search size={16} />
                <input
                  className="drivers-search"
                  placeholder="Search name, phone, DNI, plate"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                />
              </div>
              <select
                className="drivers-select"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              >
                <option value="all">Status: All</option>
                {allStatuses.map((s) => (
                  <option key={s} value={s}>{statusLabel(s)}</option>
                ))}
              </select>
              <select
                className="drivers-select"
                value={cityFilter}
                onChange={(e) => { setCityFilter(e.target.value); setPage(0); }}
              >
                <option value="all">City: All</option>
                {allCities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                className="drivers-select"
                value={vehicleFilter}
                onChange={(e) => { setVehicleFilter(e.target.value); setPage(0); }}
              >
                <option value="all">Vehicle: All</option>
                {allVehicleTypes.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              <select
                className="drivers-select"
                value={dateFilter}
                onChange={(e) => { setDateFilter(e.target.value); setPage(0); }}
              >
                <option value="all">Date: Any</option>
                <option value="today">Today</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
              </select>
              <button
                type="button"
                className="drivers-reset"
                onClick={handleResetFilters}
              >
                Reset
              </button>
            </div>

            <div className="bookings-list">
              <table className="bookings-table">
                <thead>
                  <tr>
                    <th>Photo</th>
                    <th>Name</th>
                    <th className="drivers-id-col">Driver ID</th>
                    <th>Phone</th>
                    <th>City</th>
                    <th>Status</th>
                    <th>Docs</th>
                    <th>Joined / Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="bookings-empty">
                        No drivers found for current filters.
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((d) => (
                      <tr key={d.driverId || d.id}>
                        <td>
                          <div className="drivers-avatar">
                            {d.photoUrl ? (
                              // eslint-disable-next-line jsx-a11y/img-redundant-alt
                              <img src={d.photoUrl.startsWith('http') ? d.photoUrl : `${uploadsBase}${d.photoUrl}`} alt="Driver photo" className="drivers-avatar-img" />
                            ) : (
                              (d.driverName || '?').charAt(0).toUpperCase()
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="drivers-name">{d.driverName || '—'}</div>
                          {d.rating != null && (
                            <div className="drivers-rating">★ {Number(d.rating).toFixed(1)}</div>
                          )}
                        </td>
                        <td className="drivers-id-cell" title={d.driverId || d.id}>
                          <code className="tx-id">{d.driverId || d.id}</code>
                        </td>
                        <td>{d.phone || '—'}</td>
                        <td>{d.city || '—'}</td>
                        <td>
                          <span
                            className="bookings-status"
                            style={{ backgroundColor: statusColor(d.status) }}
                          >
                            {statusLabel(d.status)}
                          </span>
                        </td>
                        <td className="drivers-docs">
                          {(d.documentsCount != null ? `${d.documentsCount}/7` : '—')}
                        </td>
                        <td>{formatDate(d.createdAt || d.updatedAt)}</td>
                        <td>
                          <div className="drivers-actions">
                            <button
                              type="button"
                              className="dashboard-btn small"
                              style={{ paddingInline: '0.6rem' }}
                              onClick={() => navigate(`/drivers/${encodeURIComponent(d.driverId)}`)}
                            >
                              <Eye size={14} /> View
                            </button>
                            <div className="drivers-menu-wrap">
                              <button
                                type="button"
                                className="drivers-menu-btn"
                                onClick={(e) => {
                                  const menu = e.currentTarget.nextSibling
                                  if (menu) {
                                    const isOpen = menu.getAttribute('data-open') === 'true'
                                    menu.setAttribute('data-open', isOpen ? 'false' : 'true')
                                    menu.style.display = isOpen ? 'none' : 'block'
                                  }
                                }}
                              >
                                <MoreVertical size={16} />
                              </button>
                              <div className="drivers-menu" data-open="false" style={{ display: 'none' }}>
                                <button
                                  type="button"
                                  disabled={actioningId === d.driverId}
                                  onClick={() => {
                                    handleVerify(d.driverId, 'approved')
                                  }}
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  disabled={actioningId === d.driverId}
                                  onClick={() => openReasonModal(d.driverId, 'reject')}
                                >
                                  Reject
                                </button>
                                <button
                                  type="button"
                                  disabled={actioningId === d.driverId}
                                  onClick={() => openReasonModal(d.driverId, 'suspend')}
                                >
                                  Suspend
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const msg = `Driver ID: ${d.driverId || ''}`
                                    if (navigator.clipboard?.writeText) {
                                      navigator.clipboard.writeText(msg)
                                    }
                                    // Basic helper: open default mail client with ID prefilled
                                    window.location.href = `mailto:?subject=TBidder driver message&body=${encodeURIComponent(msg)}`
                                  }}
                                >
                                  <Mail size={14} style={{ marginRight: 4 }} />
                                  Message
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem' }}>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>
                Showing {filtered.length === 0 ? 0 : startIndex + 1}–{endIndex} of {filtered.length}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
                  style={{ padding: '0.25rem 0.5rem', borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)', fontSize: '0.85rem' }}
                >
                  {[10, 20, 50].map((n) => (
                    <option key={n} value={n}>{n} / page</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="drivers-reset"
                  disabled={currentPage === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Prev
                </button>
                <span style={{ fontSize: '0.85rem' }}>
                  {currentPage + 1} / {pageCount}
                </span>
                <button
                  type="button"
                  className="drivers-reset"
                  disabled={currentPage >= pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {reasonModal && (
        <div className="modal-overlay" onClick={() => setReasonModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{reasonModal.action === 'reject' ? 'Reject driver' : 'Suspend driver'}</h3>
            <p>{reasonModal.action === 'reject' ? 'Reason (required, shown to driver):' : 'Reason (required):'}</p>
            <textarea
              rows={3}
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder={reasonModal.action === 'reject' ? 'e.g. Document unclear, please resubmit' : 'e.g. Policy violation'}
            />
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setReasonModal(null)}>Cancel</button>
              <button
                type="button"
                className="btn-decline"
                disabled={actioningId === reasonModal.driverId || !reasonText.trim()}
                onClick={() => {
                  const reason = reasonText.trim()
                  if (!reason) return
                  const status = reasonModal.action === 'reject' ? 'rejected' : 'suspended'
                  handleVerify(reasonModal.driverId, status, reason)
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Drivers
