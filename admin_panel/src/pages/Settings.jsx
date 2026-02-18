import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFeatureByPath } from '../config/firm'
import api from '../services/api'
import { Loader2 } from 'lucide-react'
import '../App.css'

function Settings() {
  const navigate = useNavigate()
  const feature = getFeatureByPath('/settings')
  const title = feature?.label ?? 'Settings'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ commissionPercent: 10, notificationsEnabled: true })

  useEffect(() => {
    api.get('/admin/settings')
      .then(({ data }) => setForm({ commissionPercent: data.commissionPercent ?? 10, notificationsEnabled: data.notificationsEnabled !== false }))
      .catch((err) => {
        if (err.response?.status === 401) { localStorage.removeItem('token'); navigate('/login', { replace: true }); return }
      })
      .finally(() => setLoading(false))
  }, [navigate])

  const handleSubmit = (e) => {
    e.preventDefault()
    setMessage('')
    setSaving(true)
    api.post('/admin/settings', form)
      .then(({ data }) => setMessage(data.message || 'Settings saved.'))
      .catch((err) => {
        if (err.response?.status === 401) { localStorage.removeItem('token'); navigate('/login', { replace: true }); return }
        setMessage(err.response?.data?.error || err.message || 'Failed to save')
      })
      .finally(() => setSaving(false))
  }

  return (
    <>
      <header className="dashboard-header">
        <h1 className="dashboard-header-title">{title}</h1>
      </header>
      <div className="dashboard-content">
        <p className="page-placeholder-desc">Commission rates, push notifications, Firma settings.</p>
        {loading && <div className="dashboard-loading"><Loader2 size={32} className="spin" /><span>Loading...</span></div>}
        {!loading && (
          <form onSubmit={handleSubmit} className="dispatcher-form">
            <div className="form-row">
              <label>Commission (%)</label>
              <input type="number" min="0" max="100" step="0.5" value={form.commissionPercent} onChange={(e) => setForm({ ...form, commissionPercent: Number(e.target.value) || 0 })} />
            </div>
            <div className="form-row">
              <label><input type="checkbox" checked={form.notificationsEnabled} onChange={(e) => setForm({ ...form, notificationsEnabled: e.target.checked })} /> Notifications enabled</label>
            </div>
            {message && <p className="dashboard-success">{message}</p>}
            <button type="submit" className="dashboard-btn" disabled={saving}>{saving ? <><Loader2 size={18} className="spin" /> Saving...</> : 'Save settings'}</button>
          </form>
        )}
      </div>
    </>
  )
}

export default Settings
