import { useState } from 'react'
import { supabase } from '../supabaseClient'
import './Login.css'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const normalizedUsername = username.trim().toLowerCase()
    const email = normalizedUsername.includes('@')
      ? normalizedUsername
      : `${normalizedUsername}@family.local`

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
    }

    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-mark">FOB</div>
          <h1 className="login-title">Family Ops Board</h1>
          <p className="login-sub">Sign in to your family workspace</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div className="error-msg">{error}</div>}

          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="chris"
            />
            <p style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>
              Use your family login name
            </p>
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="login-footer">
          Contact a parent admin to get access.
        </p>
      </div>
    </div>
  )
}