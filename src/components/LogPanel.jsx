import React, { useEffect, useRef, useState } from "react"

const LogPanel = () => {
  const [logs, setLogs] = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const logsEndRef = useRef(null)
  const wsRef = useRef(null)

  useEffect(() => {
    const LOG_SERVER_URL = "wss://api.shuun.site/ws/logs" // Change if deployed remotely
    // const LOG_SERVER_URL = "ws://127.0.0.1:8001/ws/logs" // Local fallback

    console.log(`📡 Connecting to log server at ${LOG_SERVER_URL}...`)

    try {
      const ws = new WebSocket(LOG_SERVER_URL)
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        console.log("✅ Log server connected!")
      }

      ws.onmessage = (event) => {
        const message = event.data
        const timestamp = new Date().toLocaleTimeString()
        setLogs((prevLogs) => [...prevLogs, { id: Date.now(), message, timestamp }])
      }

      ws.onerror = (err) => {
        console.error("❌ Log server error:", err)
        setIsConnected(false)
      }

      ws.onclose = () => {
        console.log("⚠️ Log server connection closed")
        setIsConnected(false)
      }
    } catch (err) {
      console.error("🚫 Could not connect to log server:", err)
      setIsConnected(false)
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    // Don't force-scroll logs on small screens — keep mobile focus on chat
    const isMobile = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 900px)').matches
    if (isMobile) return
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs])

  const clearLogs = () => {
    setLogs([])
  }

  return (
    <div className="action-log">
      <div className="action-log__header">
        <span>
          📡 Logs <span style={{ color: isConnected ? '#10b981' : '#ef4444', marginLeft: 6 }}>{isConnected ? '● Connected' : '● Disconnected'}</span>
        </span>
        <button className="action-log__clear" onClick={clearLogs}>Clear</button>
      </div>

      <div className="action-log__body">
        {logs.length === 0 ? (
          <div className="action-log__empty">Waiting for logs...</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="action-log__line">
              <span className="action-log__ts">[{log.timestamp}]</span> <span className="action-log__msg">{log.message}</span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  )
}

export default LogPanel
