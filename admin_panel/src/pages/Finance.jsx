import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFeatureByPath } from '../config/firm'
import api from '../services/api'
import { Loader2, Check, X, FileText, Download, Eye } from 'lucide-react'
import '../App.css'

function Finance() {
  const navigate = useNavigate()
  const feature = getFeatureByPath('/finance')
  const title = feature?.label ?? 'Driver Payments'
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processingId, setProcessingId] = useState(null)
  const [declineNote, setDeclineNote] = useState({})
  const [showDeclineModal, setShowDeclineModal] = useState(null)
  const [showApproveModal, setShowApproveModal] = useState(null)
  const [showDetail, setShowDetail] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterDriverId, setFilterDriverId] = useState('')

  const fetchTransactions = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterStatus) params.set('status', filterStatus)
    if (filterFrom) params.set('from', filterFrom)
    if (filterTo) params.set('to', filterTo)
    if (filterDriverId) params.set('driverId', filterDriverId)
    api.get(`/admin/wallet-transactions?${params.toString()}`)
      .then(({ data }) => {
        setTransactions(data.transactions || [])
        setError('')
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem('token')
          navigate('/login', { replace: true })
          return
        }
        setError(err.response?.data?.error || err.message || 'Failed to load')
      })
      .finally(() => setLoading(false))
  }, [navigate, filterStatus, filterFrom, filterTo, filterDriverId])

  useEffect(() => { fetchTransactions() }, [fetchTransactions])

  const pendingCount = transactions.filter((r) => r.status === 'pending').length

  const handleApprove = async (id, creditsAmount) => {
    setProcessingId(id)
    try {
      await api.post(`/admin/wallet-transactions/${id}/approve`, { creditsAmount: creditsAmount != null ? Number(creditsAmount) : undefined })
      setShowApproveModal(null)
      setShowDetail(null)
      fetchTransactions()
    } catch (err) {
      if (err.response?.status === 401) { localStorage.removeItem('token'); navigate('/login', { replace: true }); return }
      setError(err.response?.data?.error || err.message || 'Failed to approve')
    } finally {
      setProcessingId(null)
    }
  }

  const handleDecline = async (id) => {
    const note = (declineNote[id] || '').trim()
    if (!note) return
    setProcessingId(id)
    try {
      await api.post(`/admin/wallet-transactions/${id}/decline`, { adminNote: note })
      setShowDeclineModal(null)
      setShowDetail(null)
      setDeclineNote((prev) => { const p = { ...prev }; delete p[id]; return p })
      fetchTransactions()
    } catch (err) {
      if (err.response?.status === 401) { localStorage.removeItem('token'); navigate('/login', { replace: true }); return }
      setError(err.response?.data?.error || err.message || 'Failed to decline')
    } finally {
      setProcessingId(null)
    }
  }

  const handleNeedsPdf = async (id) => {
    setProcessingId(id)
    try {
      await api.post(`/admin/wallet-transactions/${id}/needs-pdf`, { adminNote: 'Please submit PDF document.' })
      setShowDetail(null)
      fetchTransactions()
    } catch (err) {
      if (err.response?.status === 401) { localStorage.removeItem('token'); navigate('/login', { replace: true }); return }
      setError(err.response?.data?.error || err.message || 'Failed')
    } finally {
      setProcessingId(null)
    }
  }

  const exportCsv = () => {
    const headers = ['Driver Name', 'Driver ID', 'Amount (S/)', 'Credits', 'Txn ID', 'Status', 'Date', 'Approved At']
    const rows = transactions.map((r) => [
      r.driverName || '—',
      r.driverId || '—',
      r.amountSoles != null ? Number(r.amountSoles).toFixed(2) : '—',
      r.creditsAmount ?? '—',
      r.transactionId || '—',
      r.status || '—',
      r.createdAt ? new Date(r.createdAt).toISOString() : '—',
      r.approvedAt ? new Date(r.approvedAt).toISOString() : '—',
    ])
    const csv = [headers.join(','), ...rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `driver-payments-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const openDetail = (r) => setShowDetail(r)
  const closeDetail = () => setShowDetail(null)

  return (
    <>
      <header className="dashboard-header">
        <h1 className="dashboard-header-title">{title}</h1>
      </header>
      <div className="dashboard-content">
        {pendingCount > 0 && (
          <div className="recharge-alert" style={{ marginBottom: 16, padding: 16, background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8 }}>
            <strong>Driver recharge(s) awaiting approval.</strong> {pendingCount} pending request(s).
          </div>
        )}
        <p className="page-placeholder-desc">Driver Payments — verify screenshots, approve or decline recharge requests.</p>

        <div className="finance-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, alignItems: 'flex-end' }}>
          <label>
            <span style={{ marginRight: 6 }}>Status</span>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: 6 }}>
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="declined">Declined</option>
              <option value="needs_pdf">Needs PDF</option>
            </select>
          </label>
          <label>
            <span style={{ marginRight: 6 }}>From</span>
            <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} style={{ padding: 6 }} />
          </label>
          <label>
            <span style={{ marginRight: 6 }}>To</span>
            <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} style={{ padding: 6 }} />
          </label>
          <label>
            <span style={{ marginRight: 6 }}>Driver</span>
            <input
              type="text"
              placeholder="Driver ID"
              value={filterDriverId}
              onChange={(e) => setFilterDriverId(e.target.value)}
              style={{ padding: 6, width: 140 }}
            />
          </label>
          <button type="button" className="btn-secondary" onClick={exportCsv} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Download size={16} />
            Export CSV
          </button>
        </div>

        {loading && (
          <div className="dashboard-loading">
            <Loader2 size={32} className="spin" />
            <span>Loading...</span>
          </div>
        )}
        {error && <p className="dashboard-error">{error}</p>}
        {!loading && !error && (
          <div className="bookings-list">
            <table className="bookings-table">
              <thead>
                <tr>
                  <th>Driver</th>
                  <th>Amount (S/)</th>
                  <th>Credits</th>
                  <th>Txn ID</th>
                  <th>Status</th>
                  <th>Screenshot</th>
                  <th>Date</th>
                  <th>Approved</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="bookings-empty">No transactions match filters.</td>
                  </tr>
                ) : (
                  transactions.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div>{r.driverName || '—'}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>{r.driverId || '—'}</div>
                      </td>
                      <td>{r.amountSoles != null ? Number(r.amountSoles).toFixed(2) : '—'}</td>
                      <td>{r.creditsAmount ?? '—'}</td>
                      <td><code className="tx-id">{r.transactionId || '—'}</code></td>
                      <td>
                        <span className={`status-badge status-${r.status}`} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>
                          {r.status || '—'}
                        </span>
                      </td>
                      <td>
                        {r.screenshotUrl ? (
                          <a href={r.screenshotUrl} target="_blank" rel="noopener noreferrer" className="screenshot-link">
                            <img src={r.screenshotUrl} alt="Proof" className="screenshot-thumb" />
                          </a>
                        ) : (
                          <span>—</span>
                        )}
                      </td>
                      <td>{r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</td>
                      <td>{r.approvedAt ? new Date(r.approvedAt).toLocaleString() : '—'}</td>
                      <td>
                        <div className="action-buttons">
                          <button type="button" className="btn-secondary" onClick={() => openDetail(r)} title="View">
                            <Eye size={16} />
                            View
                          </button>
                          {r.status === 'pending' && (
                            <>
                              <button
                                type="button"
                                className="btn-approve"
                                onClick={() => setShowApproveModal({ id: r.id, creditsAmount: r.creditsAmount ?? 0 })}
                                disabled={processingId === r.id}
                                title="Approve"
                              >
                                {processingId === r.id ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
                                Approve
                              </button>
                              <button
                                type="button"
                                className="btn-decline"
                                onClick={() => setShowDeclineModal(r.id)}
                                disabled={processingId === r.id}
                                title="Decline"
                              >
                                <X size={16} />
                                Decline
                              </button>
                              <button
                                type="button"
                                className="btn-needs-pdf"
                                onClick={() => handleNeedsPdf(r.id)}
                                disabled={processingId === r.id}
                                title="Needs PDF"
                              >
                                <FileText size={16} />
                                Needs PDF
                              </button>
                            </>
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
      </div>

      {showDetail && (
        <div className="modal-overlay" onClick={closeDetail}>
          <div className="modal-content" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <h3>Payment detail</h3>
            <div style={{ marginBottom: 12 }}>
              <strong>Driver:</strong> {showDetail.driverName || '—'} ({showDetail.driverId || '—'})
            </div>
            <div style={{ marginBottom: 12 }}>
              <strong>Amount (S/):</strong> {showDetail.amountSoles != null ? Number(showDetail.amountSoles).toFixed(2) : '—'}
            </div>
            <div style={{ marginBottom: 12 }}>
              <strong>Credits:</strong> {showDetail.creditsAmount ?? '—'}
            </div>
            <div style={{ marginBottom: 12 }}>
              <strong>Transaction ID:</strong> <code>{showDetail.transactionId || '—'}</code>
            </div>
            <div style={{ marginBottom: 12 }}>
              <strong>Status:</strong> {showDetail.status || '—'}
            </div>
            <div style={{ marginBottom: 12 }}>
              <strong>Date:</strong> {showDetail.createdAt ? new Date(showDetail.createdAt).toLocaleString() : '—'}
            </div>
            <div style={{ marginBottom: 12 }}>
              <strong>Approved:</strong> {showDetail.approvedAt ? new Date(showDetail.approvedAt).toLocaleString() : '—'}
            </div>
            {showDetail.adminNote && (
              <div style={{ marginBottom: 12 }}>
                <strong>Admin note:</strong> {showDetail.adminNote}
              </div>
            )}
            {showDetail.screenshotUrl && (
              <div style={{ marginBottom: 16 }}>
                <strong>Screenshot:</strong>
                <a href={showDetail.screenshotUrl} target="_blank" rel="noopener noreferrer" className="screenshot-link" style={{ display: 'block', marginTop: 4 }}>
                  <img src={showDetail.screenshotUrl} alt="Proof" className="screenshot-thumb" style={{ maxHeight: 200 }} />
                </a>
              </div>
            )}
            {showDetail.status === 'pending' && (
              <div className="modal-actions" style={{ marginTop: 16, flexWrap: 'wrap', gap: 8 }}>
                <button className="btn-secondary" onClick={closeDetail}>Close</button>
                <button className="btn-approve" onClick={() => { setShowApproveModal({ id: showDetail.id, creditsAmount: showDetail.creditsAmount ?? 0 }); setShowDetail(null); }} disabled={processingId === showDetail.id}>
                  Approve
                </button>
                <button className="btn-decline" onClick={() => { setShowDeclineModal(showDetail.id); setShowDetail(null); }} disabled={processingId === showDetail.id}>
                  Decline
                </button>
                <button className="btn-needs-pdf" onClick={() => handleNeedsPdf(showDetail.id)} disabled={processingId === showDetail.id}>
                  Mark Needs PDF
                </button>
              </div>
            )}
            {showDetail.status !== 'pending' && (
              <div className="modal-actions" style={{ marginTop: 16 }}>
                <button className="btn-secondary" onClick={closeDetail}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}

      {showApproveModal && (
        <div className="modal-overlay" onClick={() => setShowApproveModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Approve recharge</h3>
            <p>Credits to add (editable):</p>
            <input
              type="number"
              min={1}
              value={showApproveModal.creditsAmount}
              onChange={(e) => setShowApproveModal((prev) => ({ ...prev, creditsAmount: parseInt(e.target.value, 10) || 0 }))}
              style={{ padding: 8, width: 120, fontSize: 16 }}
            />
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn-secondary" onClick={() => setShowApproveModal(null)}>Cancel</button>
              <button
                type="button"
                className="btn-approve"
                onClick={() => handleApprove(showApproveModal.id, showApproveModal.creditsAmount)}
                disabled={processingId === showApproveModal.id || !showApproveModal.creditsAmount}
              >
                {processingId === showApproveModal.id ? 'Approving...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeclineModal && (
        <div className="modal-overlay" onClick={() => setShowDeclineModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Decline request</h3>
            <p><strong>Reason for decline (required):</strong></p>
            <textarea
              rows={3}
              value={declineNote[showDeclineModal] || ''}
              onChange={(e) => setDeclineNote((prev) => ({ ...prev, [showDeclineModal]: e.target.value }))}
              placeholder="Enter reason for decline..."
              style={{ width: '100%', marginTop: 8 }}
            />
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn-secondary" onClick={() => setShowDeclineModal(null)}>Cancel</button>
              <button
                type="button"
                className="btn-decline"
                onClick={() => handleDecline(showDeclineModal)}
                disabled={processingId === showDeclineModal || !(declineNote[showDeclineModal] || '').trim()}
              >
                {processingId === showDeclineModal ? 'Declining...' : 'Decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Finance
