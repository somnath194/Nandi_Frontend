import React, { useEffect, useRef, useState } from 'react'

const LOG_SERVERS = [
  'wss://api.shuun.site/ws/logs',
  'ws://localhost:8000/ws/logs',
]

const HEALTH_URLS = [
  'https://api.shuun.site/health',
  'http://localhost:8000/health',
]

async function pickHealthyServer() {
  for (let i = 0; i < HEALTH_URLS.length; i++) {
    try {
      const res = await fetch(HEALTH_URLS[i], { signal: AbortSignal.timeout(3000) })
      if (res.ok) return i
    } catch { /* skip */ }
  }
  return 0
}

function getToken() {
  return localStorage.getItem('user_token')
}

function classifyLog(msg) {
  if (!msg) return 'info'
  const lower = msg.toLowerCase()
  if (lower.includes('error') || lower.includes('failed') || lower.includes('❌')) return 'error'
  if (lower.includes('warn') || lower.includes('⚠️')) return 'warn'
  if (lower.includes('route') || lower.includes('→') || lower.includes('selected')) return 'step'
  return 'info'
}

export default function LogPanel() {
  const [logs, setLogs] = useState([])
  const [connected, setConnected] = useState(false)
  const endRef = useRef(null)
  const wsRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function connect() {
      const idx = await pickHealthyServer()
      if (cancelled) return

      const url = LOG_SERVERS[idx]

      if (wsRef.current) {
        try { wsRef.current.close() } catch {}
      }

      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        if (cancelled) return
        const token = getToken()
        if (token) ws.send(JSON.stringify({ type: 'auth', token }))
      }

      ws.onmessage = (event) => {
        if (cancelled) return
        let data
        try { data = JSON.parse(event.data) } catch { return }

        if (data.status === 'authenticated') {
          setConnected(true)
          return
        }

        if (data.error) return

        const msg = data.log || data.message || JSON.stringify(data)
        const ts = new Date().toLocaleTimeString('en-GB', { hour12: false })

        setLogs(prev => [...prev.slice(-200), {   // keep last 200
          id: Date.now() + Math.random(),
          msg,
          ts,
          type: classifyLog(msg),
        }])
      }

      ws.onerror = () => setConnected(false)
      ws.onclose = () => {
        if (cancelled) return
        setConnected(false)
        setTimeout(() => { if (!cancelled) connect() }, 4000)
      }
    }

    connect()
    return () => {
      cancelled = true
      if (wsRef.current) try { wsRef.current.close() } catch {}
    }
  }, [])

  // Auto-scroll (desktop only)
  useEffect(() => {
    if (window.innerWidth > 900) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  return (
    <>
      <div className="log-sidebar__header">
        <span className="log-sidebar__title">
          <span className={`log-sidebar__indicator${connected ? '' : ' log-sidebar__indicator--off'}`} />
          Activity
        </span>
        <button className="log-sidebar__clear" onClick={() => setLogs([])}>Clear</button>
      </div>

      <div className="log-sidebar__body">
        {logs.length === 0 ? (
          <div className="log-sidebar__empty">Waiting for activity…</div>
        ) : (
          logs.map(log => (
            <div key={log.id} className={`log-entry log-entry--${log.type}`}>
              <span className="log-entry__ts">{log.ts}</span>
              <span className="log-entry__msg">{log.msg}</span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </>
  )
}
