import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, ShieldCheck, ShieldX, Ban, AlertTriangle, Download, ExternalLink } from 'lucide-react'
import api from '../services/api'
import '../App.css'

const DOC_TYPES = ['brevete_frente', 'brevete_dorso', 'dni', 'selfie', 'soat', 'tarjeta_propiedad', 'foto_vehiculo']
const DOC_LABELS = {
  brevete_frente: 'Brevete - Frente',
  brevete_dorso: 'Brevete - Dorso',
  dni: 'DNI',
  selfie: 'Selfie',
  soat: 'SOAT',
  tarjeta_propiedad: 'Tarjeta de Propiedad',
  foto_vehiculo: 'Foto del vehículo',
}

const uploadsBase = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, '') : ''

const toDocArrayFromObject = (documentUrls = {}) => {
  const list = []
  Object.entries(documentUrls || {}).forEach(([documentType, fileUrl]) => {
    if (!DOC_TYPES.includes(documentType)) return
    if (!fileUrl || typeof fileUrl !== 'string') return
    list.push({ documentType, fileUrl })
  })
  return list
}

function DriverDetail() {
  const { driverId } = useParams()
  const navigate = useNavigate()
  const [driver, setDriver] = useState(null)
  const [documents, setDocuments] = useState([])
  const [auditEntries, setAuditEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actioning, setActioning] = useState(null)
  const [modal, setModal] = useState(null) // 'approve' | 'reject' | 'suspend' | 'reupload' | 'reject_doc'
  const [rejectReason, setRejectReason] = useState('')
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const [customRatePerKm, setCustomRatePerKm] = useState('')
  const [reuploadTypes, setReuploadTypes] = useState([])
  const [reuploadMessage, setReuploadMessage] = useState('')
  const [hasAntecedentesPoliciales, setHasAntecedentesPoliciales] = useState(false)
  const [hasAntecedentesPenales, setHasAntecedentesPenales] = useState(false)

  useEffect(() => {
    if (!driverId) return
    Promise.all([
      api.get(`/admin/drivers/${driverId}`),
      api.get(`/admin/drivers/${driverId}/documents`).catch(() => ({ data: { documents: [] } })),
      api.get(`/admin/drivers/${driverId}/audit`).catch(() => ({ data: { entries: [] } })),
    ])
      .then(([driverRes, docsRes, auditRes]) => {
        const d = driverRes.data.driver
        const docsFromApi = docsRes.data.documents || []
        const fallbackDocs = toDocArrayFromObject(d?.documentUrls)
        const mergedDocs = docsFromApi.length > 0 ? docsFromApi : fallbackDocs
        
        setDriver(d)
        setAdminNotes(d?.adminNotes ?? '')
        setCustomRatePerKm(d?.customRatePerKm != null ? String(d.customRatePerKm) : '')
        setHasAntecedentesPoliciales(!!d?.hasAntecedentesPoliciales)
        setHasAntecedentesPenales(!!d?.hasAntecedentesPenales)
        setDocuments(mergedDocs)
        setAuditEntries(auditRes.data.entries || [])
        setError('')
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem('token')
          navigate('/login', { replace: true })
          return
        }
        setError(err.response?.data?.error || err.message || 'Failed to load driver')
      })
      .finally(() => setLoading(false))
  }, [driverId, navigate])

  const handleVerify = (status, blockReason = null) => {
    setActioning(status)
    const body = blockReason != null ? { status, blockReason } : { status }
    api.post(`/admin/drivers/${encodeURIComponent(driverId)}/verify`, body)
      .then(({ data }) => {
        setDriver((d) => (d ? { ...d, status: data.status, blockReason: data.blockReason } : d))
        return api.get(`/admin/drivers/${driverId}/audit`)
      })
      .then((r) => setAuditEntries(r.data.entries || []))
      .catch((err) => setError(err.response?.data?.error || err.message || 'Failed'))
      .finally(() => {
        setActioning(null)
        setModal(null)
        setRejectReason('')
        setSuspendReason('')
      })
  }

  const handleVerifyDoc = (doc, status, feedback = null) => {
    if (!doc?.id) return
    setActioning(`doc-${doc.id}`)
    api.post(`/admin/drivers/${encodeURIComponent(driverId)}/documents/${doc.id}/verify`, {
      status,
      feedback
    })
      .then(({ data }) => {
        setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, status: data.status, adminFeedback: data.feedback } : d))
        setModal(null)
        setRejectReason('')
        setSelectedDoc(null)
      })
      .catch((err) => alert(err.response?.data?.error || err.message || 'Failed to verify document'))
      .finally(() => setActioning(null))
  }

  const handleSaveNotes = () => {
    setActioning('notes')
    api.patch(`/admin/drivers/${encodeURIComponent(driverId)}/notes`, { adminNotes: adminNotes || null })
      .then(({ data }) => setDriver((d) => (d ? { ...d, adminNotes: data.adminNotes } : d)))
      .catch((err) => setError(err.response?.data?.error || err.message || 'Failed to save notes'))
      .finally(() => setActioning(null))
  }

  const handleSaveRate = () => {
    setActioning('rate')
    const val = customRatePerKm.trim()
    api.patch(`/admin/drivers/${encodeURIComponent(driverId)}/rate`, {
      customRatePerKm: val === '' ? null : Number(val),
    })
      .then(({ data }) => {
        setDriver((d) => (d ? { ...d, customRatePerKm: data.customRatePerKm } : d))
        setCustomRatePerKm(data.customRatePerKm != null ? String(data.customRatePerKm) : '')
      })
      .catch((err) => setError(err.response?.data?.error || err.message || 'Failed to save rate'))
      .finally(() => setActioning(null))
  }

  const handleSaveAntecedentes = (nextPol, nextPen) => {
    if (!driverId) return
    setActioning('antecedentes')
    api.patch(`/admin/drivers/${encodeURIComponent(driverId)}/antecedentes`, {
      hasAntecedentesPoliciales: nextPol,
      hasAntecedentesPenales: nextPen,
    })
      .then(({ data }) => {
        setDriver((d) => (d ? {
          ...d,
          hasAntecedentesPoliciales: data?.hasAntecedentesPoliciales ?? nextPol,
          hasAntecedentesPenales: data?.hasAntecedentesPenales ?? nextPen,
        } : d))
        setHasAntecedentesPoliciales(data?.hasAntecedentesPoliciales ?? nextPol)
        setHasAntecedentesPenales(data?.hasAntecedentesPenales ?? nextPen)
        setError('')
      })
      .catch((err) => setError(err.response?.data?.error || err.message || 'Failed to save antecedentes'))
      .finally(() => setActioning(null))
  }

  const handleRequestReupload = () => {
    if (reuploadTypes.length === 0) return
    setActioning('reupload')
    api.post(`/admin/drivers/${encodeURIComponent(driverId)}/request-reupload`, {
      documentTypes: reuploadTypes,
      message: reuploadMessage || null,
    })
      .then(() => {
        setModal(null)
        setReuploadTypes([])
        setReuploadMessage('')
        return api.get(`/admin/drivers/${driverId}`)
      })
      .then((r) => setDriver(r.data.driver))
      .then(() => api.get(`/admin/drivers/${driverId}/audit`))
      .then((r) => setAuditEntries(r.data.entries || []))
      .catch((err) => setError(err.response?.data?.error || err.message || 'Failed to send request'))
      .finally(() => setActioning(null))
  }

  const toggleReuploadType = (type) => {
    setReuploadTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  const statusColor = (s) => {
    switch (s) {
      case 'approved': return '#10b981'
      case 'pending': return '#f59e0b'
      case 'rejected': return '#ef4444'
      case 'suspended': case 'temp_blocked': return '#6b7280'
      default: return '#6b7280'
    }
  }

  const formatDate = (iso) => {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    } catch (_) {
      return iso
    }
  }

  const driverPhotoUrl = driver?.photoUrl
    ? (driver.photoUrl.startsWith('http') ? driver.photoUrl : `${uploadsBase}${driver.photoUrl}`)
    : null

  const soatDoc = documents.find((d) => d.documentType === 'soat')
  const soatIssueDate = driver?.soatIssueDate || soatDoc?.issueDate || null
  const soatExpiryDate = driver?.soatExpiry || soatDoc?.expiryDate || null
  const resolvedDni = driver?.dni || driver?.dniNumber || null
  const resolvedLicenseNumber = driver?.licenseNumber || driver?.license || null

  if (loading) {
    return (
      <div className="dashboard-content">
        <div className="dashboard-loading">
          <Loader2 size={32} className="spin" />
          <span>Loading driver...</span>
        </div>
      </div>
    )
  }

  if (error || !driver) {
    return (
      <div className="dashboard-content">
        <button type="button" className="ride-detail-back" onClick={() => navigate('/drivers')}>
          <ArrowLeft size={18} /> Back to Drivers
        </button>
        <p className="dashboard-error">{error || 'Driver not found'}</p>
      </div>
    )
  }

  return (
    <div className="dashboard-content driver-detail">
      <button type="button" className="ride-detail-back" onClick={() => navigate('/drivers')}>
        <ArrowLeft size={18} /> Back to Drivers
      </button>

      <header className="driver-detail-header">
        <div className="driver-detail-header-left">
          <div className="drivers-avatar driver-detail-avatar">
            {driverPhotoUrl ? (
              // eslint-disable-next-line jsx-a11y/img-redundant-alt
              <img src={driverPhotoUrl} alt="Driver photo" className="drivers-avatar-img" />
            ) : (
              (driver.driverName || '?').charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <h1 className="driver-detail-name">{driver.driverName || '—'}</h1>
            {driver.rating != null && (
              <div className="drivers-rating" style={{ marginBottom: 4 }}>★ {Number(driver.rating).toFixed(1)}</div>
            )}
            <span
              className="bookings-status driver-detail-status"
              style={{ backgroundColor: statusColor(driver.status) }}
            >
              {driver.status}
            </span>
            <p className="driver-detail-subtitle">
              Driver ID: {driver.driverId || '—'}
            </p>
          </div>
        </div>
        <div className="driver-detail-header-actions">
          {driver.status === 'pending' && (
            <>
              <button
                type="button"
                className="dashboard-btn small success"
                disabled={!!actioning}
                onClick={() => setModal('approve')}
              >
                <ShieldCheck size={14} /> Approve
              </button>
              <button
                type="button"
                className="dashboard-btn small danger"
                disabled={!!actioning}
                onClick={() => setModal('reject')}
              >
                <ShieldX size={14} /> Reject
              </button>
            </>
          )}
          {(driver.status === 'rejected' || driver.status === 'suspended') && (
            <button
              type="button"
              className="dashboard-btn small"
              disabled={!!actioning}
              onClick={() => handleVerify('pending')}
            >
              Reinitiate
            </button>
          )}
          <button
            type="button"
            className="dashboard-btn small"
            style={{ background: '#b91c1c' }}
            disabled={!!actioning}
            onClick={() => { setModal('suspend'); setSuspendReason(''); }}
          >
            <Ban size={14} /> Suspend
          </button>
          <button
            type="button"
            className="dashboard-btn small"
            disabled={!!actioning}
            onClick={() => setModal('reupload')}
          >
            <AlertTriangle size={14} /> Request reupload
          </button>
        </div>
      </header>
      <p className="driver-detail-meta">
        Last review: {formatDate(driver.updatedAt)}
      </p>
      <div className="rule-banner">
        UI changes require approval. On edit, status resets to pending for re-approval.
      </div>

      <div className="driver-detail-grid">
        <div className="driver-detail-col">
          <section className="driver-detail-card">
            <h3>Personal Info</h3>
            <div className="driver-detail-fields">
              <div><span className="driver-detail-label">Name</span><span>{driver.driverName || '—'}</span></div>
              <div><span className="driver-detail-label">DNI</span><span>{resolvedDni || '—'}</span></div>
              <div><span className="driver-detail-label">Phone</span><span>{driver.phone || '—'}</span></div>
              <div><span className="driver-detail-label">Email</span><span>{driver.email || '—'}</span></div>
              <div><span className="driver-detail-label">City</span><span>{driver.city || '—'}</span></div>
            </div>
          </section>

          <section className="driver-detail-card">
            <h3>Antecedentes (editable)</h3>
            <div className="modal-form">
              <label>¿Tienes -Antecedentes policiales?</label>
              <div className="modal-inline">
                <button
                  type="button"
                  className={`antecedentes-toggle ${hasAntecedentesPoliciales ? 'active yes' : ''}`}
                  disabled={!!actioning}
                  onClick={() => handleSaveAntecedentes(true, hasAntecedentesPenales)}
                >
                  Sí
                </button>
                <button
                  type="button"
                  className={`antecedentes-toggle ${!hasAntecedentesPoliciales ? 'active no' : ''}`}
                  disabled={!!actioning}
                  onClick={() => handleSaveAntecedentes(false, hasAntecedentesPenales)}
                >
                  No
                </button>
              </div>

              <label style={{ marginTop: 12 }}>¿Tienes -Antecedentes penales?</label>
              <div className="modal-inline">
                <button
                  type="button"
                  className={`antecedentes-toggle ${hasAntecedentesPenales ? 'active yes' : ''}`}
                  disabled={!!actioning}
                  onClick={() => handleSaveAntecedentes(hasAntecedentesPoliciales, true)}
                >
                  Sí
                </button>
                <button
                  type="button"
                  className={`antecedentes-toggle ${!hasAntecedentesPenales ? 'active no' : ''}`}
                  disabled={!!actioning}
                  onClick={() => handleSaveAntecedentes(hasAntecedentesPoliciales, false)}
                >
                  No
                </button>
              </div>
            </div>
          </section>
          <section className="driver-detail-card">
            <h3>Vehicle Info</h3>
            <div className="driver-detail-fields">
              <div><span className="driver-detail-label">Plate</span><span>{driver.vehiclePlate || '—'}</span></div>
              <div><span className="driver-detail-label">Type</span><span>{driver.vehicleType || '—'}</span></div>
              <div><span className="driver-detail-label">Brand</span><span>{driver.vehicleBrand || '—'}</span></div>
              <div><span className="driver-detail-label">Model</span><span>{driver.vehicleModel || '—'}</span></div>
              <div><span className="driver-detail-label">Color</span><span>{driver.vehicleColor || '—'}</span></div>
              <div><span className="driver-detail-label">Year</span><span>{driver.registrationYear || '—'}</span></div>
              <div><span className="driver-detail-label">Capacity</span><span>{driver.vehicleCapacity ? `${driver.vehicleCapacity} passengers` : '—'}</span></div>
              <div>
                <span className="driver-detail-label">Custom rate (S/ per km)</span>
                <span>{driver.customRatePerKm != null ? Number(driver.customRatePerKm).toFixed(2) : '—'}</span>
              </div>
              <div>
                <span className="driver-detail-label">SOAT issue</span>
                <span>{soatIssueDate ? formatDate(soatIssueDate) : '—'}</span>
              </div>
              <div>
                <span className="driver-detail-label">SOAT expiry</span>
                <span>{soatExpiryDate ? formatDate(soatExpiryDate) : '—'}</span>
              </div>
            </div>
          </section>
          <section className="driver-detail-card">
            <h3>License Info</h3>
            <div className="driver-detail-fields">
              <div><span className="driver-detail-label">License Number</span><span>{resolvedLicenseNumber || '—'}</span></div>
              <div><span className="driver-detail-label">License Class</span><span>{driver.licenseClass || '—'}</span></div>
              <div><span className="driver-detail-label">Issue Date</span><span>{driver.licenseIssueDate ? formatDate(driver.licenseIssueDate) : '—'}</span></div>
              <div><span className="driver-detail-label">Expiry Date</span><span>{driver.licenseExpiryDate ? formatDate(driver.licenseExpiryDate) : '—'}</span></div>
            </div>
          </section>
          <section className="driver-detail-card">
            <h3>DNI Info</h3>
            <div className="driver-detail-fields">
              <div><span className="driver-detail-label">DNI Number</span><span>{resolvedDni || '—'}</span></div>
              <div><span className="driver-detail-label">Issue Date</span><span>{driver.dniIssueDate ? formatDate(driver.dniIssueDate) : '—'}</span></div>
              <div><span className="driver-detail-label">Expiry Date</span><span>{driver.dniExpiryDate ? formatDate(driver.dniExpiryDate) : '—'}</span></div>
            </div>
          </section>
          <section className="driver-detail-card">
            <h3>Internal notes (admin only)</h3>
            <textarea
              className="driver-notes-input"
              rows={3}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="e.g. Recheck after SOAT renewal"
            />
            <button
              type="button"
              className="dashboard-btn small"
              disabled={!!actioning}
              onClick={handleSaveNotes}
            >
              Save notes
            </button>
          </section>

          <section className="driver-detail-card">
            <h3>Pricing</h3>
            <div className="modal-form">
              <label>Custom rate (S/ per km)</label>
              <input
                type="number"
                step="0.01"
                value={customRatePerKm}
                onChange={(e) => setCustomRatePerKm(e.target.value)}
                placeholder="Leave empty to use default base rate"
              />
            </div>
            <button
              type="button"
              className="dashboard-btn small"
              disabled={!!actioning}
              onClick={handleSaveRate}
            >
              Save rate
            </button>
          </section>
        </div>
        <div className="driver-detail-col">
          <section className="driver-detail-card">
            <h3>Document Gallery</h3>
            <div className="driver-doc-grid">
              {DOC_TYPES.map((docType) => {
                // Find latest doc of this type (or specific one if we had multiple history, but current API returns list)
                const doc = documents.filter(d => d.documentType === docType).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
                
                const label = DOC_LABELS[docType]
                const fileUrl = doc?.fileUrl
                const fullUrl = fileUrl ? (fileUrl.startsWith('http') ? fileUrl : `${uploadsBase}${fileUrl}`) : null
                const expiry = doc?.expiryDate
                const docStatus = doc?.status || 'pending'
                const feedback = doc?.adminFeedback
                const isApproved = docStatus === 'approved'
                const isRejected = docStatus === 'rejected'

                return (
                  <div key={docType} className={`driver-doc-tile ${isRejected ? 'rejected' : ''} ${isApproved ? 'approved' : ''}`}>
                    <div className="driver-doc-header">
                      <span className="driver-doc-badge" style={{ 
                        background: isApproved ? '#10b981' : isRejected ? '#ef4444' : '#f59e0b',
                        color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 10, marginBottom: 4, display: 'inline-block' 
                      }}>
                        {docStatus.toUpperCase()}
                      </span>
                    </div>
                    <div className="driver-doc-thumb">
                      {fullUrl ? (
                        <a href={fullUrl} target="_blank" rel="noopener noreferrer" title="Preview">
                          <img src={fullUrl} alt={label} />
                        </a>
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                    <div className="driver-doc-name">{label}</div>
                    <div className="driver-doc-meta">
                      {fullUrl && (
                        <div className="driver-doc-actions">
                           <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="driver-doc-link">
                            <ExternalLink size={12} /> Open
                          </a>
                          {doc?.id && docStatus !== 'approved' && (
                             <button 
                               type="button" 
                               className="doc-action-btn approve"
                               disabled={!!actioning}
                               onClick={() => handleVerifyDoc(doc, 'approved')}
                             >
                               <ShieldCheck size={12} />
                             </button>
                          )}
                          {doc?.id && docStatus !== 'rejected' && (
                             <button 
                               type="button" 
                               className="doc-action-btn reject"
                               disabled={!!actioning}
                               onClick={() => { setSelectedDoc(doc); setRejectReason(''); setModal('reject_doc'); }}
                             >
                               <ShieldX size={12} />
                             </button>
                          )}
                        </div>
                      )}
                      {expiry && <span className="driver-doc-expiry">Expiry: {formatDate(expiry)}</span>}
                      {feedback && <span className="driver-doc-feedback">Reason: {feedback}</span>}
                      {!fullUrl && <span className="driver-doc-status">Missing</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
          <section className="driver-detail-card">
            <h3>Audit Log</h3>
            <div className="driver-audit">
              {auditEntries.length === 0 ? (
                <p className="driver-audit-empty">No audit entries yet.</p>
              ) : (
                <ul className="driver-audit-list">
                  {auditEntries.map((e) => (
                    <li key={e.id}>
                      <span className="driver-audit-time">{formatDate(e.createdAt)}</span>
                      <span className="driver-audit-actor">{e.actor}</span>
                      <span className="driver-audit-action">{e.action}</span>
                      {e.reason && <span className="driver-audit-reason">— {e.reason}</span>}
                      {e.oldStatus && e.newStatus && e.oldStatus !== e.newStatus && (
                        <span className="driver-audit-status">{e.oldStatus} → {e.newStatus}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>

      {driver.blockReason && (
        <section className="driver-detail-card driver-block-reason">
          <h3>Block reason</h3>
          <p>{driver.blockReason}</p>
        </section>
      )}

      {modal === 'approve' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Approve driver</h3>
            <p>Approve this driver and allow them to go online?</p>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button
                type="button"
                className="btn-approve"
                disabled={actioning}
                onClick={() => handleVerify('approved')}
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
      {modal === 'reject' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Reject driver</h3>
            <p>Reason (required, shown to driver):</p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Document unclear, please resubmit"
            />
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button
                type="button"
                className="btn-decline"
                disabled={actioning || !rejectReason.trim()}
                onClick={() => handleVerify('rejected', rejectReason.trim())}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
      {modal === 'reject_doc' && selectedDoc && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Reject Document</h3>
            <p>Reason for rejection (required):</p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Blur, Expired, Wrong Type"
            />
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button
                type="button"
                className="btn-decline"
                disabled={actioning || !rejectReason.trim()}
                onClick={() => handleVerifyDoc(selectedDoc, 'rejected', rejectReason.trim())}
              >
                Reject Document
              </button>
            </div>
          </div>
        </div>
      )}
      {modal === 'suspend' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Suspend driver</h3>
            <p>Reason (required):</p>
            <textarea
              rows={3}
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="e.g. Policy violation"
            />
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button
                type="button"
                className="btn-decline"
                disabled={actioning || !suspendReason.trim()}
                onClick={() => handleVerify('suspended', suspendReason.trim())}
              >
                Suspend
              </button>
            </div>
          </div>
        </div>
      )}
      {modal === 'reupload' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-content driver-reupload-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Request reupload</h3>
            <p>Select documents the driver must re-upload. Instructions (optional, shown to driver):</p>
            <textarea
              rows={2}
              placeholder="e.g. Please upload clearer photos"
              value={reuploadMessage}
              onChange={(e) => setReuploadMessage(e.target.value)}
            />
            <div className="driver-reupload-checkboxes">
              {DOC_TYPES.map((docType) => (
                <label key={docType} className="driver-reupload-check">
                  <input
                    type="checkbox"
                    checked={reuploadTypes.includes(docType)}
                    onChange={() => toggleReuploadType(docType)}
                  />
                  {DOC_LABELS[docType]}
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button
                type="button"
                className="dashboard-btn"
                disabled={actioning || reuploadTypes.length === 0}
                onClick={handleRequestReupload}
              >
                Send request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DriverDetail
