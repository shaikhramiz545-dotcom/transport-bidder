import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, Lock } from 'lucide-react'
import api from '../services/api'
import './Login.css'

function Login() {
  const navigate = useNavigate()
  const [isSignup, setIsSignup] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isSignup) {
        const { data } = await api.post('/agency/signup', {
          name,
          email,
          password,
          phone: phone || undefined,
          country,
          currency,
        })
        localStorage.setItem('agency_token', data.token)
        localStorage.setItem('agency_data', JSON.stringify(data.agency))
        navigate('/dashboard', { replace: true })
      } else {
        const { data } = await api.post('/agency/login', { email, password })
        localStorage.setItem('agency_token', data.token)
        localStorage.setItem('agency_data', JSON.stringify(data.agency))
        navigate('/dashboard', { replace: true })
      }
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
          <h1 className="login-title">TBidder Partner Portal</h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: '#666' }}>
            Travel Agency – Add & manage your tours
          </p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          {isSignup && (
            <>
              <div className="login-field">
                <label>Agency Name</label>
                <input
                  type="text"
                  placeholder="Your agency name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="login-input"
                  required
                />
              </div>
              <div className="login-field form-row two-cols">
                <div>
                  <label>Country</label>
                  <input
                    type="text"
                    placeholder="PE"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="login-input"
                    required
                  />
                </div>
                <div>
                  <label>Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="login-input"
                  >
                    <option value="USD">USD</option>
                    <option value="PEN">PEN</option>
                    <option value="EUR">EUR</option>
                    <option value="INR">INR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>
              <div className="login-field">
                <label>Phone (optional)</label>
                <input
                  type="tel"
                  placeholder="+51 999 123 456"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="login-input"
                />
              </div>
            </>
          )}
          <div className="login-field">
            <label>Email</label>
            <div className="login-input-wrap">
              <Mail size={18} className="login-icon" />
              <input
                type="email"
                placeholder="agency@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="login-input"
                required
              />
            </div>
          </div>
          <div className="login-field">
            <label>Password</label>
            <div className="login-input-wrap">
              <Lock size={18} className="login-icon" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-input"
                required
                minLength={isSignup ? 6 : 1}
              />
            </div>
            {isSignup && <small style={{ color: '#666' }}>Min 6 characters</small>}
          </div>
          {error && <p className="login-error">{error}</p>}
          <p style={{ marginTop: '0.5rem' }}>
            <Link to="/forgot-password" style={{ fontSize: '0.9rem', color: '#666' }}>Forgot password?</Link>
          </p>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Please wait...' : (isSignup ? 'Create Account' : 'Sign In')}
          </button>
          <p className="login-toggle">
            {isSignup ? (
              <>Already have an account? <a onClick={() => { setIsSignup(false); setError(''); }}>Sign in</a></>
            ) : (
              <>New travel agency? <a onClick={() => { setIsSignup(true); setError(''); }}>Sign up</a></>
            )}
          </p>
        </form>
      </div>
    </div>
  )
}

export default Login
