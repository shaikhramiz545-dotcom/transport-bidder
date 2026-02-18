import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import api from '../services/api'
import '../App.css'

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/admin/forgot-password', { email })
      setSent(true)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo-wrap">
            <img src="/logo.png" alt="TBidder" className="login-logo" onError={(e) => { e.target.style.display = 'none'; }} />
          </div>
          <h1 className="login-title-fallback">Check your email</h1>
          <p style={{ margin: '1rem 0', color: '#666' }}>
            If an admin account exists with this email, you will receive an OTP to reset your password.
          </p>
          <Link to="/reset-password" state={{ email }} className="login-btn" style={{ display: 'inline-block', textAlign: 'center', textDecoration: 'none' }}>
            Enter OTP
          </Link>
          <Link to="/login" style={{ display: 'block', marginTop: '1rem', color: '#666' }}>Back to Login</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo-wrap">
          <img src="/logo.png" alt="TBidder" className="login-logo" onError={(e) => { e.target.style.display = 'none'; }} />
        </div>
        <h1 className="login-title-fallback">Forgot Password</h1>
        <p style={{ margin: '0.5rem 0 1rem', color: '#666' }}>Enter your admin email to receive an OTP</p>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label htmlFor="email">Email</label>
            <div className="login-input-wrap">
              <Mail size={20} className="login-icon" />
              <input
                id="email"
                type="email"
                placeholder="admin@tbidder.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="login-input"
                required
              />
            </div>
          </div>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Sending...' : 'Send OTP'}
          </button>
          <Link to="/login" style={{ display: 'block', marginTop: '1rem', color: '#666' }}>Back to Login</Link>
        </form>
      </div>
    </div>
  )
}

export default ForgotPassword
