import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFeatureByPath } from '../config/firm'
import api from '../services/api'
import { Loader2 } from 'lucide-react'
import '../App.css'

function Dispatcher() {
  const navigate = useNavigate()
  const feature = getFeatureByPath('/dispatcher')
  const title = feature?.label ?? 'Dispatcher'
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    pickupAddress: '',
    dropAddress: '',
    pickupLat: 0,
    pickupLng: 0,
    dropLat: 0,
    dropLng: 0,
    distanceKm: 0,
    trafficDelayMins: 0,
    vehicleType: 'car',
    userPrice: 0,
    userPhone: '',
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setMessage('')
    setLoading(true)
    api.post('/admin/dispatcher/ride', {
      ...form,
      pickupLat: Number(form.pickupLat) || 0,
      pickupLng: Number(form.pickupLng) || 0,
      dropLat: Number(form.dropLat) || 0,
      dropLng: Number(form.dropLng) || 0,
      distanceKm: Number(form.distanceKm) || 0,
      trafficDelayMins: Number(form.trafficDelayMins) || 0,
      userPrice: Number(form.userPrice) || 0,
    })
      .then(({ data }) => {
        setMessage(data.message || 'Ride created. Drivers will see it in requests.')
        setForm({ ...form, pickupAddress: '', dropAddress: '', userPhone: '', userPrice: 0 })
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem('token')
          navigate('/login', { replace: true })
          return
        }
        setMessage(err.response?.data?.error || err.message || 'Failed to create ride')
      })
      .finally(() => setLoading(false))
  }

  return (
    <>
      <header className="dashboard-header">
        <h1 className="dashboard-header-title">{title}</h1>
      </header>
      <div className="dashboard-content">
        <p className="page-placeholder-desc">Create a ride manually. Drivers will see it in their app.</p>
        <form onSubmit={handleSubmit} className="dispatcher-form">
          <div className="form-row">
            <label>Pickup address</label>
            <input type="text" value={form.pickupAddress} onChange={(e) => setForm({ ...form, pickupAddress: e.target.value })} placeholder="e.g. Lima Centro" required />
          </div>
          <div className="form-row">
            <label>Drop address</label>
            <input type="text" value={form.dropAddress} onChange={(e) => setForm({ ...form, dropAddress: e.target.value })} placeholder="e.g. Miraflores" required />
          </div>
          <div className="form-row two-cols">
            <div><label>Pickup lat</label><input type="number" step="any" value={form.pickupLat || ''} onChange={(e) => setForm({ ...form, pickupLat: e.target.value })} placeholder="-12.04" /></div>
            <div><label>Pickup lng</label><input type="number" step="any" value={form.pickupLng || ''} onChange={(e) => setForm({ ...form, pickupLng: e.target.value })} placeholder="-77.04" /></div>
          </div>
          <div className="form-row two-cols">
            <div><label>Drop lat</label><input type="number" step="any" value={form.dropLat || ''} onChange={(e) => setForm({ ...form, dropLat: e.target.value })} placeholder="-12.12" /></div>
            <div><label>Drop lng</label><input type="number" step="any" value={form.dropLng || ''} onChange={(e) => setForm({ ...form, dropLng: e.target.value })} placeholder="-77.03" /></div>
          </div>
          <div className="form-row two-cols">
            <div><label>Distance (km)</label><input type="number" step="0.1" value={form.distanceKm || ''} onChange={(e) => setForm({ ...form, distanceKm: e.target.value })} placeholder="5" /></div>
            <div><label>Traffic delay (mins)</label><input type="number" value={form.trafficDelayMins || ''} onChange={(e) => setForm({ ...form, trafficDelayMins: e.target.value })} placeholder="0" /></div>
          </div>
          <div className="form-row two-cols">
            <div>
              <label>Vehicle type</label>
              <select value={form.vehicleType} onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}>
                <option value="taxi_std">Taxi Std (4)</option>
                <option value="taxi_suv">Taxi SUV (6)</option>
                <option value="taxi_xl">Taxi XL (8)</option>
                <option value="taxi_outstation">Outstation</option>
                <option value="truck_s">Truck S (1T)</option>
                <option value="truck_m">Truck M (3T)</option>
                <option value="truck_l">Truck L (10T)</option>
                <option value="truck_hauler">Car Hauler</option>
                <option value="moto">Bike/Moto</option>
                <option value="delivery">Delivery</option>
                <option value="amb_basic">Ambulance Basic</option>
                <option value="amb_icu">Ambulance ICU</option>
                <option value="car">Car (legacy)</option>
              </select>
            </div>
            <div><label>Price (S/)</label><input type="number" step="0.01" value={form.userPrice || ''} onChange={(e) => setForm({ ...form, userPrice: e.target.value })} placeholder="15.00" required /></div>
          </div>
          <div className="form-row">
            <label>User phone (optional)</label>
            <input type="text" value={form.userPhone} onChange={(e) => setForm({ ...form, userPhone: e.target.value })} placeholder="+51..." />
          </div>
          {message && <p className={message.startsWith('Ride created') ? 'dashboard-success' : 'dashboard-error'}>{message}</p>}
          <button type="submit" className="dashboard-btn" disabled={loading}>{loading ? <><Loader2 size={18} className="spin" /> Creating...</> : 'Create ride'}</button>
        </form>
      </div>
    </>
  )
}

export default Dispatcher
