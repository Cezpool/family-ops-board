import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

export default function App() {
  const { session } = useAuth()

  // Still loading session
  if (session === undefined) {
    return <div className="loading-screen">Loading…</div>
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={session ? <Navigate to="/me" replace /> : <Login />}
      />
      <Route
        path="/me"
        element={session ? <Dashboard /> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to={session ? '/me' : '/login'} replace />} />
    </Routes>
  )
}
