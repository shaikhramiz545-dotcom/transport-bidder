import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL
  ? (import.meta.env.VITE_API_URL.replace(/\/$/, '') + '/api')
  : '/api'
const api = axios.create({ baseURL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('agency_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'] // Let browser set multipart/form-data with boundary
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('agency_token')
      localStorage.removeItem('agency_data')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
