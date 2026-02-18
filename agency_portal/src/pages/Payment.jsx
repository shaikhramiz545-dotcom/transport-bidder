import { useState, useEffect } from 'react'
import { Loader2, FileSpreadsheet, FileText, Wallet } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import api from '../services/api'
import '../App.css'

function formatDate(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString(undefined, { dateStyle: 'short' })
  } catch (_) { return String(d) }
}

function formatDateTime(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch (_) { return String(d) }
}

function Payment() {
  const [wallet, setWallet] = useState(null)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const fetchWallet = () => {
    api.get('/agency/wallet')
      .then(({ data }) => setWallet(data))
      .catch(() => setWallet(null))
  }

  const fetchRequests = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterFrom) params.set('from', filterFrom)
    if (filterTo) params.set('to', filterTo)
    if (filterStatus) params.set('status', filterStatus)
    api.get(`/agency/payout-requests?${params.toString()}`)
      .then(({ data }) => { setRequests(data.requests || []); setError('') })
      .catch((err) => {
        setError(err.response?.data?.error || err.message || 'Failed to load')
        setRequests([])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchWallet() }, [])
  useEffect(() => { fetchRequests() }, [filterFrom, filterTo, filterStatus])

  const nextPayoutDay = () => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    d.setDate(1)
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const downloadPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(14)
    doc.text('Payout History', 14, 16)
    const range = [filterFrom, filterTo].filter(Boolean).join(' – ') || 'All dates'
    doc.setFontSize(10)
    doc.text(`Date range: ${range}`, 14, 24)
    const headers = [['Date', 'Amount', 'Gateway', 'Transfer', 'Net', 'Currency', 'Status', 'Processed At']]
    const rows = requests.map((r) => [
      formatDateTime(r.createdAt),
      String(r.amount),
      r.gatewayCharges != null ? String(r.gatewayCharges) : '—',
      r.transferFee != null ? String(r.transferFee) : '—',
      r.netAmount != null ? String(r.netAmount) : '—',
      r.currency || 'USD',
      r.status,
      formatDateTime(r.processedAt),
    ])
    autoTable(doc, { head: headers, body: rows, startY: 30 })
    const filename = `payout-history-${filterFrom || 'start'}-${filterTo || 'end'}.pdf`
    doc.save(filename)
  }

  const downloadExcel = () => {
    const headers = ['Date', 'Amount', 'Gateway (deducted)', 'Transfer (deducted)', 'Net paid', 'Currency', 'Status', 'Processed At', 'Admin Note']
    const rows = requests.map((r) => [
      formatDateTime(r.createdAt),
      r.amount,
      r.gatewayCharges ?? '',
      r.transferFee ?? '',
      r.netAmount ?? '',
      r.currency || 'USD',
      r.status,
      formatDateTime(r.processedAt),
      r.adminNote || '',
    ])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Payout History')
    const range = [filterFrom, filterTo].filter(Boolean).join('-') || 'all'
    XLSX.writeFile(wb, `payout-history-${range}.xlsx`)
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 1rem' }}>Payment & Payouts</h2>

      <div className="agency-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Wallet size={20} />
          <span style={{ fontWeight: 600 }}>Wallet Balance</span>
        </div>
        {wallet != null ? (
          <p style={{ margin: 0, fontSize: '1.25rem' }}>
            <strong>{Number(wallet.balance).toFixed(2)}</strong> {wallet.currency || 'USD'}
          </p>
        ) : (
          <p style={{ margin: 0, color: '#666' }}>—</p>
        )}
        <p style={{ margin: '0.75rem 0 0', fontSize: '0.875rem', color: '#666', background: '#f0fdf4', padding: '0.75rem', borderRadius: '8px' }}>
          <strong>Monthly payout:</strong> Payouts are processed on the <strong>1st of every month</strong> via dLocal. Next payout date: <strong>{nextPayoutDay()}</strong>.
        </p>
      </div>

      <div className="agency-card">
        <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Payout History</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
          <div className="form-row" style={{ margin: 0 }}>
            <label>From (date)</label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              style={{ width: 'auto', minWidth: '140px' }}
            />
          </div>
          <div className="form-row" style={{ margin: 0 }}>
            <label>To (date)</label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              style={{ width: 'auto', minWidth: '140px' }}
            />
          </div>
          <div className="form-row" style={{ margin: 0 }}>
            <label>Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ width: 'auto', minWidth: '120px' }}
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="btn-secondary" onClick={downloadPDF} disabled={requests.length === 0}>
              <FileText size={16} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />
              Download PDF
            </button>
            <button type="button" className="btn-secondary" onClick={downloadExcel} disabled={requests.length === 0}>
              <FileSpreadsheet size={16} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />
              Download Excel
            </button>
          </div>
        </div>

        {error && <p className="agency-error">{error}</p>}
        {loading ? (
          <div className="agency-loading">
            <Loader2 size={32} className="spin" />
            <span>Loading payout history...</span>
          </div>
        ) : (
          <table className="agency-table">
            <thead>
              <tr>
                <th>Requested</th>
                <th>Amount</th>
                <th>Gateway / Transfer / Net</th>
                <th>Currency</th>
                <th>Status</th>
                <th>Processed</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>No payout records for this filter.</td></tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDateTime(r.createdAt)}</td>
                    <td>{Number(r.amount).toFixed(2)}</td>
                    <td>
                      {r.netAmount != null ? (
                        <span title="Gateway (deducted) / Transfer fee (deducted) → Net paid">
                          {Number(r.gatewayCharges || 0).toFixed(2)} / {Number(r.transferFee || 0).toFixed(2)} → <strong>{Number(r.netAmount).toFixed(2)}</strong>
                        </span>
                      ) : (
                        <span style={{ color: '#999' }}>—</span>
                      )}
                    </td>
                    <td>{r.currency || 'USD'}</td>
                    <td>
                      <span className={`agency-status ${r.status === 'completed' ? 'approved' : r.status === 'rejected' ? 'rejected' : 'pending'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>{formatDateTime(r.processedAt)}</td>
                    <td style={{ maxWidth: '200px' }}>{r.adminNote || '—'}</td>
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

export default Payment
