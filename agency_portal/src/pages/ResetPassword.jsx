import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Lock, Hash } from 'lucide-react'
import api from '../services/api'
import './Login.css'

function ResetPassword() {
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState(location.state?.email || '')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      await api.post('/agency/reset-password', {
        email,
        otp,
        newPassword,
      })
      navigate('/login', { replace: true, state: { message: 'Password reset successfully. You can now login.' } })
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo-wrap">
          <img src="/logo.png" alt="TBidder" className="login-logo" style={{ maxHeight: 64, marginBottom: 8 }} onError={(e) => { e.target.style.display = 'none'; }} />
        </div>
        <h1 className="login-title">Reset Password</h1>
        <p style={{ margin: '0.5rem 0 1rem', color: '#666' }}>Enter the OTP sent to your email and your new password</p>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="login-input"
              placeholder="agency@example.com"
              required
            />
          </div>
          <div className="login-field">
            <label htmlFor="otp">OTP (6 digits)</label>
            <div className="login-input-wrap">
              <Hash size={18} className="login-icon" />
              <input
                id="otp"
                type="text"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="login-input"
                maxLength={6}
                required
              />
            </div>
          </div>
          <div className="login-field">
            <label htmlFor="newPassword">New Password</label>
            <div className="login-input-wrap">
              <Lock size={18} className="login-icon" />
              <input
                id="newPassword"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="login-input"
                minLength={6}
                required
              />
            </div>
          </div>
          <div className="login-field">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div className="login-input-wrap">
              <Lock size={18} className="login-icon" />
              <input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="login-input"
                minLength={6}
                required
              />
            </div>
          </div>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
          <Link to="/login" style={{ display: 'block', marginTop: '1rem', color: '#666' }}>Back to Login</Link>
        </form>
      </div>
    </div>
  )
}

export default ResetPassword
