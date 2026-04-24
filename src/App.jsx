import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DisplayPage from './display/DisplayPage'

function ProtectedApp() {
  const { session } = useAuth()

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

      <Route
        path="*"
        element={<Navigate to={session ? '/me' : '/login'} replace />}
      />
    </Routes>
  )
}

export default function App() {
  const path = window.location.pathname

  if (path === '/display' || path === '/display/') {
    return (
      <Routes>
        <Route path="/display" element={<DisplayPage />} />
        <Route path="/display/" element={<DisplayPage />} />
      </Routes>
    )
  }

  return <ProtectedApp />
}