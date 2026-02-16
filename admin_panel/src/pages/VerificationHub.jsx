import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFeatureByPath } from '../config/firm'
import api from '../services/api'
import { Loader2, ShieldCheck, ShieldX, Ban, AlertTriangle, Pencil } from 'lucide-react'
import '../App.css'

const uploadsBase = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, '') : ''

function VerificationHub() {
  const navigate = useNavigate()
  const feature = getFeatureByPath('/verification-hub')
  const title = feature?.label ?? 'Verification Hub'
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actioning, setActioning] = useState(null)
  const [blockModal, setBlockModal] = useState(null) // { driverId, status: 'temp_blocked' | 'suspended' }
  const [editModal, setEditModal] = useState(null) // { driverId, driverName, vehicleType, vehiclePlate, email }

  useEffect(() => {
    api.get('/admin/drivers')
      .then(({ data }) => { setDrivers(data.drivers || []); setError(''); })
      .catch((err) => {
        if (err.response?.status === 401) { localStorage.removeItem('token'); navigate('/login', { replace: true }); return }
        if (err.response?.status === 404) { setDrivers([]); setError(''); return }
        setError(err.response?.data?.error || err.message || 'Failed to load drivers')
      })
      .finally(() => setLoading(false))
  }, [navigate])

  const handleVerify = (driverId, status, blockReason = null) => {
    setActioning(driverId)
    const body = blockReason != null ? { status, blockReason } : { status }
    api.post(`/admin/drivers/${encodeURIComponent(driverId)}/verify`, body)
      .then(({ data }) => setDrivers((prev) => prev.map((d) => (d.driverId === driverId ? { ...d, status: data.status, blockReason: data.blockReason } : d))))
      .catch((err) => {
        if (err.response?.status === 401) { localStorage.removeItem('token'); navigate('/login', { replace: true }); return }
        setError(err.response?.data?.error || err.message || 'Failed to update')
      }).finally(() => { setActioning(null); setBlockModal(null) })
  }

  const formatDate = (iso) => { if (!iso) return '—'; try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }); } catch (_) { return iso; } }
  const statusColor = (s) => { switch (s) { case 'approved': return '#10b981'; case 'rejected': return '#ef4444'; case 'temp_blocked': case 'suspended': return '#dc2626'; default: return '#f59e0b'; } }

  const handleEditSave = () => {
    if (!editModal) return
    setActioning(editModal.driverId)
    const body = {
      driverName: (editModal.driverName ?? '').trim(),
      vehicleType: (editModal.vehicleType ?? '').trim(),
      vehiclePlate: (editModal.vehiclePlate ?? '').trim(),
      email: (editModal.email ?? '').trim() || null,
    }
    api.patch(`/admin/drivers/${encodeURIComponent(editModal.driverId)}/edit`, body)
      .then(({ data }) => {
        const upd = data.driver || {}
        setDrivers((prev) => prev.map((d) => (d.driverId === editModal.driverId
          ? {
              ...d,
              driverName: upd.driverName ?? d.driverName,
              vehicleType: upd.vehicleType ?? d.vehicleType,
              vehiclePlate: upd.vehiclePlate ?? d.vehiclePlate,
              status: upd.status ?? d.status,
              updatedAt: upd.updatedAt ?? d.updatedAt,
              blockReason: upd.blockReason ?? null,
            }
          : d)))
        setEditModal(null)
        setError('')
      })
      .catch((err) => {
        setError(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to save')
      })
      .finally(() => setActioning(null))
  }

  return (
    <>
      <header className="dashboard-header">
        <h1 className="dashboard-header-title">{title}</h1>
      </header>
      <div className="dashboard-content">
        <p className="page-placeholder-desc">Approve, reject, or temporarily block drivers. New profile changes show as pending until re-approved.</p>
        {loading && <div className="dashboard-loading"><Loader2 size={32} className="spin" /><span>Loading drivers...</span></div>}
        {error && <p className="dashboard-error">{error}</p>}
        {!loading && !error && (
          <div className="bookings-list">
            <table className="bookings-table">
              <thead>
                <tr><th>Photo</th><th>Driver ID</th><th>Name</th><th>Vehicle</th><th>Status</th><th>Block reason</th><th>Updated</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {drivers.length === 0 ? (
                  <tr><td colSpan={8} className="bookings-empty">No drivers to verify yet. Drivers appear here when they submit documents.</td></tr>
                ) : (
                  drivers.map((d) => (
                    <tr key={d.driverId}>
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
                      <td className="drivers-id-cell" title={d.driverId}><code className="tx-id">{d.driverId}</code></td>
                      <td>{d.driverName || '—'}</td>
                      <td>
                        <div style={{ fontSize: '13px' }}>
                          <div><strong>{d.vehicleBrand || '—'} {d.vehicleModel || '—'}</strong></div>
                          <div style={{ color: '#888', fontSize: '12px' }}>{d.vehicleColor || '—'} | {d.vehicleType || '—'} | {d.vehiclePlate || '—'}</div>
                        </div>
                      </td>
                      <td><span className="bookings-status" style={{ backgroundColor: statusColor(d.status) }}>{d.status}</span></td>
                      <td style={{ maxWidth: 200, fontSize: 12 }}>{d.blockReason || '—'}</td>
                      <td>{formatDate(d.updatedAt)}</td>
                      <td>
                        <span className="verification-actions">
                          {d.status === 'pending' && (
                            <>
                              <button type="button" className="dashboard-btn small success" disabled={actioning === d.driverId} onClick={() => handleVerify(d.driverId, 'approved')}><ShieldCheck size={14} /> Approve</button>
                              <button type="button" className="dashboard-btn small danger" disabled={actioning === d.driverId} onClick={() => handleVerify(d.driverId, 'rejected')}><ShieldX size={14} /> Reject</button>
                              <button type="button" className="dashboard-btn small" style={{ background: '#b91c1c' }} disabled={actioning === d.driverId} onClick={() => setBlockModal({ driverId: d.driverId, status: 'temp_blocked' })}><Ban size={14} /> Temp block</button>
                              <button type="button" className="dashboard-btn small" style={{ background: '#7f1d1d' }} disabled={actioning === d.driverId} onClick={() => setBlockModal({ driverId: d.driverId, status: 'suspended' })}><AlertTriangle size={14} /> Suspend</button>
                            </>
                          )}
                          {(d.status === 'approved' || d.status === 'rejected') && (
                            <>
                              <button type="button" className="dashboard-btn small" style={{ background: '#b91c1c' }} disabled={actioning === d.driverId} onClick={() => setBlockModal({ driverId: d.driverId, status: 'temp_blocked' })}><Ban size={14} /> Temp block</button>
                              <button type="button" className="dashboard-btn small" style={{ background: '#7f1d1d' }} disabled={actioning === d.driverId} onClick={() => setBlockModal({ driverId: d.driverId, status: 'suspended' })}><AlertTriangle size={14} /> Suspend</button>
                            </>
                          )}
                          {(d.status === 'temp_blocked' || d.status === 'suspended') && (
                            <>
                              <button type="button" className="dashboard-btn small success" disabled={actioning === d.driverId} onClick={() => handleVerify(d.driverId, 'approved')}><ShieldCheck size={14} /> Approve</button>
                              <button type="button" className="dashboard-btn small" disabled={actioning === d.driverId} onClick={() => handleVerify(d.driverId, 'pending')}>Reinitiate</button>
                            </>
                          )}
                          <button type="button" className="dashboard-btn small" style={{ background: '#374151' }} onClick={() => setEditModal({ driverId: d.driverId, driverName: d.driverName || '', vehicleType: d.vehicleType || 'car', vehiclePlate: d.vehiclePlate || '', email: d.email || '' })}><Pencil size={14} /> Edit</button>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {blockModal && (
        <div className="modal-overlay" onClick={() => setBlockModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{blockModal.status === 'suspended' ? 'Suspend driver' : 'Temporarily block driver'}</h3>
            <p>Reason (optional, shown to driver):</p>
            <textarea id="block-reason-input" rows={3} placeholder="e.g. Duplicate vehicle / Contact support" />
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setBlockModal(null)}>Cancel</button>
              <button type="button" className="btn-decline" onClick={() => { const el = document.getElementById('block-reason-input'); handleVerify(blockModal.driverId, blockModal.status, el?.value?.trim() || null); }} disabled={actioning === blockModal.driverId}>Confirm</button>
            </div>
          </div>
        </div>
      )}
      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Edit driver info</h3>
            <div className="modal-form">
              <label>Name</label>
              <input type="text" value={editModal.driverName} onChange={(e) => setEditModal((m) => ({ ...m, driverName: e.target.value }))} />
              <label>Vehicle type</label>
              <input type="text" value={editModal.vehicleType} onChange={(e) => setEditModal((m) => ({ ...m, vehicleType: e.target.value }))} placeholder="e.g. taxi_std, truck_m" />
              <label>Vehicle plate</label>
              <input type="text" value={editModal.vehiclePlate} onChange={(e) => setEditModal((m) => ({ ...m, vehiclePlate: e.target.value }))} placeholder="e.g. ABC123" />
              <label>Email</label>
              <input type="email" value={editModal.email ?? ''} onChange={(e) => setEditModal((m) => ({ ...m, email: e.target.value }))} placeholder="optional" />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setEditModal(null)}>Cancel</button>
              <button type="button" className="btn-approve" onClick={handleEditSave} disabled={actioning === editModal.driverId}>Save</button>
            </div>
            <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>Note: Changes reset status to pending for re-approval.</p>
          </div>
        </div>
      )}
    </>
  )
}

export default VerificationHub
