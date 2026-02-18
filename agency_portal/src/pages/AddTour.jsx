import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import api from '../services/api'
import '../App.css'

const CATEGORIES = [
  { value: 'full_day', label: 'Full Day' },
  { value: 'night_tour', label: 'Night Tour' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'cultural', label: 'Cultural' },
  { value: 'family', label: 'Family' },
]

function AddTour() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [location, setLocation] = useState('')
  const [category, setCategory] = useState('cultural')
  const [description, setDescription] = useState('')
  const [includedServices, setIncludedServices] = useState('')
  const [durationMins, setDurationMins] = useState('')
  const [meetingPoint, setMeetingPoint] = useState('')
  const [cancellationPolicy, setCancellationPolicy] = useState('')
  const [freeCancellation, setFreeCancellation] = useState(true)
  const [languages, setLanguages] = useState('en,es')
  const [paxOptions, setPaxOptions] = useState([
    { label: 'Adult', pricePerPax: '', currency: 'USD' },
    { label: 'Child', pricePerPax: '', currency: 'USD' },
  ])
  const [slotDates, setSlotDates] = useState('')
  const [slotStartTime, setSlotStartTime] = useState('09:00')
  const [slotEndTime, setSlotEndTime] = useState('18:00')
  const [slotMaxPax, setSlotMaxPax] = useState(10)
  const [images, setImages] = useState([])      // preview-only (not sent to backend)
  const [videoUrl, setVideoUrl] = useState('')  // preview-only (not sent to backend)

  const addPaxOption = () => {
    setPaxOptions([...paxOptions, { label: '', pricePerPax: '', currency: 'USD' }])
  }

  const removePaxOption = (i) => {
    if (paxOptions.length <= 1) return
    setPaxOptions(paxOptions.filter((_, idx) => idx !== i))
  }

  const updatePaxOption = (i, field, value) => {
    const next = [...paxOptions]
    next[i] = { ...next[i], [field]: value }
    setPaxOptions(next)
  }

  const handlePhotoUpload = (e) => {
    // Preview-only: do NOT upload or persist photos server-side
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const remaining = 10 - images.length
    if (remaining <= 0) return
    const toUse = files.slice(0, remaining)
    const previews = toUse.map((file) => URL.createObjectURL(file))
    setImages((prev) => [...prev, ...previews].slice(0, 10))
    e.target.value = ''
  }

  const handleVideoUpload = (e) => {
    // Preview-only: do NOT upload or persist video server-side
    const file = e.target.files?.[0]
    if (!file) return
    const preview = URL.createObjectURL(file)
    setVideoUrl(preview)
    e.target.value = ''
  }

  const removeImage = (i) => setImages((prev) => prev.filter((_, idx) => idx !== i))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const opts = paxOptions
        .filter((o) => o.label.trim() && (parseFloat(o.pricePerPax) || 0) > 0)
        .map((o) => ({
          label: o.label.trim(),
          pricePerPax: parseFloat(o.pricePerPax) || 0,
          currency: o.currency,
        }))

      if (opts.length === 0) {
        setError('Add at least one pax option with price')
        setLoading(false)
        return
      }

      const dates = slotDates
        .split(/[\n,;]+/)
        .map((d) => d.trim())
        .filter(Boolean)

      const slots = dates.map((d) => ({
        slotDate: d,
        startTime: slotStartTime,
        endTime: slotEndTime || null,
        maxPax: parseInt(slotMaxPax, 10) || 10,
      }))

      await api.post('/agency/tours', {
        title: title.trim(),
        country: country.trim(),
        city: city.trim(),
        location: location.trim() || null,
        category,
        description: description.trim() || null,
        includedServices: includedServices.trim() || null,
        // Do not persist media; keep DB light for cost saving
        images: [],
        videoUrl: null,
        durationMins: durationMins ? parseInt(durationMins, 10) : null,
        meetingPoint: meetingPoint.trim() || null,
        cancellationPolicy: cancellationPolicy.trim() || null,
        freeCancellation,
        languages: languages.split(/[\s,]+/).map((l) => l.trim()).filter(Boolean) || ['en'],
        paxOptions: opts,
        slots: slots.length > 0 ? slots : undefined,
      })

      navigate('/tours', { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to create tour')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 1rem' }}>Add New Tour</h2>
      <div className="agency-card">
        <form onSubmit={handleSubmit}>
          {error && <p className="agency-error">{error}</p>}

          <div className="form-row">
            <label>Tour Title *</label>
            <input
              type="text"
              placeholder="e.g. Machu Picchu Day Tour"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-row two-cols">
            <div>
              <label>Country *</label>
              <input
                type="text"
                placeholder="PE"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                required
              />
            </div>
            <div>
              <label>City *</label>
              <input
                type="text"
                placeholder="Cusco"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <label>Location / Landmark</label>
            <input
              type="text"
              placeholder="e.g. Machu Picchu Citadel"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className="form-row">
            <label>Category *</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <h3 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>Photos (max 10, preview only – not stored)</h3>
          <div className="upload-section">
            <div className="upload-preview-grid">
              {images.map((url, i) => (
                <div key={i} className="upload-preview-item">
                  <img src={url} alt={`Preview ${i + 1}`} />
                  <button type="button" className="upload-remove" onClick={() => removeImage(i)} title="Remove">✕</button>
                </div>
              ))}
            </div>
            {images.length < 10 && (
              <label className="upload-btn">
                <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} />
                {`+ Add Photo (${images.length}/10)`}
              </label>
            )}
          </div>

          <h3 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>Video (1, preview only – not stored)</h3>
          <div className="upload-section">
            {videoUrl ? (
              <div className="upload-preview-item upload-video-preview">
                <video src={videoUrl} controls style={{ maxWidth: '100%', maxHeight: 200 }} />
                <button type="button" className="upload-remove" onClick={() => setVideoUrl('')} title="Remove">✕</button>
              </div>
            ) : (
              <label className="upload-btn">
                <input type="file" accept="video/*" onChange={handleVideoUpload} />
                + Add Video
              </label>
            )}
          </div>

          <div className="form-row">
            <label>Description</label>
            <textarea
              placeholder="Describe your tour..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="form-row">
            <label>Included Services (bullet points)</label>
            <textarea
              placeholder={'• Round-trip ticket\n• Guide\n• Lunch'}
              value={includedServices}
              onChange={(e) => setIncludedServices(e.target.value)}
            />
          </div>

          <div className="form-row two-cols">
            <div>
              <label>Duration (minutes)</label>
              <input
                type="number"
                placeholder="480"
                value={durationMins}
                onChange={(e) => setDurationMins(e.target.value)}
              />
            </div>
            <div>
              <label>Languages (comma separated)</label>
              <input
                type="text"
                placeholder="en, es"
                value={languages}
                onChange={(e) => setLanguages(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <label>Meeting Point</label>
            <input
              type="text"
              placeholder="Hotel lobby pickup"
              value={meetingPoint}
              onChange={(e) => setMeetingPoint(e.target.value)}
            />
          </div>

          <div className="form-row">
            <label>Cancellation Policy</label>
            <input
              type="text"
              placeholder="Free cancellation up to 24h before"
              value={cancellationPolicy}
              onChange={(e) => setCancellationPolicy(e.target.value)}
            />
          </div>
          <div className="form-row" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              id="freeCancellation"
              checked={freeCancellation}
              onChange={(e) => setFreeCancellation(e.target.checked)}
            />
            <label htmlFor="freeCancellation" style={{ margin: 0 }}>
              Free cancellation (full refund if cancelled at least 24h in advance)
            </label>
          </div>

          <h3 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>Pax Options & Prices *</h3>
          {paxOptions.map((p, i) => (
            <div key={i} className="pax-option-row">
              <div>
                <label>Label</label>
                <input
                  type="text"
                  placeholder="Adult"
                  value={p.label}
                  onChange={(e) => updatePaxOption(i, 'label', e.target.value)}
                />
              </div>
              <div>
                <label>Price per pax</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="50"
                  value={p.pricePerPax}
                  onChange={(e) => updatePaxOption(i, 'pricePerPax', e.target.value)}
                />
              </div>
              <div>
                <label>Currency</label>
                <select value={p.currency} onChange={(e) => updatePaxOption(i, 'currency', e.target.value)}>
                  <option value="USD">USD</option>
                  <option value="PEN">PEN</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <button type="button" className="btn-remove" onClick={() => removePaxOption(i)} title="Remove">
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="btn-add" onClick={addPaxOption}>+ Add option</button>

          <h3 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>Available Slots (optional)</h3>
          <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
            Enter dates (one per line or comma-separated), e.g. 2025-02-15, 2025-02-16
          </p>
          <div className="form-row two-cols">
            <div>
              <label>Dates</label>
              <textarea
                placeholder={'2025-02-15\n2025-02-16'}
                value={slotDates}
                onChange={(e) => setSlotDates(e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <div className="form-row">
                <label>Start time</label>
                <input type="text" placeholder="09:00" value={slotStartTime} onChange={(e) => setSlotStartTime(e.target.value)} />
              </div>
              <div className="form-row">
                <label>End time</label>
                <input type="text" placeholder="18:00" value={slotEndTime} onChange={(e) => setSlotEndTime(e.target.value)} />
              </div>
              <div className="form-row">
                <label>Max pax per slot</label>
                <input type="number" value={slotMaxPax} onChange={(e) => setSlotMaxPax(e.target.value)} />
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <><Loader2 size={18} className="spin" style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} /> Submitting... </> : 'Submit Tour'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate('/tours')}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddTour
