import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, ShieldCheck, UserPlus, Trash2, ToggleLeft, ToggleRight, Loader2, Pencil, X, Check } from 'lucide-react'
import api from '../services/api'
import { getAdminSession } from '../services/admin_session'
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
  { id: 'team', label: 'Team Management' },
]

const DEPARTMENT_PRESETS = [
  'Operations',
  'Customer Service',
  'Finance',
  'Dispatch',
  'Verification',
  'Management',
  'IT / Technical',
]

function TeamManagement() {
  const navigate = useNavigate()
  const session = getAdminSession()
  const [tab, setTab] = useState('members')

  // ── Members state ──
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [userError, setUserError] = useState('')
  const [savingUser, setSavingUser] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('manager')
  const [department, setDepartment] = useState('')
  const [customDept, setCustomDept] = useState('')
  const [permissions, setPermissions] = useState([])
  const [roleTemplates, setRoleTemplates] = useState([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [editingUserId, setEditingUserId] = useState(null)
  const [editPerms, setEditPerms] = useState([])
  const [editDept, setEditDept] = useState('')
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState('')

  // ── Departments (roles) state ──
  const [roles, setRoles] = useState([])
  const [loadingRoles, setLoadingRoles] = useState(true)
  const [roleError, setRoleError] = useState('')
  const [savingRole, setSavingRole] = useState(false)
  const [roleName, setRoleName] = useState('')
  const [roleDesc, setRoleDesc] = useState('')
  const [rolePerms, setRolePerms] = useState([])

  const authErr = (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      navigate('/login', { replace: true })
      return true
    }
    return false
  }

  // ── Fetch ──
  const fetchUsers = () => {
    setLoadingUsers(true)
    api.get('/admin/users')
      .then(({ data }) => { setUsers(data.users || []); setUserError('') })
      .catch((err) => { if (!authErr(err)) setUserError(err.response?.data?.error || err.message || 'Failed to load') })
      .finally(() => setLoadingUsers(false))
  }

  const fetchRoles = () => {
    setLoadingRoles(true)
    api.get('/admin/roles')
      .then(({ data }) => { setRoles(data.roles || []); setRoleTemplates(data.roles || []); setRoleError('') })
      .catch((err) => { if (!authErr(err)) setRoleError(err.response?.data?.error || err.message || 'Failed to load') })
      .finally(() => setLoadingRoles(false))
  }

  useEffect(() => { fetchUsers(); fetchRoles() }, [])

  // ── Members handlers ──
  const togglePermission = (permId) => {
    setPermissions((prev) => prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId])
  }

  const applyTemplate = (id) => {
    setSelectedTemplateId(id)
    const tpl = roleTemplates.find((r) => String(r.id) === String(id))
    if (tpl) {
      setPermissions(Array.isArray(tpl.permissions) ? tpl.permissions : [])
      if (tpl.name) setDepartment(tpl.name)
    }
  }

  const handleCreateUser = (e) => {
    e.preventDefault()
    setSavingUser(true)
    const dept = department === '__custom__' ? customDept.trim() : department
    api.post('/admin/users', { name: name.trim(), email, password, role, permissions, department: dept || null })
      .then(({ data }) => {
        setUsers((prev) => [data.user, ...prev])
        setName(''); setEmail(''); setPassword(''); setRole('manager')
        setPermissions([]); setSelectedTemplateId(''); setDepartment(''); setCustomDept('')
        setUserError('')
      })
      .catch((err) => { if (!authErr(err)) setUserError(err.response?.data?.error || err.message || 'Failed to create') })
      .finally(() => setSavingUser(false))
  }

  const handleToggleStatus = (user) => {
    const nextStatus = user.status === 'disabled' ? 'active' : 'disabled'
    api.patch(`/admin/users/${user.id}`, { status: nextStatus })
      .then(({ data }) => setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, ...data.user } : u)))
      .catch((err) => { if (!authErr(err)) setUserError(err.response?.data?.error || err.message || 'Failed') })
  }

  const startEditUser = (user) => {
    setEditingUserId(user.id)
    setEditPerms(Array.isArray(user.permissions) ? [...user.permissions] : [])
    setEditDept(user.department || '')
    setEditName(user.name || '')
    setEditRole(user.role || 'manager')
  }

  const cancelEditUser = () => { setEditingUserId(null) }

  const saveEditUser = (userId) => {
    api.patch(`/admin/users/${userId}`, {
      permissions: editPerms,
      department: editDept || null,
      name: editName.trim() || null,
      role: editRole,
    })
      .then(({ data }) => {
        setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, ...data.user } : u))
        setEditingUserId(null)
      })
      .catch((err) => { if (!authErr(err)) setUserError(err.response?.data?.error || err.message || 'Failed') })
  }

  // ── Department (role) handlers ──
  const toggleRolePerm = (permId) => {
    setRolePerms((prev) => prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId])
  }

  const handleCreateRole = (e) => {
    e.preventDefault()
    setSavingRole(true)
    api.post('/admin/roles', { name: roleName.trim(), description: roleDesc.trim(), permissions: rolePerms })
      .then(({ data }) => {
        const newRoles = [data.role, ...roles]
        setRoles(newRoles); setRoleTemplates(newRoles)
        setRoleName(''); setRoleDesc(''); setRolePerms([]); setRoleError('')
      })
      .catch((err) => { if (!authErr(err)) setRoleError(err.response?.data?.error || err.message || 'Failed') })
      .finally(() => setSavingRole(false))
  }

  const handleDeleteRole = (roleId) => {
    if (!window.confirm('Delete this department template?')) return
    api.delete(`/admin/roles/${roleId}`)
      .then(() => {
        const updated = roles.filter((r) => r.id !== roleId)
        setRoles(updated); setRoleTemplates(updated)
      })
      .catch((err) => { if (!authErr(err)) setRoleError(err.response?.data?.error || err.message || 'Failed') })
  }

  const permLabel = (id) => PERMISSION_OPTIONS.find((p) => p.id === id)?.label || id

  return (
    <>
      <header className="dashboard-header">
        <h1 className="dashboard-header-title">Team Management</h1>
      </header>
      <div className="dashboard-content">
        {/* Sub-tabs */}
        <div className="tours-subnav" style={{ marginBottom: '1.25rem' }}>
          <button
            type="button"
            className={`tours-subnav-btn ${tab === 'members' ? 'active' : ''}`}
            onClick={() => setTab('members')}
          >
            <Users size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Team Members
          </button>
          <button
            type="button"
            className={`tours-subnav-btn ${tab === 'departments' ? 'active' : ''}`}
            onClick={() => setTab('departments')}
          >
            <ShieldCheck size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Departments
          </button>
        </div>

        {/* ═══════════ TEAM MEMBERS TAB ═══════════ */}
        {tab === 'members' && (
          <>
            <p className="page-placeholder-desc">
              Create accounts for agents across departments. Each agent only sees the modules assigned to them.
            </p>
            {userError && <p className="dashboard-error">{userError}</p>}

            {/* Create form */}
            <section style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 12, padding: 20, color: '#fff', marginBottom: '1.5rem' }}>
              <h2 style={{ marginTop: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserPlus size={20} /> Add Team Member
              </h2>
              <form onSubmit={handleCreateUser}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <label style={{ color: '#fff' }}>
                    Name
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Agent name"
                      style={{ width: '100%', marginTop: 6, padding: 8, color: '#1f2937', background: '#f3f4f6', borderRadius: 6, border: 'none' }}
                    />
                  </label>
                  <label style={{ color: '#fff' }}>
                    Email *
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="agent@tbidder.com"
                      required
                      style={{ width: '100%', marginTop: 6, padding: 8, color: '#1f2937', background: '#f3f4f6', borderRadius: 6, border: 'none' }}
                    />
                  </label>
                  <label style={{ color: '#fff' }}>
                    Password *
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      required
                      style={{ width: '100%', marginTop: 6, padding: 8, color: '#1f2937', background: '#f3f4f6', borderRadius: 6, border: 'none' }}
                    />
                  </label>
                  <label style={{ color: '#fff' }}>
                    Role
                    <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: '100%', marginTop: 6, padding: 8, color: '#1f2937', background: '#f3f4f6', borderRadius: 6, border: 'none' }}>
                      <option value="manager">Agent</option>
                      <option value="admin">Admin (full access)</option>
                    </select>
                  </label>
                  <label style={{ color: '#fff' }}>
                    Department
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      style={{ width: '100%', marginTop: 6, padding: 8, color: '#1f2937', background: '#f3f4f6', borderRadius: 6, border: 'none' }}
                    >
                      <option value="">— Select —</option>
                      {DEPARTMENT_PRESETS.map((d) => <option key={d} value={d}>{d}</option>)}
                      {roleTemplates.filter((r) => !DEPARTMENT_PRESETS.includes(r.name)).map((r) => (
                        <option key={r.id} value={r.name}>{r.name}</option>
                      ))}
                      <option value="__custom__">Custom...</option>
                    </select>
                  </label>
                  {department === '__custom__' && (
                    <label style={{ color: '#fff' }}>
                      Custom Department
                      <input
                        type="text"
                        value={customDept}
                        onChange={(e) => setCustomDept(e.target.value)}
                        placeholder="e.g. Legal"
                        style={{ width: '100%', marginTop: 6, padding: 8, color: '#1f2937', background: '#f3f4f6', borderRadius: 6, border: 'none' }}
                      />
                    </label>
                  )}
                  {role !== 'admin' && (
                    <label style={{ color: '#fff' }}>
                      Apply Template
                      <select
                        value={selectedTemplateId}
                        onChange={(e) => applyTemplate(e.target.value)}
                        style={{ width: '100%', marginTop: 6, padding: 8, color: '#1f2937', background: '#f3f4f6', borderRadius: 6, border: 'none' }}
                      >
                        <option value="">— Select template —</option>
                        {roleTemplates.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </label>
                  )}
                </div>

                {/* Permissions grid */}
                {role !== 'admin' && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8, color: '#fff', fontSize: '0.9rem' }}>Module Access</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                      {PERMISSION_OPTIONS.map((perm) => (
                        <label key={perm.id} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#d1d5db', fontSize: '0.875rem' }}>
                          <input
                            type="checkbox"
                            checked={permissions.includes(perm.id)}
                            onChange={() => togglePermission(perm.id)}
                          />
                          <span>{perm.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {role === 'admin' && (
                  <p style={{ marginTop: 12, color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
                    Admin role has full access to all modules.
                  </p>
                )}

                <button type="submit" className="dashboard-btn" disabled={savingUser} style={{ marginTop: 16 }}>
                  {savingUser ? <><Loader2 size={16} className="spin" /> Creating...</> : 'Create Account'}
                </button>
              </form>
            </section>

            {/* Members table */}
            <section className="bookings-list">
              <table className="bookings-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Department</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Modules</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingUsers ? (
                    <tr><td colSpan={8} className="bookings-empty"><Loader2 size={20} className="spin" /> Loading...</td></tr>
                  ) : users.length === 0 ? (
                    <tr><td colSpan={8} className="bookings-empty">No team members yet. Create one above.</td></tr>
                  ) : users.map((user) => (
                    <tr key={user.id}>
                      <td style={{ fontWeight: 500 }}>
                        {editingUserId === user.id ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            style={{ width: 120, padding: '4px 6px', fontSize: '0.85rem', borderRadius: 4, border: '1px solid #ccc' }}
                          />
                        ) : (user.name || '—')}
                      </td>
                      <td>{user.email}</td>
                      <td>
                        {editingUserId === user.id ? (
                          <select
                            value={editDept}
                            onChange={(e) => setEditDept(e.target.value)}
                            style={{ padding: '4px 6px', fontSize: '0.85rem', borderRadius: 4, border: '1px solid #ccc' }}
                          >
                            <option value="">—</option>
                            {DEPARTMENT_PRESETS.map((d) => <option key={d} value={d}>{d}</option>)}
                            {roleTemplates.filter((r) => !DEPARTMENT_PRESETS.includes(r.name)).map((r) => (
                              <option key={r.id} value={r.name}>{r.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 6,
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            background: user.department ? 'rgba(255, 95, 0, 0.12)' : '#f3f4f6',
                            color: user.department ? '#e55500' : '#999',
                          }}>
                            {user.department || '—'}
                          </span>
                        )}
                      </td>
                      <td>
                        {editingUserId === user.id ? (
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value)}
                            style={{ padding: '4px 6px', fontSize: '0.85rem', borderRadius: 4, border: '1px solid #ccc' }}
                          >
                            <option value="manager">Agent</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : (
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 6,
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            background: user.role === 'admin' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.12)',
                            color: user.role === 'admin' ? '#059669' : '#3b82f6',
                          }}>
                            {user.role === 'admin' ? 'Admin' : 'Agent'}
                          </span>
                        )}
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          background: user.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.12)',
                          color: user.status === 'active' ? '#059669' : '#dc2626',
                        }}>
                          {user.status === 'active' ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td style={{ maxWidth: 200, fontSize: '0.8rem' }}>
                        {editingUserId === user.id ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {PERMISSION_OPTIONS.map((perm) => (
                              <label key={perm.id} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                <input
                                  type="checkbox"
                                  checked={editPerms.includes(perm.id)}
                                  onChange={() => setEditPerms((prev) => prev.includes(perm.id) ? prev.filter((p) => p !== perm.id) : [...prev, perm.id])}
                                  disabled={editRole === 'admin'}
                                  style={{ width: 14, height: 14 }}
                                />
                                {perm.label}
                              </label>
                            ))}
                          </div>
                        ) : (
                          user.role === 'admin'
                            ? <span style={{ color: '#059669', fontStyle: 'italic' }}>All modules</span>
                            : (user.permissions || []).map((p) => permLabel(p)).join(', ') || '—'
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          {editingUserId === user.id ? (
                            <>
                              <button type="button" className="dashboard-btn small success" onClick={() => saveEditUser(user.id)} title="Save">
                                <Check size={14} />
                              </button>
                              <button type="button" className="dashboard-btn small" onClick={cancelEditUser} title="Cancel" style={{ background: '#6b7280' }}>
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button type="button" className="dashboard-btn small" onClick={() => startEditUser(user)} title="Edit" style={{ background: '#3b82f6' }}>
                                <Pencil size={14} />
                              </button>
                              <button type="button" className="dashboard-btn small" onClick={() => handleToggleStatus(user)} title={user.status === 'disabled' ? 'Enable' : 'Disable'}>
                                {user.status === 'disabled'
                                  ? <ToggleLeft size={14} />
                                  : <ToggleRight size={14} />
                                }
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}

        {/* ═══════════ DEPARTMENTS TAB ═══════════ */}
        {tab === 'departments' && (
          <>
            <p className="page-placeholder-desc">
              Create department templates with pre-set module access. When adding a team member, select a department to auto-apply permissions.
            </p>
            {roleError && <p className="dashboard-error">{roleError}</p>}

            {/* Create form */}
            <section style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 12, padding: 20, color: '#fff', marginBottom: '1.5rem' }}>
              <h2 style={{ marginTop: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={20} /> Create Department
              </h2>
              <form onSubmit={handleCreateRole}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  <label style={{ color: '#fff' }}>
                    Department Name *
                    <input
                      type="text"
                      value={roleName}
                      onChange={(e) => setRoleName(e.target.value)}
                      placeholder="e.g. Customer Service"
                      required
                      style={{ width: '100%', marginTop: 6, padding: 8, color: '#1f2937', background: '#f3f4f6', borderRadius: 6, border: 'none' }}
                    />
                  </label>
                  <label style={{ color: '#fff' }}>
                    Description
                    <input
                      type="text"
                      value={roleDesc}
                      onChange={(e) => setRoleDesc(e.target.value)}
                      placeholder="What this department handles"
                      style={{ width: '100%', marginTop: 6, padding: 8, color: '#1f2937', background: '#f3f4f6', borderRadius: 6, border: 'none' }}
                    />
                  </label>
                </div>
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, color: '#fff', fontSize: '0.9rem' }}>Module Access</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                    {PERMISSION_OPTIONS.map((perm) => (
                      <label key={perm.id} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#d1d5db', fontSize: '0.875rem' }}>
                        <input
                          type="checkbox"
                          checked={rolePerms.includes(perm.id)}
                          onChange={() => toggleRolePerm(perm.id)}
                        />
                        <span>{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <button type="submit" className="dashboard-btn" disabled={savingRole} style={{ marginTop: 16 }}>
                  {savingRole ? <><Loader2 size={16} className="spin" /> Creating...</> : 'Create Department'}
                </button>
              </form>
            </section>

            {/* Departments table */}
            <section className="bookings-list">
              <table className="bookings-table">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Description</th>
                    <th>Modules</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingRoles ? (
                    <tr><td colSpan={5} className="bookings-empty"><Loader2 size={20} className="spin" /> Loading...</td></tr>
                  ) : roles.length === 0 ? (
                    <tr><td colSpan={5} className="bookings-empty">No departments yet. Create one above.</td></tr>
                  ) : roles.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.name}</td>
                      <td style={{ color: '#666' }}>{r.description || '—'}</td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {(r.permissions || []).length > 0
                          ? (r.permissions || []).map((p) => (
                              <span key={p} style={{
                                display: 'inline-block',
                                padding: '2px 6px',
                                margin: '2px 3px 2px 0',
                                borderRadius: 4,
                                fontSize: '0.75rem',
                                background: 'rgba(255, 95, 0, 0.1)',
                                color: '#e55500',
                              }}>
                                {permLabel(p)}
                              </span>
                            ))
                          : '—'
                        }
                      </td>
                      <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="dashboard-btn small danger"
                          onClick={() => handleDeleteRole(r.id)}
                          title="Delete department"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>
    </>
  )
}

export default TeamManagement
