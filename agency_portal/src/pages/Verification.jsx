import { useState, useEffect } from 'react'
import { Loader2, CheckCircle, XCircle, AlertCircle, FileText, Upload } from 'lucide-react'
import api from '../services/api'
import '../App.css'

function Verification() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(null) // documentType being uploaded
  const [uploadError, setUploadError] = useState('')

  const fetchStatus = () => {
    setLoading(true)
    setError('')
    api.get('/agency/verification-status')
      .then(({ data: res }) => {
        setData(res)
      })
      .catch((err) => {
        setError(err.response?.data?.error || err.message || 'Failed to load verification status')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const getDocByType = (type) => (data?.documents || []).find((d) => d.documentType === type)

  const handleUpload = (documentType, file) => {
    if (!file) return
    setUploadError('')
    setUploading(documentType)
    const form = new FormData()
    form.append('documentType', documentType)
    form.append('file', file)
    api.post('/agency/documents', form)
      .then(() => {
        fetchStatus()
      })
      .catch((err) => {
        setUploadError(err.response?.data?.error || err.message || 'Upload failed')
      })
      .finally(() => setUploading(null))
  }

  const uploadBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

  if (loading) {
    return (
      <div className="agency-page">
        <div className="agency-loading">
          <Loader2 size={32} className="spin" />
          <span>Loading verification status...</span>
        </div>
      </div>
    )
  }

  const status = data?.status || 'pending'
  const note = data?.verificationNote || ''
  const requiredDocTypes = data?.requiredDocTypes || []
  const requiredDocLabels = data?.requiredDocLabels || {}

  return (
    <div className="agency-page">
      <h1 className="agency-page-title">Account verification</h1>
      <p className="agency-page-desc">
        Upload the required documents. Until your account is verified, status will show as pending. You will receive an email when the status changes.
      </p>

      {error && <p className="agency-error">{error}</p>}
      {uploadError && <p className="agency-error">{uploadError}</p>}

      <section className="verification-status-card">
        <div className="verification-status-header">
          {status === 'approved' && <CheckCircle size={28} style={{ color: '#10b981' }} />}
          {status === 'rejected' && <XCircle size={28} style={{ color: '#ef4444' }} />}
          {(status === 'pending' || status === 'needs_documents') && <AlertCircle size={28} style={{ color: '#f59e0b' }} />}
          <div>
            <div className="verification-status-label">Status</div>
            <div className="verification-status-value">
              {status === 'approved' && 'Approved'}
              {status === 'rejected' && 'Application declined'}
              {status === 'pending' && 'Pending review'}
              {status === 'needs_documents' && 'More documents required'}
            </div>
          </div>
        </div>
        {note && (
          <div className="verification-note">
            <strong>Message from admin:</strong> {note}
          </div>
        )}
      </section>

      <section className="verification-docs-section">
        <h2 className="verification-docs-title">Required documents</h2>
        <p className="agency-page-desc">
          Upload each document below. If admin requests more or updated documents, you can re-upload here.
        </p>
        <div className="verification-docs-list">
          {requiredDocTypes.map((type) => {
            const doc = getDocByType(type)
            const label = requiredDocLabels[type] || type
            const previewUrl = doc?.fileUrl ? (uploadBase + doc.fileUrl) : null
            const isUploading = uploading === type
            return (
              <div key={type} className="verification-doc-card">
                <div className="verification-doc-header">
                  <FileText size={20} />
                  <span>{label}</span>
                  {doc ? (
                    <span className="verification-doc-badge uploaded">Uploaded</span>
                  ) : (
                    <span className="verification-doc-badge missing">Missing</span>
                  )}
                </div>
                {doc && (
                  <div className="verification-doc-preview">
                    <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="verification-doc-link">
                      View: {doc.fileName || doc.fileUrl}
                    </a>
                  </div>
                )}
                <div className="verification-doc-upload">
                  <label className="verification-doc-upload-label">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      disabled={isUploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleUpload(type, f)
                        e.target.value = ''
                      }}
                    />
                    <span className="verification-doc-upload-btn">
                      {isUploading ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
                      {doc ? 'Replace' : 'Upload'}
                    </span>
                  </label>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

export default Verification
