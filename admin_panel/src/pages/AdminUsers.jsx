import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import '../App.css'

// Permission ids must match config/firm.js permission keys.
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

function AdminUsers() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('manager')
  const [permissions, setPermissions] = useState([])
  const [roleTemplates, setRoleTemplates] = useState([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')

  const fetchUsers = () => {
    setLoading(true)
    api.get('/admin/users')
      .then(({ data }) => {
        setUsers(data.users || [])
        setError('')
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem('token')
          navigate('/login', { replace: true })
          return
        }
        setError(err.response?.data?.error || err.message || 'Failed to load admin users')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchUsers()
    api.get('/admin/roles')
      .then(({ data }) => setRoleTemplates(data.roles || []))
      .catch(() => {})
  }, [])

  const togglePermission = (permId) => {
    setPermissions((prev) => (prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]))
  }

  const applyTemplate = (id) => {
    setSelectedTemplateId(id)
    const tpl = roleTemplates.find((r) => String(r.id) === String(id))
    if (tpl) {
      setPermissions(Array.isArray(tpl.permissions) ? tpl.permissions : [])
    }
  }

  const handleCreate = (e) => {
    e.preventDefault()
    setSaving(true)
    api.post('/admin/users', { email, password, role, permissions })
      .then(({ data }) => {
        setUsers((prev) => [data.user, ...prev])
        setEmail('')
        setPassword('')
        setRole('manager')
        setPermissions([])
        setSelectedTemplateId('')
        setError('')
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem('token')
          navigate('/login', { replace: true })
          return
        }
        setError(err.response?.data?.error || err.message || 'Failed to create admin user')
      })
      .finally(() => setSaving(false))
  }

  const handleToggleStatus = (user) => {
    const nextStatus = user.status === 'disabled' ? 'active' : 'disabled'
    api.patch(`/admin/users/${user.id}`, { status: nextStatus })
      .then(({ data }) => {
        setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...data.user } : u)))
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem('token')
          navigate('/login', { replace: true })
          return
        }
        setError(err.response?.data?.error || err.message || 'Failed to update status')
      })
  }

  return (
    <>
      <header className="dashboard-header">
        <h1 className="dashboard-header-title">Admin Users</h1>
      </header>
      <div className="dashboard-content">
        <p className="page-placeholder-desc">
          Create manager accounts and control which modules they can access. Admin role has full access.
        </p>

        {error && <p className="dashboard-error">{error}</p>}

        <section style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 12, padding: 16, color: '#fff' }}>
          <h2 style={{ marginTop: 0, color: '#fff' }}>Create New User</h2>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <label style={{ color: '#fff' }}>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="manager@tbidder.com"
                  required
                  style={{ width: '100%', marginTop: 6, padding: 8, color: '#1f2937', background: '#f3f4f6' }}
                />
              </label>
              <label style={{ color: '#fff' }}>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  style={{ width: '100%', marginTop: 6, padding: 8, color: '#1f2937', background: '#f3f4f6' }}
                />
              </label>
              <label style={{ color: '#fff' }}>
                Role
                <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: '100%', marginTop: 6, padding: 8, color: '#1f2937', background: '#f3f4f6' }}>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              {role !== 'admin' && (
                <label style={{ color: '#fff' }}>
                  Role Template
                  <select value={selectedTemplateId} onChange={(e) => applyTemplate(e.target.value)} style={{ width: '100%', marginTop: 6, padding: 8, color: '#1f2937', background: '#f3f4f6' }}>
                    <option value="">— Select template —</option>
                    {roleTemplates.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: '#fff' }}>Module Permissions</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                {PERMISSION_OPTIONS.map((perm) => (
                  <label key={perm.id} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff' }}>
                    <input
                      type="checkbox"
                      checked={permissions.includes(perm.id)}
                      onChange={() => togglePermission(perm.id)}
                      disabled={role === 'admin'}
                    />
                    <span>{perm.label}</span>
                  </label>
                ))}
              </div>
              {role === 'admin' && (
                <p style={{ marginTop: 8, color: 'rgba(255,255,255,0.9)' }}>Admin role ignores permissions and can access all modules.</p>
              )}
              {!!selectedTemplateId && role !== 'admin' && (
                <p style={{ marginTop: 8, color: 'rgba(255,255,255,0.9)' }}>
                  Template applied. You can still toggle modules to customize for this user.
                </p>
              )}
            </div>
            <button type="submit" className="dashboard-btn" disabled={saving} style={{ marginTop: 16 }}>
              {saving ? 'Creating...' : 'Create User'}
            </button>
          </form>
        </section>

        <section className="bookings-list" style={{ marginTop: '1.5rem' }}>
          <table className="bookings-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Permissions</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="bookings-empty">Loading admin users...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="bookings-empty">No admin users yet.</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>{user.status}</td>
                    <td>{(user.permissions || []).join(', ') || '—'}</td>
                    <td>{user.createdAt ? new Date(user.createdAt).toLocaleString() : '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="dashboard-btn small"
                        onClick={() => handleToggleStatus(user)}
                      >
                        {user.status === 'disabled' ? 'Enable' : 'Disable'}
                      </button>
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

export default AdminUsers
