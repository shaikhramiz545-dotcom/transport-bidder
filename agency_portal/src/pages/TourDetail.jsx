import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, ArrowLeft, Trash2, Pencil } from 'lucide-react'
import api from '../services/api'
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
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    api.get(`/agency/tours/${id}`)
      .then(({ data }) => {
        setTour(data)
        setError('')
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          navigate('/login', { replace: true })
          return
        }
        setError(err.response?.data?.error || 'Failed to load')
      })
      .finally(() => setLoading(false))
  }, [id, navigate])

  const handleDelete = async () => {
    if (!window.confirm('Delete this tour? This cannot be undone.')) return
    setDeleting(true)
    try {
      await api.delete(`/agency/tours/${id}`)
      navigate('/tours', { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="agency-card">
        <div className="agency-loading">
          <Loader2 size={24} className="spin" /> Loading...
        </div>
      </div>
    )
  }

  if (error && !tour) {
    return (
      <div className="agency-card">
        <p className="agency-error">{error}</p>
        <button type="button" className="btn-secondary" onClick={() => navigate('/tours')}>
          <ArrowLeft size={16} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />
          Back to Tours
        </button>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn-secondary" onClick={() => navigate('/tours')}>
          <ArrowLeft size={16} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />
          Back
        </button>
        <h2 style={{ margin: 0 }}>{tour?.title}</h2>
        {((tour?.flags?.length > 0) || tour?.freeCancellation) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
            {(tour.flags || []).map((f, i) => {
              const bg = { new_arrival: '#10b981', most_selling: '#7c3aed', top_rated: '#eab308', booked_yesterday: '#0369a1' }[f.type] || '#0369a1'
              return (
                <span key={i} style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 4, background: bg, color: '#fff', fontWeight: 600 }}>
                  {f.text}
                </span>
              )
            })}
            {tour.freeCancellation && (
              <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 4, background: '#059669', color: '#fff', fontWeight: 600 }}>
                Free cancellation
              </span>
            )}
          </div>
        )}
        <span className={`agency-status ${tour?.status}`} style={{ marginLeft: 'auto' }}>{tour?.status}</span>
        {tour?.status !== 'blocked' && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate(`/tours/${id}/edit`)}
            style={{ background: '#e0f2fe', color: '#0369a1' }}
          >
            <Pencil size={16} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />
            Edit
          </button>
        )}
        {tour?.status !== 'blocked' && (
          <button
            type="button"
            className="btn-secondary"
            style={{ background: '#fee', color: '#c00' }}
            onClick={handleDelete}
            disabled={deleting}
          >
            <Trash2 size={16} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        )}
      </div>
      {error && <p className="agency-error">{error}</p>}
      {tour?.status === 'suspended' && (tour?.suspendReason || tour?.suspendFixInstructions) && (
        <div
          className="agency-card"
          style={{
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            marginBottom: '1rem',
          }}
        >
          <h3 style={{ margin: '0 0 0.5rem', color: '#92400e' }}>⚠️ Tour Suspended – Action Required</h3>
          {tour.suspendReason && (
            <>
              <p style={{ fontWeight: 600, margin: '0.5rem 0 0.25rem', color: '#78350f' }}>Reason:</p>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#78350f' }}>{tour.suspendReason}</p>
            </>
          )}
          {tour.suspendFixInstructions && (
            <>
              <p style={{ fontWeight: 600, margin: '0.75rem 0 0.25rem', color: '#78350f' }}>How to fix:</p>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#78350f' }}>{tour.suspendFixInstructions}</p>
            </>
          )}
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.875rem', color: '#92400e' }}>
            Edit the tour as per instructions above and save. It will go to Pending for admin review.
          </p>
        </div>
      )}
      {tour?.status === 'blocked' && (
        <div
          className="agency-card"
          style={{ background: '#fee', border: '1px solid #c00', marginBottom: '1rem' }}
        >
          <p style={{ margin: 0, color: '#7f1d1d' }}>
            This tour is blocked. Contact admin for reinstatement. You cannot create a new tour with the same title.
          </p>
        </div>
      )}
      <div className="agency-card">
        <dl style={{ margin: 0 }}>
          <dt style={{ fontWeight: 600, marginTop: '0.75rem' }}>Location</dt>
          <dd style={{ margin: '0.25rem 0 0' }}>{tour?.city}, {tour?.country} {tour?.location ? `– ${tour.location}` : ''}</dd>
          <dt style={{ fontWeight: 600, marginTop: '0.75rem' }}>Category</dt>
          <dd style={{ margin: '0.25rem 0 0' }}>{CATEGORY_LABELS[tour?.category] || tour?.category}</dd>
          {tour?.description && (
            <>
              <dt style={{ fontWeight: 600, marginTop: '0.75rem' }}>Description</dt>
              <dd style={{ margin: '0.25rem 0 0', whiteSpace: 'pre-wrap' }}>{tour.description}</dd>
            </>
          )}
          {(tour?.images?.length > 0 || tour?.videoUrl) && (
            <>
              <dt style={{ fontWeight: 600, marginTop: '0.75rem' }}>Photos+Video</dt>
              <dd style={{ margin: '0.25rem 0 0' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  {(tour.images || []).map((url, i) => (
                    <img key={i} src={url} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }} />
                  ))}
                </div>
                {tour.videoUrl && (
                  <video src={tour.videoUrl} controls style={{ maxWidth: 240, maxHeight: 140, borderRadius: 8 }} />
                )}
              </dd>
            </>
          )}
          {tour?.paxOptions?.length > 0 && (
            <>
              <dt style={{ fontWeight: 600, marginTop: '0.75rem' }}>Pricing</dt>
              <dd style={{ margin: '0.25rem 0 0' }}>
                {tour.paxOptions.map((p) => (
                  <span key={p.id} style={{ display: 'block' }}>
                    {p.label}: {p.pricePerPax} {p.currency}/pax
                  </span>
                ))}
              </dd>
            </>
          )}
        </dl>
      </div>
    </div>
  )
}

export default TourDetail
