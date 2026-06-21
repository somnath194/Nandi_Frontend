import { useEffect } from 'react'

const BACKEND_URL = 'https://api.shuun.site/auth/google-login'
const GOOGLE_CLIENT_ID = '184131206976-5r95aqjt3iqbipahepchl0pj930fpn51.apps.googleusercontent.com'

export default function Login({ onLogin }) {
  useEffect(() => {
    if (!window.google?.accounts?.id) {
      console.warn('Google Identity Services not loaded yet')
      return
    }

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredential,
    })

    window.google.accounts.id.renderButton(
      document.getElementById('g-signin-btn'),
      { theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with' }
    )
  }, [])

  async function handleCredential(response) {
    try {
      const res = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.detail || 'Access denied')
        return
      }

      localStorage.setItem('user_token', data.access_token)
      onLogin()
    } catch (err) {
      console.error('Login failed:', err)
      alert('Login failed — check your connection')
    }
  }

  return (
    <div className="login-page">
      <img src="/logo.png" alt="Nandi AI" className="login-page__logo" />
      <h1 className="login-page__title">NANDI AI</h1>
      <p className="login-page__subtitle">Your Personal AI Assistant</p>
      <div className="login-page__btn-wrap" id="g-signin-btn" />
    </div>
  )
}
