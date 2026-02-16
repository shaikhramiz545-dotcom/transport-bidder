import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, PlusCircle } from 'lucide-react'
import api from '../services/api'
import '../App.css'

const CATEGORY_LABELS = {
  full_day: 'Full Day',
  night_tour: 'Night Tour',
  adventure: 'Adventure',
  cultural: 'Cultural',
  family: 'Family',
}

function MyTours() {
  const navigate = useNavigate()
  const [tours, setTours] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/agency/tours')
      .then(({ data }) => {
        setTours(data.tours || [])
        setError('')
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem('agency_token')
          navigate('/login', { replace: true })
          return
        }
        setError(err.response?.data?.error || 'Failed to load tours')
      })
      .finally(() => setLoading(false))
  }, [navigate])

  const formatDate = (iso) => {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'short' })
    } catch (_) {
      return iso
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>My Tours</h2>
        <button type="button" className="btn-primary" onClick={() => navigate('/tours/add')}>
          <PlusCircle size={18} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />
          Add Tour
        </button>
      </div>
      <div className="agency-card">
        {loading && (
          <div className="agency-loading">
            <Loader2 size={24} className="spin" /> Loading tours...
          </div>
        )}
        {error && <p className="agency-error">{error}</p>}
        {!loading && !error && (
          <table className="agency-table">
            <thead>
              <tr>
                <th style={{ width: 64 }}></th>
                <th>Title</th>
                <th>Location</th>
                <th>Category</th>
                <th>Price from</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {tours.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                    No tours yet. Add your first tour!
                  </td>
                </tr>
              ) : (
                tours.map((t) => (
                  <tr
                    key={t.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/tours/${t.id}`)}
                  >
                    <td style={{ padding: '0.35rem', verticalAlign: 'middle' }}>
                      <div style={{ position: 'relative', width: 52, height: 52 }}>
                        {t.thumbnailUrl ? (
                          <img
                            src={t.thumbnailUrl}
                            alt=""
                            style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8 }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 52,
                              height: 52,
                              background: '#e5e7eb',
                              borderRadius: 8,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.7rem',
                              color: '#9ca3af',
                            }}
                          >
                            —
                          </div>
                        )}
                        {((t.flags?.length > 0) || t.freeCancellation) && (
                          <div style={{ position: 'absolute', top: 2, right: 2, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
                            {(t.flags || []).slice(0, 2).map((f, i) => {
                              const bg = { new_arrival: '#10b981', most_selling: '#7c3aed', top_rated: '#eab308', booked_yesterday: '#0369a1' }[f.type] || '#0369a1'
                              return (
                                <span key={i} style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: 4, background: bg, color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', maxWidth: 48, overflow: 'hidden', textOverflow: 'ellipsis', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                                  {f.text}
                                </span>
                              )
                            })}
                            {t.freeCancellation && (
                              <span style={{ fontSize: '0.55rem', padding: '1px 3px', borderRadius: 3, background: '#059669', color: '#fff', fontWeight: 600, boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                                Free cancel
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>{t.title}</td>
                    <td>{t.city}, {t.country}</td>
                    <td>{CATEGORY_LABELS[t.category] || t.category}</td>
                    <td>{t.startingPrice != null ? `${t.startingPrice} / pax` : '—'}</td>
                    <td>
                      <span className={`agency-status ${t.status}`}>{t.status}</span>
                    </td>
                    <td>{formatDate(t.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default MyTours
