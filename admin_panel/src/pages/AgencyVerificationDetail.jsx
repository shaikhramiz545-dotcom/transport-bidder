import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Loader2, ArrowLeft, Check, X, FileText } from 'lucide-react'
import api from '../services/api'
import '../App.css'

const DOC_LABELS = {
  business_license: 'Business license',
  tax_id: 'Tax ID document',
  id_proof: 'ID proof',
  company_registration: 'Company registration',
}

function AgencyVerificationDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [agency, setAgency] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actioning, setActioning] = useState(null)
  const [actionModal, setActionModal] = useState(null) // 'approve' | 'reject' | 'request_documents'
  const [note, setNote] = useState('')

  const fetchAgency = () => {
    setLoading(true)
    api.get(`/admin/travel-agencies/${id}`)
      .then(({ data }) => {
        setAgency(data)
        setError('')
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem('token')
          navigate('/login', { replace: true })
          return
        }
        setError(err.response?.data?.error || err.message || 'Failed to load agency')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (id) fetchAgency()
  }, [id])

  const uploadBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

  const handleVerify = (action) => {
    setActioning(action)
    const body = { action, note: note.trim() || undefined }
    api.post(`/admin/travel-agencies/${id}/verify`, body)
      .then(() => {
        setActionModal(null)
        setNote('')
        fetchAgency()
      })
      .catch((err) => {
        setError(err.response?.data?.error || err.message || 'Action failed')
      })
      .finally(() => setActioning(null))
  }

  const getDocByType = (type) => (agency?.documents || []).find((d) => d.documentType === type)
  const isImage = (url) => /\.(jpe?g|png|gif|webp)$/i.test(url || '')

  if (loading) {
    return (
      <div className="dashboard-loading">
        <Loader2 size={32} className="spin" />
        <span>Loading agency...</span>
      </div>
    )
  }

  if (error && !agency) {
    return (
      <>
        <p className="dashboard-error">{error}</p>
        <button type="button" className="dashboard-btn" onClick={() => navigate('/tours/agency-verification')}>
          <ArrowLeft size={16} /> Back to list
        </button>
      </>
    )
  }

  return (
    <>
      <button
        type="button"
        className="tour-detail-back"
        onClick={() => navigate('/tours/agency-verification')}
        style={{ marginBottom: '1rem' }}
      >
        <ArrowLeft size={16} /> Back to Agency Verification
      </button>

      {error && <p className="dashboard-error">{error}</p>}

      {agency && (
        <div className="agency-verification-detail">
          <section className="agency-verification-info">
            <h2>Agency details</h2>
            <dl>
              <dt>Name</dt>
              <dd>{agency.name}</dd>
              <dt>Email</dt>
              <dd>{agency.email}</dd>
              <dt>Phone</dt>
              <dd>{agency.phone || '—'}</dd>
              <dt>Country</dt>
              <dd>{agency.country}</dd>
              <dt>Currency</dt>
              <dd>{agency.currency}</dd>
              <dt>Status</dt>
              <dd>
                <span
                  className="bookings-status"
                  style={{
                    backgroundColor:
                      agency.status === 'approved' ? '#10b981' : agency.status === 'rejected' ? '#ef4444' : '#f59e0b',
                  }}
                >
                  {agency.status}
                </span>
              </dd>
              {agency.verificationNote && (
                <>
                  <dt>Admin note (shown to agency)</dt>
                  <dd style={{ maxWidth: 400 }}>{agency.verificationNote}</dd>
                </>
              )}
            </dl>
          </section>

          <section className="agency-verification-docs">
            <h2>Documents & requirements</h2>
            <p className="page-placeholder-desc">All required documents with preview. Until documents are confirmed, agency status remains pending.</p>
            <div className="agency-doc-grid">
              {(agency.requiredDocTypes || []).map((type) => {
                const doc = getDocByType(type)
                const label = DOC_LABELS[type] || type
                const previewUrl = doc?.fileUrl ? (uploadBase + doc.fileUrl) : null
                return (
                  <div key={type} className="agency-doc-card">
                    <div className="agency-doc-card-header">
                      <FileText size={18} />
                      <span>{label}</span>
                      {doc ? (
                        <span className="agency-doc-badge uploaded">Uploaded</span>
                      ) : (
                        <span className="agency-doc-badge missing">Missing</span>
                      )}
                    </div>
                    {doc && (
                      <div className="agency-doc-preview">
                        {isImage(doc.fileUrl) ? (
                          <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                            <img src={previewUrl} alt={label} style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain' }} />
                          </a>
                        ) : (
                          <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="agency-doc-link">
                            View / download: {doc.fileName || doc.fileUrl}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          <section className="agency-verification-actions">
            <h2>Decision</h2>
            <div className="verification-actions">
              <button
                type="button"
                className="dashboard-btn success"
                disabled={actioning}
                onClick={() => setActionModal('approve')}
              >
                <Check size={16} /> Approve
              </button>
              <button
                type="button"
                className="dashboard-btn danger"
                disabled={actioning}
                onClick={() => setActionModal('reject')}
              >
                <X size={16} /> Application decline
              </button>
              <button
                type="button"
                className="dashboard-btn"
                disabled={actioning}
                onClick={() => setActionModal('request_documents')}
              >
                <FileText size={16} /> Request more documents
              </button>
            </div>
          </section>
        </div>
      )}

      {actionModal && (
        <div className="modal-overlay" onClick={() => !actioning && setActionModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>
              {actionModal === 'approve' && 'Approve agency'}
              {actionModal === 'reject' && 'Decline application'}
              {actionModal === 'request_documents' && 'Request more documents'}
            </h3>
            {(actionModal === 'reject' || actionModal === 'request_documents') && (
              <>
                <p>Message to agency (optional; sent by email):</p>
                <textarea
                  rows={3}
                  placeholder={
                    actionModal === 'request_documents'
                      ? 'e.g. Please upload business license and tax ID.'
                      : 'e.g. Reason for decline.'
                  }
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  style={{ width: '100%', marginBottom: '1rem' }}
                />
              </>
            )}
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => !actioning && setActionModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={actionModal === 'approve' ? 'btn-approve' : 'btn-decline'}
                disabled={actioning}
                onClick={() => handleVerify(actionModal)}
              >
                {actioning ? <Loader2 size={16} className="spin" /> : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default AgencyVerificationDetail
