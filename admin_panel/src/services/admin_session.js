/** Decode JWT payload without extra dependencies. */
function decodeJwtPayload(token) {
  try {
    const base64Url = token.split('.')[1] || ''
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join('')
    )
    return JSON.parse(json)
  } catch (_) {
    return null
  }
}

export function getAdminSession() {
  const token = localStorage.getItem('token')
  if (!token) return null
  const payload = decodeJwtPayload(token)
  if (!payload) return null
  return {
    email: payload.sub || '',
    name: payload.name || '',
    department: payload.department || '',
    role: payload.role || 'admin',
    permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
  }
}

export function hasPermission(permission) {
  if (!permission) return true
  const session = getAdminSession()
  if (!session) return false
  if (session.role === 'admin') return true
  if (session.permissions.includes(permission)) return true
  // Backward compat: old admin_users / admin_roles → new team permission
  if (permission === 'team') return session.permissions.includes('admin_users') || session.permissions.includes('admin_roles')
  return false
}
