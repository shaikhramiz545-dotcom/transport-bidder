import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import '../App.css'

const PERMISSION_OPTIONS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'dispatcher', label: 'Dispatcher' },
  { id: 'verification', label: 'Verification Hub' },
  { id: 'drivers', label: 'Drivers' },
  { id: 'finance', label: 'Finance' },
  { id: 'agencies', label: 'Agencies' },
  { id: 'tours', label: 'Tours' },
  { id: 'agency_payouts', label: 'Agency Payouts' },
  { id: 'health', label: 'TBidder Health' },
  { id: 'settings', label: 'Settings' },
  { id: 'admin_users', label: 'Admin Users' },
  { id: 'admin_roles', label: 'Admin Roles' },
]

function AdminRoles() {
  const navigate = useNavigate()
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [permissions, setPermissions] = useState([])

  const fetchRoles = () => {
    setLoading(true)
    api.get('/admin/roles')
      .then(({ data }) => { setRoles(data.roles || []); setError('') })
      .catch((err) => {
        if (err.response?.status === 401) { localStorage.removeItem('token'); navigate('/login', { replace: true }); return }
        setError(err.response?.data?.error || err.message || 'Failed to load roles')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchRoles() }, [])

  const togglePermission = (permId) => {
    setPermissions((prev) => (prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]))
  }

  const handleCreate = (e) => {
    e.preventDefault()
    setSaving(true)
    api.post('/admin/roles', { name, description, permissions })
      .then(({ data }) => {
        setRoles((prev) => [data.role, ...prev])
        setName(''); setDescription(''); setPermissions([])
      })
      .catch((err) => setError(err.response?.data?.error || err.message || 'Failed to create role'))
      .finally(() => setSaving(false))
  }

  const handleDelete = (roleId) => {
    if (!window.confirm('Delete this role?')) return
    api.delete(`/admin/roles/${roleId}`)
      .then(() => setRoles((prev) => prev.filter((r) => r.id !== roleId)))
      .catch((err) => setError(err.response?.data?.error || err.message || 'Failed to delete role'))
  }

  return (
    <>
      <header className="dashboard-header">
        <h1 className="dashboard-header-title">Admin Roles</h1>
      </header>
      <div className="dashboard-content">
        <p className="page-placeholder-desc">Team-wise roles banayein aur modules assign karein. Users create karte waqt template select karke modules auto-apply ho jayenge.</p>
        {error && <p className="dashboard-error">{error}</p>}

        <section style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 12, padding: 16, color: '#fff' }}>
          <h2 style={{ marginTop: 0, color: '#fff' }}>Create Role</h2>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <label style={{ color: '#fff' }}>
                Name
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dispatch Team" required style={{ width: '100%', marginTop: 6, padding: 8, color: '#1f2937', background: '#f3f4f6' }} />
              </label>
              <label style={{ color: '#fff' }}>
                Description
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="optional" style={{ width: '100%', marginTop: 6, padding: 8, color: '#1f2937', background: '#f3f4f6' }} />
              </label>
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: '#fff' }}>Module Permissions</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                {PERMISSION_OPTIONS.map((perm) => (
                  <label key={perm.id} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff' }}>
                    <input type="checkbox" checked={permissions.includes(perm.id)} onChange={() => togglePermission(perm.id)} />
                    <span>{perm.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" className="dashboard-btn" disabled={saving} style={{ marginTop: 16 }}>
              {saving ? 'Creating...' : 'Create Role'}
            </button>
          </form>
        </section>

        <section className="bookings-list" style={{ marginTop: '1.5rem' }}>
          <table className="bookings-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Permissions</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="bookings-empty">Loading roles...</td></tr>
              ) : roles.length === 0 ? (
                <tr><td colSpan={5} className="bookings-empty">No roles yet.</td></tr>
              ) : (
                roles.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{r.description || '—'}</td>
                    <td>{(r.permissions || []).join(', ') || '—'}</td>
                    <td>{r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</td>
                    <td>
                      <button type="button" className="dashboard-btn small danger" onClick={() => handleDelete(r.id)}>Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </>
  )
}

export default AdminRoles
