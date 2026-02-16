import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, Check, X, Pause, ArrowLeft } from 'lucide-react'
import api from '../services/api'
import { getFeatureByPath } from '../config/firm'
import '../App.css'

const CATEGORY_LABELS = {
  full_day: 'Full Day',
  night_tour: 'Night Tour',
  adventure: 'Adventure',
  cultural: 'Cultural',
  family: 'Family',
}

function TourDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tour, setTour] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actioning, setActioning] = useState(false)
  const [suspendModal, setSuspendModal] = useState(false)
  const [suspendReason, setSuspendReason] = useState('')
  const [suspendFix, setSuspendFix] = useState('')

  useEffect(() => {
    api.get(`/admin/tours/${id}`)
      .then(({ data }) => {
        setTour(data)
        setError('')
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem('token')
          navigate('/login', { replace: true })
          return
        }
        if (err.response?.status === 404) {
          setError('Tour not found')
          setTour(null)
          return
        }
        setError(err.response?.data?.error || err.message || 'Failed to load tour')
      })
      .finally(() => setLoading(false))
  }, [id, navigate])

  const handleAction = async (action, body) => {
    setActioning(true)
    try {
      await api.post(`/admin/tours/${id}/${action}`, body || {})
      const { data } = await api.get(`/admin/tours/${id}`)
      setTour(data)
      if (action === 'suspend') {
        setSuspendModal(false)
        setSuspendReason('')
        setSuspendFix('')
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Action failed')
    } finally {
      setActioning(false)
    }
  }

  const handleSuspend = () => {
    if (!suspendReason.trim() || !suspendFix.trim()) {
      setError('Reason and fix instructions are required')
      return
    }
    handleAction('suspend', { reason: suspendReason.trim(), fixInstructions: suspendFix.trim() })
  }

  const feature = getFeatureByPath('/tours')
  const pageTitle = feature?.label ?? 'Tours'

  if (loading) {
    return (
      <>
        <header className="dashboard-header">
          <h1 className="dashboard-header-title">{pageTitle}</h1>
        </header>
        <div className="dashboard-content">
          <div className="dashboard-loading">
            <Loader2 size={32} className="spin" />
            <span>Loading tour...</span>
          </div>
        </div>
      </>
    )
  }

  if (error && !tour) {
    return (
      <>
        <header className="dashboard-header">
          <h1 className="dashboard-header-title">{pageTitle}</h1>
        </header>
        <div className="dashboard-content">
          <p className="dashboard-error">{error}</p>
          <button type="button" className="tour-detail-back" onClick={() => navigate('/tours')}>
            <ArrowLeft size={16} /> Back to Tours
          </button>
        </div>
      </>
    )
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

  return (
    <>
      <header className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button type="button" className="tour-detail-back" onClick={() => navigate('/tours')}>
            <ArrowLeft size={16} /> Back
          </button>
          <h1 className="dashboard-header-title">{tour?.title || 'Tour Detail'}</h1>
        </div>
      </header>
      <div className="dashboard-content">
        {error && <p className="dashboard-error">{error}</p>}
        {tour && (
          <div className="tour-detail">
            {tour.status === 'pending' && (
              <div
                className="tour-detail-section tour-detail-full"
                style={{
                  background: tour.pendingChangeSummary ? '#fef3c7' : '#f3f4f6',
                  border: `1px solid ${tour.pendingChangeSummary ? '#f59e0b' : '#d1d5db'}`,
                  borderRadius: 8,
                  padding: '1rem 1.25rem',
                  marginBottom: '1rem',
                }}
              >
                <h3 style={{ margin: '0 0 0.5rem', color: tour.pendingChangeSummary ? '#92400e' : '#374151' }}>
                  {tour.pendingChangeSummary ? '🔄 New Changes (for review)' : '⏳ Pending Approval'}
                </h3>
                {tour.pendingChangeSummary ? (
                  <>
                    <pre
                      style={{
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'inherit',
                        fontSize: '0.9rem',
                        lineHeight: 1.5,
                        color: '#78350f',
                      }}
                    >
                      {tour.pendingChangeSummary}
                    </pre>
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#92400e' }}>
                      Review the changes above before approving or rejecting.
                    </p>
                  </>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#6b7280' }}>
                    This tour is awaiting approval. No edit summary available (tour may have been newly submitted).
                  </p>
                )}
              </div>
            )}
            <div className="tour-detail-actions">
              <span
                className="tour-detail-status"
                style={{ backgroundColor: statusColor(tour.status) }}
              >
                {tour.status}
              </span>
              {tour.status === 'pending' && (
                <>
                  <button
                    type="button"
                    className="tour-detail-btn tour-detail-btn-approve"
                    onClick={() => handleAction('approve')}
                    disabled={actioning}
                  >
                    {actioning ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
                    Approve
                  </button>
                  <button
                    type="button"
                    className="tour-detail-btn tour-detail-btn-reject"
                    onClick={() => handleAction('reject')}
                    disabled={actioning}
                  >
                    <X size={16} /> Reject
                  </button>
                </>
              )}
              {(tour.status === 'approved' || tour.status === 'pending') && (
                <button
                  type="button"
                  className="tour-detail-btn tour-detail-btn-suspend"
                  onClick={() => setSuspendModal(true)}
                  disabled={actioning}
                  title="Temporary – agency can fix and resubmit"
                >
                  <Pause size={16} /> Suspend
                </button>
              )}
              {(tour.status === 'approved' || tour.status === 'pending' || tour.status === 'suspended') && (
                <button
                  type="button"
                  className="tour-detail-btn"
                  onClick={() => window.confirm('Block this tour? Agency cannot create same tour again. Admin can reinstate.') && handleAction('block')}
                  disabled={actioning}
                  style={{ background: '#7f1d1d', color: '#fff' }}
                  title="Permanent – agency cannot create same tour"
                >
                  Block
                </button>
              )}
              {tour.status === 'blocked' && (
                <button
                  type="button"
                  className="tour-detail-btn tour-detail-btn-approve"
                  onClick={() => handleAction('reinstate')}
                  disabled={actioning}
                  title="Unblock and send to pending for review"
                >
                  Reinstate
                </button>
              )}
            </div>
            {suspendModal && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000,
                }}
                onClick={() => setSuspendModal(false)}
              >
                <div
                  className="tour-detail-section"
                  style={{
                    background: '#fff',
                    maxWidth: 420,
                    width: '90%',
                    padding: '1.5rem',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 style={{ margin: '0 0 1rem' }}>Suspend Tour (Temporary)</h3>
                  <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1rem' }}>
                    Agency will see reason and fix instructions. They can edit and resubmit for review.
                  </p>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem' }}>Reason *</label>
                    <textarea
                      value={suspendReason}
                      onChange={(e) => setSuspendReason(e.target.value)}
                      placeholder="e.g. Incorrect duration, missing meeting point"
                      rows={2}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #d1d5db' }}
                    />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem' }}>Fix Instructions *</label>
                    <textarea
                      value={suspendFix}
                      onChange={(e) => setSuspendFix(e.target.value)}
                      placeholder="e.g. Update duration to correct value. Add meeting point."
                      rows={3}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #d1d5db' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn-secondary" onClick={() => setSuspendModal(false)}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="tour-detail-btn tour-detail-btn-suspend"
                      onClick={handleSuspend}
                      disabled={actioning || !suspendReason.trim() || !suspendFix.trim()}
                    >
                      {actioning ? <Loader2 size={16} className="spin" /> : null} Suspend
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="tour-detail-grid">
              <section className="tour-detail-section">
                <h3>Basic Info</h3>
                <dl>
                  <dt>Country</dt>
                  <dd>{tour.country}</dd>
                  <dt>City</dt>
                  <dd>{tour.city}</dd>
                  <dt>Location</dt>
                  <dd>{tour.location || '—'}</dd>
                  <dt>Category</dt>
                  <dd>{CATEGORY_LABELS[tour.category] || tour.category}</dd>
                  <dt>Duration</dt>
                  <dd>{tour.durationMins ? `${tour.durationMins} mins` : '—'}</dd>
                  <dt>Languages</dt>
                  <dd>{(tour.languages || []).join(', ') || '—'}</dd>
                </dl>
              </section>
              {tour.agency && (
                <section className="tour-detail-section">
                  <h3>Agency</h3>
                  <dl>
                    <dt>Name</dt>
                    <dd>{tour.agency.name}</dd>
                    <dt>Email</dt>
                    <dd>{tour.agency.email}</dd>
                    <dt>Phone</dt>
                    <dd>{tour.agency.phone || '—'}</dd>
                    <dt>Country</dt>
                    <dd>{tour.agency.country}</dd>
                    <dt>Currency</dt>
                    <dd>{tour.agency.currency}</dd>
                  </dl>
                </section>
              )}
              <section className="tour-detail-section tour-detail-full">
                <h3>Description</h3>
                <p className="tour-detail-desc">{tour.description || '—'}</p>
              </section>
              {tour.includedServices && (
                <section className="tour-detail-section tour-detail-full">
                  <h3>Included Services</h3>
                  <pre className="tour-detail-pre">{tour.includedServices}</pre>
                </section>
              )}
              {tour.meetingPoint && (
                <section className="tour-detail-section tour-detail-full">
                  <h3>Meeting Point</h3>
                  <p>{tour.meetingPoint}</p>
                </section>
              )}
              {tour.cancellationPolicy && (
                <section className="tour-detail-section tour-detail-full">
                  <h3>Cancellation Policy</h3>
                  <p>{tour.cancellationPolicy}</p>
                </section>
              )}
              {(tour.images?.length > 0 || tour.videoUrl) && (
                <section className="tour-detail-section tour-detail-full">
                  <h3>Photos+Video</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    {(tour.images || []).map((url, i) => (
                      <img key={i} src={url} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }} />
                    ))}
                  </div>
                  {tour.videoUrl && (
                    <video src={tour.videoUrl} controls style={{ maxWidth: 240, maxHeight: 140, borderRadius: 8 }} />
                  )}
                </section>
              )}
              {tour.paxOptions && tour.paxOptions.length > 0 && (
                <section className="tour-detail-section tour-detail-full">
                  <h3>Pax Options & Prices</h3>
                  <table className="bookings-table">
                    <thead>
                      <tr>
                        <th>Label</th>
                        <th>Price</th>
                        <th>Currency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tour.paxOptions.map((p) => (
                        <tr key={p.id}>
                          <td>{p.label}</td>
                          <td>{Number(p.pricePerPax).toFixed(2)}</td>
                          <td>{p.currency}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}
              {tour.slots && tour.slots.length > 0 && (
                <section className="tour-detail-section tour-detail-full">
                  <h3>Available Slots (sample)</h3>
                  <table className="bookings-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Max Pax</th>
                        <th>Booked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tour.slots.slice(0, 10).map((s) => (
                        <tr key={s.id}>
                          <td>{s.slotDate}</td>
                          <td>{s.startTime}{s.endTime ? ` – ${s.endTime}` : ''}</td>
                          <td>{s.maxPax}</td>
                          <td>{s.bookedPax}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {tour.slots.length > 10 && (
                    <p className="tour-detail-more">+ {tour.slots.length - 10} more slots</p>
                  )}
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default TourDetail
