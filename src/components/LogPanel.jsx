import React, { useEffect, useRef, useState } from "react"

const LogPanel = () => {
  const [logs, setLogs] = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const logsEndRef = useRef(null)
  const wsRef = useRef(null)

  useEffect(() => {
    const LOG_SERVER_URL = "ws://api.shuun.site/ws/logs" // Change if deployed remotely
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
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs])

  const clearLogs = () => {
    setLogs([])
  }

  return (
    <div
      style={{
        marginTop: "10px",
        marginRight: "16px",
        width: "600px",
        flex: 1,
        minHeight: 0,
        maxHeight: "calc(100% - 10px)",
        border: "2px solid #333",
        borderRadius: "8px",
        backgroundColor: "#111",
        color: "#0f0",
        padding: "12px",
        overflowY: "auto",
        overflowX: "hidden",
        fontFamily: "monospace",
        fontSize: "13px",
        lineHeight: "1.6",
        boxShadow: "inset 0 0 10px rgba(0, 255, 0, 0.1)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "10px",
          paddingBottom: "10px",
          borderBottom: "1px solid rgba(0, 255, 0, 0.3)",
          fontSize: "13px",
          fontWeight: "bold",
          flexShrink: 0,
        }}
      >
        <span>
          📡 Logs{" "}
          <span
            style={{
              color: isConnected ? "#10b981" : "#ef4444",
              marginLeft: "4px",
            }}
          >
            {isConnected ? "● Connected" : "● Disconnected"}
          </span>
        </span>
        <button
          onClick={clearLogs}
          style={{
            background: "rgba(0, 255, 0, 0.1)",
            border: "1px solid rgba(0, 255, 0, 0.3)",
            color: "#0f0",
            padding: "6px 12px",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
            transition: "all 0.2s ease",
            fontWeight: "500",
          }}
          onMouseEnter={(e) => {
            e.target.style.background = "rgba(0, 255, 0, 0.2)"
          }}
          onMouseLeave={(e) => {
            e.target.style.background = "rgba(0, 255, 0, 0.1)"
          }}
        >
          Clear
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {logs.length === 0 ? (
          <div style={{ color: "#666", fontStyle: "italic", marginTop: "40px", textAlign: "center" }}>
            Waiting for logs...
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} style={{ marginBottom: "6px", wordBreak: "break-word" }}>
              <span style={{ color: "#888" }}>[{log.timestamp}]</span>{" "}
              <span style={{ color: "#0f0" }}>{log.message}</span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  )
}

export default LogPanel
