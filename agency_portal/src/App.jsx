import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import MyTours from './pages/MyTours'
import AddTour from './pages/AddTour'
import TourDetail from './pages/TourDetail'
import EditTour from './pages/EditTour'
import Payment from './pages/Payment'
import BookingHistory from './pages/BookingHistory'
import Verification from './pages/Verification'
import './App.css'

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('agency_token')
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return children
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="verification" element={<Verification />} />
          <Route path="tours" element={<MyTours />} />
          <Route path="tours/add" element={<AddTour />} />
          <Route path="tours/:id" element={<TourDetail />} />
          <Route path="tours/:id/edit" element={<EditTour />} />
          <Route path="payment" element={<Payment />} />
          <Route path="bookings" element={<BookingHistory />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
