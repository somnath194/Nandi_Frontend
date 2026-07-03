import React, { useEffect, useRef, useState } from 'react'
import { openWithFallback } from '../../nandi-connection-fixes/src/lib/wsFallback.js'

// Domain first, localhost fallback. Probed by opening the WS (no /health fetch),
// so it works even without CORS and auto-skips ws://localhost on HTTPS deploys.
const LOG_URLS = [
  'wss://api.shuun.site/ws/logs',
  'ws://localhost:8000/ws/logs',
]

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
  const preferIdxRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    let reconnectTimer = null

    async function connect() {
      if (cancelled) return

      let resolved
      try {
        resolved = await openWithFallback({
          urls: LOG_URLS,
          startIndex: preferIdxRef.current,
          timeout: 3000,
        })
      } catch {
        if (cancelled) return
        setConnected(false)
        reconnectTimer = setTimeout(connect, 4000)
        return
      }

      if (cancelled) { try { resolved.socket.close() } catch {}; return }

      preferIdxRef.current = resolved.index
      const socket = resolved.socket
      wsRef.current = socket

      socket.onmessage = (event) => {
        if (cancelled || wsRef.current !== socket) return
        let data
        try { data = JSON.parse(event.data) } catch { return }

        if (data.status === 'authenticated') {
          setConnected(true)
          return
        }
        if (data.error) return

        const msg = data.log || data.message || JSON.stringify(data)
        const ts = new Date().toLocaleTimeString('en-GB', { hour12: false })
        setLogs(prev => [...prev.slice(-200), {
          id: Date.now() + Math.random(),
          msg, ts, type: classifyLog(msg),
        }])
      }

      socket.onerror = () => {}
      socket.onclose = () => {
        if (cancelled || wsRef.current !== socket) return
        setConnected(false)
        wsRef.current = null
        reconnectTimer = setTimeout(connect, 4000)
      }

      const token = getToken()
      if (token) socket.send(JSON.stringify({ type: 'auth', token }))
      else setConnected(true)   // no auth needed — mark live so the dot is green
    }

    connect()
    return () => {
      cancelled = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (wsRef.current) { try { wsRef.current.close() } catch {} }
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
