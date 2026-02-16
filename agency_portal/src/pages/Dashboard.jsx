import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { List, PlusCircle } from 'lucide-react'
import api from '../services/api'
import '../App.css'

function Dashboard() {
  const navigate = useNavigate()
  const [tours, setTours] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/agency/tours')
      .then(({ data }) => setTours(data.tours || []))
      .catch(() => setTours([]))
      .finally(() => setLoading(false))
  }, [])

  const pending = tours.filter((t) => t.status === 'pending').length
  const approved = tours.filter((t) => t.status === 'approved').length

  return (
    <div className="agency-card">
      <h2>Dashboard</h2>
      {loading ? (
        <div className="agency-loading">
          <span className="spin">⟳</span> Loading...
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '1rem', background: '#f9f9f9', borderRadius: '8px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{tours.length}</div>
              <div style={{ fontSize: '0.875rem', color: '#666' }}>Total Tours</div>
            </div>
            <div style={{ padding: '1rem', background: '#fef3c7', borderRadius: '8px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#d97706' }}>{pending}</div>
              <div style={{ fontSize: '0.875rem', color: '#666' }}>Pending Approval</div>
            </div>
            <div style={{ padding: '1rem', background: '#d1fae5', borderRadius: '8px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#059669' }}>{approved}</div>
              <div style={{ fontSize: '0.875rem', color: '#666' }}>Approved (Live)</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-primary" onClick={() => navigate('/tours')}>
              <List size={18} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />
              My Tours
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate('/tours/add')}>
              <PlusCircle size={18} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />
              Add New Tour
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default Dashboard
