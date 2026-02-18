import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, ArrowLeft } from 'lucide-react'
import api from '../services/api'
import '../App.css'

const CATEGORIES = [
  { value: 'full_day', label: 'Full Day' },
  { value: 'night_tour', label: 'Night Tour' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'cultural', label: 'Cultural' },
  { value: 'family', label: 'Family' },
]

function EditTour() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
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
  const [languages, setLanguages] = useState('en,es')
  const [images, setImages] = useState([])
  const [videoUrl, setVideoUrl] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [initial, setInitial] = useState(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [suspendFixInstructions, setSuspendFixInstructions] = useState('')
  const [tourStatus, setTourStatus] = useState('')
  const [freeCancellation, setFreeCancellation] = useState(true)

  useEffect(() => {
    const ac = new AbortController()
    api.get(`/agency/tours/${id}`, { signal: ac.signal })
      .then(({ data }) => {
        setTitle(data.title || '')
        setCountry(data.country || '')
        setCity(data.city || '')
        setLocation(data.location || '')
        setCategory(data.category || 'cultural')
        setDescription(data.description || '')
        setIncludedServices(data.includedServices || '')
        setDurationMins(data.durationMins ? String(data.durationMins) : '')
        setMeetingPoint(data.meetingPoint || '')
        setCancellationPolicy(data.cancellationPolicy || '')
        setFreeCancellation(data.freeCancellation !== false)
        setLanguages(Array.isArray(data.languages) ? data.languages.join(', ') : (data.languages || 'en,es'))
        setImages(Array.isArray(data.images) ? data.images : [])
        setVideoUrl(data.videoUrl || '')
        setTourStatus(data.status || '')
        setSuspendReason(data.suspendReason || '')
        setSuspendFixInstructions(data.suspendFixInstructions || '')
        setInitial({
          title: data.title || '',
          country: data.country || '',
          city: data.city || '',
          location: data.location || '',
          category: data.category || 'cultural',
          description: data.description || '',
          includedServices: data.includedServices || '',
          durationMins: data.durationMins ? String(data.durationMins) : '',
          meetingPoint: data.meetingPoint || '',
          cancellationPolicy: data.cancellationPolicy || '',
          freeCancellation: data.freeCancellation !== false,
          languages: Array.isArray(data.languages) ? data.languages.join(', ') : (data.languages || 'en,es'),
          images: Array.isArray(data.images) ? [...data.images] : [],
          videoUrl: data.videoUrl || '',
        })
        setError('')
      })
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return
        if (err.response?.status === 401) navigate('/login', { replace: true })
        else setError(err.response?.data?.error || 'Failed to load tour')
      })
      .finally(() => setFetching(false))
    return () => ac.abort()
  }, [id, navigate])

  const handlePhotoUpload = (e) => {
    // New policy: uploads disabled to save storage cost
    setError('Photo uploads are disabled. Only existing images can be kept or removed.')
    e.target.value = ''
  }

  const handleVideoUpload = (e) => {
    // New policy: uploads disabled to save storage cost
    setError('Video uploads are disabled. Only existing video can be removed.')
    e.target.value = ''
  }

  const removeImage = (i) => setImages((prev) => prev.filter((_, idx) => idx !== i))

  const getChangeSummary = () => {
    if (!initial) return ''
    const lines = []
    const add = (label, oldV, newV) => {
      const o = String(oldV || '').trim()
      const n = String(newV || '').trim()
      if (o !== n) lines.push(`${label}: "${o}" → "${n}"`)
    }
    const langs = (v) => (v || '').split(/[\s,]+/).map((l) => l.trim()).filter(Boolean).join(', ')
    add('Title', initial.title, title)
    add('Country', initial.country, country)
    add('City', initial.city, city)
    add('Location', initial.location, location)
    add('Category', initial.category, category)
    add('Description', initial.description, description)
    add('Included Services', initial.includedServices, includedServices)
    add('Duration (mins)', initial.durationMins, durationMins)
    add('Meeting Point', initial.meetingPoint, meetingPoint)
    add('Cancellation Policy', initial.cancellationPolicy, cancellationPolicy)
    add('Free Cancellation', initial.freeCancellation ? 'yes' : 'no', freeCancellation ? 'yes' : 'no')
    add('Languages', langs(initial.languages), langs(languages))
    return lines.join('\n')
  }

  const getChangeType = () => {
    if (!initial) return 'none'
    const langs = (v) => (v || '').split(/[\s,]+/).map((l) => l.trim()).filter(Boolean).join(',')
    const same = (a, b) => String(a || '') === String(b || '')
    const sameArr = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || [])

    const nonMediaSame =
      same(title.trim(), initial.title) &&
      same(country.trim(), initial.country) &&
      same(city.trim(), initial.city) &&
      same((location || '').trim(), initial.location) &&
      same(category, initial.category) &&
      same(description.trim(), initial.description) &&
      same(includedServices.trim(), initial.includedServices) &&
      same(durationMins ? String(durationMins) : '', initial.durationMins) &&
      same(meetingPoint.trim(), initial.meetingPoint) &&
      same(cancellationPolicy.trim(), initial.cancellationPolicy) &&
      same(String(freeCancellation), String(initial.freeCancellation)) &&
      same(langs(languages), langs(initial.languages))

    const mediaChanged = !sameArr(images, initial.images) || !same(videoUrl || '', initial.videoUrl)
    if (nonMediaSame && !mediaChanged) return 'none'
    if (nonMediaSame && mediaChanged) return 'media_only'
    return 'other'
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!initial) return

    const changeType = getChangeType()
    if (changeType === 'none') {
      setError('No changes to save.')
      return
    }
    const goesToPending = tourStatus === 'suspended' || changeType === 'other'
    const warning = goesToPending
      ? 'Tour will go to Pending and be hidden from listing until admin re-approves. Proceed?'
      : 'Photo/Video updates will apply instantly on backend. Display on listing may take 2–4 hours. Proceed?'
    if (!window.confirm(warning)) return

    const changeSummary = (changeType === 'other' || tourStatus === 'suspended') ? getChangeSummary() : null

    setError('')
    setLoading(true)
    try {
      await api.put(`/agency/tours/${id}`, {
        changeSummary,
        title: title.trim(),
        country: country.trim(),
        city: city.trim(),
        location: location.trim() || null,
        category,
        description: description.trim() || null,
        includedServices: includedServices.trim() || null,
        // Keep or clear existing media references only; no new uploads are stored
        images: images.slice(0, 10),
        videoUrl: videoUrl || null,
        durationMins: durationMins ? parseInt(durationMins, 10) : null,
        meetingPoint: meetingPoint.trim() || null,
        cancellationPolicy: cancellationPolicy.trim() || null,
        freeCancellation,
        languages: languages.split(/[\s,]+/).map((l) => l.trim()).filter(Boolean) || ['en'],
      })
      navigate(`/tours/${id}`, { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to update tour')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="agency-card">
        <div className="agency-loading">
          <Loader2 size={24} className="spin" /> Loading...
        </div>
      </div>
    )
  }

  if (error && !title) {
    return (
      <div className="agency-card">
        <p className="agency-error">{error}</p>
        <button type="button" className="btn-secondary" onClick={() => navigate('/tours')}>
          <ArrowLeft size={16} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} /> Back
        </button>
      </div>
    )
  }

  if (tourStatus === 'blocked') {
    return (
      <div className="agency-card">
        <p className="agency-error">This tour is blocked. Contact admin for reinstatement.</p>
        <button type="button" className="btn-secondary" onClick={() => navigate('/tours')}>
          <ArrowLeft size={16} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} /> Back to Tours
        </button>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <button type="button" className="btn-secondary" onClick={() => navigate(`/tours/${id}`)}>
          <ArrowLeft size={16} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} /> Back
        </button>
        <h2 style={{ margin: 0 }}>Edit Tour</h2>
      </div>
      <div className="agency-card">
        <form onSubmit={handleSubmit}>
          {error && <p className="agency-error">{error}</p>}
          {tourStatus === 'suspended' && (suspendReason || suspendFixInstructions) && (
            <div
              style={{
                background: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: 8,
                padding: '1rem',
                marginBottom: '1rem',
              }}
            >
              <h4 style={{ margin: '0 0 0.5rem', color: '#92400e' }}>⚠️ Tour Suspended – Fix Required</h4>
              {suspendReason && <p style={{ margin: '0.25rem 0', fontWeight: 600 }}>Reason: {suspendReason}</p>}
              {suspendFixInstructions && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{suspendFixInstructions}</p>}
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#92400e' }}>Make changes as per instructions and save. Tour will go to Pending for admin review.</p>
            </div>
          )}
          <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1rem' }}>
            Editing other fields will set tour to Pending (hidden until re-approved). New photo/video uploads are disabled to reduce storage cost – you can only keep or remove existing media. Pax options & slots cannot be changed here.
          </p>

          <h3 style={{ marginBottom: '0.75rem' }}>Photos (max 10; new uploads disabled)</h3>
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
                <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} disabled={uploadingPhoto} />
                {uploadingPhoto ? 'Uploading...' : `+ Add Photo (${images.length}/10)`}
              </label>
            )}
          </div>

          <h3 style={{ marginTop: '1rem', marginBottom: '0.75rem' }}>Video (1; new uploads disabled)</h3>
          <div className="upload-section">
            {videoUrl ? (
              <div className="upload-preview-item upload-video-preview">
                <video src={videoUrl} controls style={{ maxWidth: '100%', maxHeight: 200 }} />
                <button type="button" className="upload-remove" onClick={() => setVideoUrl('')} title="Remove">✕</button>
              </div>
            ) : (
              <label className="upload-btn">
                <input type="file" accept="video/*" onChange={handleVideoUpload} disabled={uploadingVideo} />
                {uploadingVideo ? 'Uploading...' : '+ Add Video'}
              </label>
            )}
          </div>

          <div className="form-row">
            <label>Tour Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="form-row two-cols">
            <div>
              <label>Country *</label>
              <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} required />
            </div>
            <div>
              <label>City *</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} required />
            </div>
          </div>

          <div className="form-row">
            <label>Location / Landmark</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>

          <div className="form-row">
            <label>Category *</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </div>

          <div className="form-row">
            <label>Included Services (bullet points)</label>
            <textarea value={includedServices} onChange={(e) => setIncludedServices(e.target.value)} rows={3} />
          </div>

          <div className="form-row two-cols">
            <div>
              <label>Duration (minutes)</label>
              <input type="number" value={durationMins} onChange={(e) => setDurationMins(e.target.value)} />
            </div>
            <div>
              <label>Languages (comma separated)</label>
              <input type="text" value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="en, es" />
            </div>
          </div>

          <div className="form-row">
            <label>Meeting Point</label>
            <input type="text" value={meetingPoint} onChange={(e) => setMeetingPoint(e.target.value)} />
          </div>

          <div className="form-row">
            <label>Cancellation Policy</label>
            <input type="text" value={cancellationPolicy} onChange={(e) => setCancellationPolicy(e.target.value)} />
          </div>
          <div className="form-row" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              id="freeCancellationEdit"
              checked={freeCancellation}
              onChange={(e) => setFreeCancellation(e.target.checked)}
            />
            <label htmlFor="freeCancellationEdit" style={{ margin: 0 }}>
              Free cancellation (full refund if cancelled at least 24h in advance)
            </label>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <><Loader2 size={18} className="spin" style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} /> Saving... </> : 'Save Changes'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate(`/tours/${id}`)}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditTour
