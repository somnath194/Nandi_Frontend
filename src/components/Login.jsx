import { useEffect } from "react"

const BACKEND_URL = "http://api.shuun.site/auth/google-login"

export default function Login({ onLogin }) {

  useEffect(() => {
    /* global google */

    window.google.accounts.id.initialize({
      client_id: "184131206976-5r95aqjt3iqbipahepchl0pj930fpn51.apps.googleusercontent.com",
      callback: handleCredentialResponse
    })

    window.google.accounts.id.renderButton(
      document.getElementById("googleBtn"),
      { theme: "outline", size: "large" }
    )

  }, [])

  async function handleCredentialResponse(response) {
    try {
      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          credential: response.credential
        })
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.detail || "Access denied")
        return
      }

      // ✅ Save YOUR JWT (not Google token)
      localStorage.setItem("user_token", data.access_token)

      onLogin()

    } catch (err) {
      console.error(err)
      alert("Login failed")
    }
  }

  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h2>Login to Continue</h2>
      <div id="googleBtn"></div>
    </div>
  )
}