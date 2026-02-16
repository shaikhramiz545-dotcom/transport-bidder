import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Bookings from './pages/Bookings'
import RideDetail from './pages/RideDetail'
import Dispatcher from './pages/Dispatcher'
import VerificationHub from './pages/VerificationHub'
import Drivers from './pages/Drivers'
import DriverDetail from './pages/DriverDetail'
import Finance from './pages/Finance'
import Agencies from './pages/Agencies'
import Tours from './pages/Tours'
import ToursLayout from './pages/ToursLayout'
import TourDetail from './pages/TourDetail.jsx'
import AgencyVerificationList from './pages/AgencyVerificationList'
import AgencyVerificationDetail from './pages/AgencyVerificationDetail'
import AgencyPayouts from './pages/AgencyPayouts'
import Settings from './pages/Settings'
import TBidderHealth from './pages/TBidderHealth'
import TeamManagement from './pages/TeamManagement'
import './App.css'

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token')
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
          <Route path="bookings" element={<Bookings />} />
          <Route path="bookings/:id" element={<RideDetail />} />
          <Route path="dispatcher" element={<Dispatcher />} />
          <Route path="verification-hub" element={<VerificationHub />} />
          <Route path="drivers" element={<Drivers />} />
          <Route path="drivers/:driverId" element={<DriverDetail />} />
          <Route path="finance" element={<Finance />} />
          <Route path="agencies" element={<Agencies />} />
          <Route path="tours" element={<ToursLayout />}>
            <Route index element={<Tours />} />
            <Route path="agency-verification" element={<AgencyVerificationList />} />
            <Route path="agency-verification/:id" element={<AgencyVerificationDetail />} />
            <Route path=":id" element={<TourDetail />} />
          </Route>
          <Route path="agency-payouts" element={<AgencyPayouts />} />
          <Route path="tbidder-health" element={<TBidderHealth />} />
          <Route path="settings" element={<Settings />} />
          <Route path="team" element={<TeamManagement />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
