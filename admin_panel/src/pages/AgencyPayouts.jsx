import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFeatureByPath } from '../config/firm'
import api from '../services/api'
import { Loader2, Check, X, Banknote, Send } from 'lucide-react'
import '../App.css'

function formatDate(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) } catch (_) { return String(d) }
}

function AgencyPayouts() {
  const navigate = useNavigate()
  const feature = getFeatureByPath('/agency-payouts')
  const title = feature?.label ?? 'Agency Payouts'
  const [payouts, setPayouts] = useState([])
  const [agencies, setAgencies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processingId, setProcessingId] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterAgencyId, setFilterAgencyId] = useState('')
  const [showCompleteModal, setShowCompleteModal] = useState(null)
  const [completeGatewayPercent, setCompleteGatewayPercent] = useState(2)
  const [completeTransferFee, setCompleteTransferFee] = useState(5)
  const [showPayNow, setShowPayNow] = useState(false)
  const [payAgencyId, setPayAgencyId] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [payGatewayPercent, setPayGatewayPercent] = useState(2)
  const [payTransferFee, setPayTransferFee] = useState(5)
  const [rejectNote, setRejectNote] = useState({})
  const [showRejectModal, setShowRejectModal] = useState(null)

  const fetchPayouts = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterStatus) params.set('status', filterStatus)
    if (filterAgencyId) params.set('travelAgencyId', filterAgencyId)
    api.get(`/admin/agency-payouts?${params.toString()}`)
      .then(({ data }) => { setPayouts(data.payouts || []); setError('') })
      .catch((err) => {
        if (err.response?.status === 401) { localStorage.removeItem('token'); navigate('/login', { replace: true }); return }
        setError(err.response?.data?.error || err.message || 'Failed to load')
        setPayouts([])
      })
      .finally(() => setLoading(false))
  }

  const fetchAgencies = () => {
    api.get('/admin/travel-agencies')
      .then(({ data }) => setAgencies(data.agencies || []))
      .catch(() => setAgencies([]))
  }

  useEffect(() => { fetchPayouts() }, [navigate, filterStatus, filterAgencyId])
  useEffect(() => { fetchAgencies() }, [])

  const handleComplete = async (id) => {
    setProcessingId(id)
    try {
      await api.post(`/admin/agency-payouts/${id}/complete`, {
        gatewayPercent: completeGatewayPercent,
        transferFee: completeTransferFee,
      })
      setShowCompleteModal(null)
      fetchPayouts()
    } catch (err) {
      if (err.response?.status === 401) { localStorage.removeItem('token'); navigate('/login', { replace: true }); return }
      setError(err.response?.data?.error || err.message || 'Failed to complete')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (id) => {
    setProcessingId(id)
    try {
      await api.post(`/admin/agency-payouts/${id}/reject`, { adminNote: rejectNote[id] || '' })
      setShowRejectModal(null)
      setRejectNote((prev) => { const p = { ...prev }; delete p[id]; return p })
      fetchPayouts()
    } catch (err) {
      if (err.response?.status === 401) { localStorage.removeItem('token'); navigate('/login', { replace: true }); return }
      setError(err.response?.data?.error || err.message || 'Failed to reject')
    } finally {
      setProcessingId(null)
    }
  }

  const handlePayNow = async (e) => {
    e.preventDefault()
    if (!payAgencyId || !payAmount || Number(payAmount) <= 0) {
      setError('Select agency and enter a valid amount')
      return
    }
    setProcessingId('paynow')
    setError('')
    try {
      await api.post('/admin/agency-payouts/create', {
        travelAgencyId: payAgencyId,
        amount: Number(payAmount),
        gatewayPercent: payGatewayPercent,
        transferFee: payTransferFee,
      })
      setShowPayNow(false)
      setPayAgencyId('')
      setPayAmount('')
      fetchPayouts()
      fetchAgencies()
    } catch (err) {
      if (err.response?.status === 401) { localStorage.removeItem('token'); navigate('/login', { replace: true }); return }
      setError(err.response?.data?.error || err.message || 'Failed to pay')
    } finally {
      setProcessingId(null)
    }
  }

  const selectedAgencyBalance = agencies.find((a) => String(a.id) === payAgencyId)
  const maxPay = selectedAgencyBalance ? Number(selectedAgencyBalance.balance) : 0

  return (
    <>
      <header className="dashboard-header">
        <h1 className="dashboard-header-title">{title}</h1>
        <button
          type="button"
          className="btn-primary"
          onClick={() => { setShowPayNow(true); setError(''); setPayAgencyId(''); setPayAmount(''); }}
        >
          <Banknote size={18} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />
          Pay agency now
        </button>
      </header>
      <div className="dashboard-content">
        <p className="page-placeholder-desc">
          Complete pending payout requests (gateway & transfer fee deducted) or pay any travel agency anytime. Email with booking history + PDF/Excel is sent to the agency.
        </p>

        {showPayNow && (
          <div className="agency-card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem' }}>Pay agency now</h3>
            <form onSubmit={handlePayNow}>
              {error && <p className="dashboard-error">{error}</p>}
              <div className="form-row">
                <label>Agency *</label>
                <select value={payAgencyId} onChange={(e) => setPayAgencyId(e.target.value)} required>
                  <option value="">Select agency</option>
                  {agencies.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} (Balance: {Number(a.balance || 0).toFixed(2)} {a.balanceCurrency || 'USD'})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={maxPay}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder={`Max ${maxPay.toFixed(2)}`}
                  required
                />
              </div>
              <div className="form-row two-cols">
                <div>
                  <label>Gateway % (deducted)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={payGatewayPercent}
                    onChange={(e) => setPayGatewayPercent(Number(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label>Transfer fee (deducted)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={payTransferFee}
                    onChange={(e) => setPayTransferFee(Number(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="submit" className="btn-primary" disabled={processingId === 'paynow'}>
                  {processingId === 'paynow' ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
                  Pay & send email
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowPayNow(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: 'auto' }}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
          <select value={filterAgencyId} onChange={(e) => setFilterAgencyId(e.target.value)} style={{ width: 'auto', minWidth: '180px' }}>
            <option value="">All agencies</option>
            {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        {error && <p className="dashboard-error">{error}</p>}
        {loading ? (
          <div className="dashboard-loading">
            <Loader2 size={32} className="spin" />
            <span>Loading payouts...</span>
          </div>
        ) : (
          <div className="bookings-list">
            <table className="bookings-table">
              <thead>
                <tr>
                  <th>Agency</th>
                  <th>Amount</th>
                  <th>Gateway / Transfer / Net</th>
                  <th>Status</th>
                  <th>Requested</th>
                  <th>Processed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payouts.length === 0 ? (
                  <tr><td colSpan={7} className="bookings-empty">No payouts for this filter.</td></tr>
                ) : (
                  payouts.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div>{p.agencyName || '—'}</div>
                        {p.agencyEmail && <div style={{ fontSize: '0.8em', color: '#666' }}>{p.agencyEmail}</div>}
                      </td>
                      <td>{Number(p.amount).toFixed(2)} {p.currency || 'USD'}</td>
                      <td>
                        {p.netAmount != null ? (
                          <>
                            {Number(p.gatewayCharges || 0).toFixed(2)} / {Number(p.transferFee || 0).toFixed(2)} → <strong>{Number(p.netAmount).toFixed(2)}</strong> {p.currency || 'USD'}
                          </>
                        ) : '—'}
                      </td>
                      <td>
                        <span className={`agency-status ${p.status === 'completed' ? 'approved' : p.status === 'rejected' ? 'rejected' : 'pending'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td>{formatDate(p.createdAt)}</td>
                      <td>{formatDate(p.processedAt)}</td>
                      <td>
                        {p.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              className="btn-primary"
                              style={{ marginRight: '0.35rem', padding: '0.35rem 0.6rem', fontSize: '0.875rem' }}
                              onClick={() => setShowCompleteModal(p)}
                            >
                              <Check size={14} /> Complete
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.875rem' }}
                              onClick={() => setShowRejectModal(p)}
                            >
                              <X size={14} /> Reject
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCompleteModal && (
        <div className="modal-overlay" onClick={() => setShowCompleteModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem' }}>Complete payout – {showCompleteModal.agencyName}</h3>
            <p style={{ margin: '0 0 1rem', color: '#666' }}>
              Amount: {Number(showCompleteModal.amount).toFixed(2)} {showCompleteModal.currency || 'USD'}. Gateway and transfer fee will be deducted; email with PDF/Excel will be sent to the agency.
            </p>
            <div className="form-row">
              <label>Gateway % (deducted)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={completeGatewayPercent}
                onChange={(e) => setCompleteGatewayPercent(Number(e.target.value) || 0)}
              />
            </div>
            <div className="form-row">
              <label>Transfer fee (deducted)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={completeTransferFee}
                onChange={(e) => setCompleteTransferFee(Number(e.target.value) || 0)}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="button" className="btn-primary" onClick={() => handleComplete(showCompleteModal.id)} disabled={processingId === showCompleteModal.id}>
                {processingId === showCompleteModal.id ? <Loader2 size={18} className="spin" /> : <Check size={18} />}
                Complete & send email
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowCompleteModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem' }}>Reject payout – {showRejectModal.agencyName}</h3>
            <p style={{ margin: '0 0 1rem', color: '#666' }}>Amount will be refunded to the agency wallet.</p>
            <div className="form-row">
              <label>Note (optional)</label>
              <input
                type="text"
                value={rejectNote[showRejectModal.id] || ''}
                onChange={(e) => setRejectNote((prev) => ({ ...prev, [showRejectModal.id]: e.target.value }))}
                placeholder="Reason for rejection"
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="button" className="btn-primary" style={{ background: '#ef4444' }} onClick={() => handleReject(showRejectModal.id)} disabled={processingId === showRejectModal.id}>
                {processingId === showRejectModal.id ? <Loader2 size={18} className="spin" /> : <X size={18} />}
                Reject & refund
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowRejectModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal-content { background: #fff; padding: 1.5rem; border-radius: 12px; max-width: 420px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
      `}</style>
    </>
  )
}

export default AgencyPayouts
