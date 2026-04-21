import React, { useEffect, useRef, useState } from "react"

const LOG_SERVERS = [
  "ws://localhost:8001/ws/logs",
  "wss://api2.shuun.site/ws/logs"
]

const HEALTH_URLS = [
  "http://localhost:8001/health",
  "https://api2.shuun.site/health"
]

async function pickHealthyServer() {
  for (let i = 0; i < HEALTH_URLS.length; i++) {
    try {
      const res = await fetch(HEALTH_URLS[i], { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        console.log(`✅ Log health OK: ${HEALTH_URLS[i]}`)
        return i
      }
    } catch {
      console.warn(`⚠️ Log health failed: ${HEALTH_URLS[i]}`)
    }
  }
  return 0
}

function getUserToken() {
  return localStorage.getItem("user_token")
}

const LogPanel = () => {
  const [logs, setLogs] = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const [activeServer, setActiveServer] = useState(null)  // shows which server is live
  const logsEndRef = useRef(null)
  const wsRef = useRef(null)

  useEffect(() => {
    let cancelled = false   // prevent state updates after unmount

    async function connect() {
      const serverIndex = await pickHealthyServer()
      if (cancelled) return

      const url = LOG_SERVERS[serverIndex]
      console.log(`📡 Connecting to log server: ${url}`)

      try {
        if (wsRef.current) {
          try { wsRef.current.close() } catch {}
        }

        const ws = new WebSocket(url)
        wsRef.current = ws

        ws.onopen = () => {
          if (cancelled) return

          console.log(`✅ Log server connected: ${url}`)

          const token = getUserToken()

          if (!token) {
            console.warn("⚠️ No JWT token found")
            return
          }

          // 🔐 STEP 1: Send auth
          ws.send(JSON.stringify({
            type: "auth",
            token: token
          }))

          console.log("🔐 Sent JWT for logs authentication")
        }

        ws.onmessage = (event) => {
          if (cancelled) return

          const data = JSON.parse(event.data)

          // 🔐 Step 2: Auth success
          if (data.status === "authenticated") {
            setIsConnected(true)
            setActiveServer(serverIndex === 0 ? "Primary" : "Backup")
            console.log("✅ Logs authenticated")
            return
          }

          // 🔒 Token expired / invalid
          if (data.error === "Invalid or expired token" || data.error === "Not authenticated") {
            console.warn("🔒 Log token issue — cannot auto refresh here")
            return
          }

          // 📩 Normal log message
          const timestamp = new Date().toLocaleTimeString()
          setLogs(prev => [...prev, {
            id: Date.now(),
            message: data.log,   // logs are plain text usually
            timestamp
          }])
        }

        ws.onerror = (err) => {
          console.error("❌ Log server error:", err)
          setIsConnected(false)
        }

        ws.onclose = () => {
          if (cancelled) return
          console.log(`⚠️ Log server closed: ${url}`)
          setIsConnected(false)
          setActiveServer(null)

          // Auto-retry after 4s — will re-run health check and pick best server
          setTimeout(() => { if (!cancelled) connect() }, 4000)
        }

      } catch (err) {
        console.error("🚫 Could not connect to log server:", err)
        setIsConnected(false)
        setTimeout(() => { if (!cancelled) connect() }, 4000)
      }
    }

    connect()

    return () => {
      cancelled = true
      if (wsRef.current) {
        try { wsRef.current.close() } catch {}
      }
    }
  }, [])

  useEffect(() => {
    const isMobile = typeof window !== "undefined" &&
      window.matchMedia?.("(max-width: 900px)").matches
    if (isMobile) return
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs])

  const clearLogs = () => setLogs([])

  return (
    <div className="action-log">
      <div className="action-log__header">
        <span>
          📡 Logs{" "}
          <span style={{ color: isConnected ? "#10b981" : "#ef4444", marginLeft: 6 }}>
            {isConnected ? `● Connected` : "● Disconnected"}
          </span>
          {activeServer && (
            <span style={{ color: "#6b7280", fontSize: "0.7rem", marginLeft: 6 }}>
              ({activeServer})
            </span>
          )}
        </span>
        <button className="action-log__clear" onClick={clearLogs}>Clear</button>
      </div>

      <div className="action-log__body">
        {logs.length === 0 ? (
          <div className="action-log__empty">Waiting for logs...</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="action-log__line">
              <span className="action-log__ts">[{log.timestamp}]</span>{" "}
              <span className="action-log__msg">{log.message}</span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  )
}

export default LogPanel