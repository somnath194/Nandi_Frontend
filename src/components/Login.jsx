import { useEffect } from 'react'

// Login POSTs here. Domain first, localhost fallback.
//
// Note: localhost:8000 and api.shuun.site are the SAME server (the tunnel just
// forwards to localhost:8000), so the JWT is signed by the same secret and is
// valid whichever path we use. The fallback is only about which network path is
// reachable.
//
// We fall back ONLY on network / gateway failures (fetch throws, or the proxy
// returns 502/503/504). We never fall back on a real rejection like a 401
// "access denied" — that's a genuine answer from the backend, not a dead path.
const LOGIN_URLS = [
  'https://api.shuun.site/auth/google-login',
  'http://localhost:8000/auth/google-login',
]

const GOOGLE_CLIENT_ID = '184131206976-5r95aqjt3iqbipahepchl0pj930fpn51.apps.googleusercontent.com'

async function loginWithFallback(credential) {
  let lastErr = null

  for (const url of LOGIN_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
        signal: AbortSignal.timeout(6000),
      })

      // Reached a proxy but the backend behind it is down → try the next path.
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        lastErr = new Error(`gateway ${res.status} from ${url}`)
        continue
      }

      // Reached the real backend (200, or a genuine 4xx such as access denied).
      // Return it as-is — a real rejection should NOT trigger a fallback.
      return res
    } catch (err) {
      // Network error / CORS / timeout / mixed-content (ws:// blocked on https)
      // → this path is unreachable, try the next one.
      console.warn(`[login] ${url} unreachable: ${err.message}`)
      lastErr = err
    }
  }

  throw lastErr || new Error('all login endpoints unreachable')
}

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
      const res = await loginWithFallback(response.credential)
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