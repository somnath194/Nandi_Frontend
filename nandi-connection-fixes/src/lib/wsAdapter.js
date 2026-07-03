// ═══════════════════════════════════════════════════════════
//  wsAdapter.js  –  WebSocket chat + REST upload for Nandi
//
//  Connection strategy: try the public domain first, fall back to localhost
//  automatically — by PROBING with a real WS open (see wsFallback.js), NOT a
//  /health fetch. The REST base URL (uploads/stt/tts) is derived from whichever
//  WS actually connected, so REST calls hit the same live server.
//
//  Hardened against React StrictMode double-mount and stale-socket reconnect
//  cascades: every handler checks it still owns the current socket.
// ═══════════════════════════════════════════════════════════

import { openWithFallback } from './wsFallback.js'

const WS_URLS = [
  'wss://api.shuun.site/ws/chat',
  'ws://localhost:8000/ws/chat',
]

// Index-aligned with WS_URLS — same server, HTTP scheme for REST calls.
const BASE_URLS = [
  'https://api.shuun.site',
  'http://localhost:8000',
]

const CLIENT_ID = 'nandi_web'

let ws = null
let isConnected = false
let pendingQueue = []
let activeServerIndex = 0
let messageCallback = null
let connectionCallback = null
let connecting = false
let reconnectTimer = null

function getToken() {
  return localStorage.getItem('user_token')
}

export function getBaseUrl() {
  return BASE_URLS[activeServerIndex]
}

export function getConnectionState() {
  return isConnected
}

export function onConnectionChange(cb) { connectionCallback = cb }
export function onMessage(cb) { messageCallback = cb }

function setConnected(val) {
  isConnected = val
  connectionCallback?.(val)
}

function scheduleReconnect() {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    ensureConnection()
  }, 4000)
}

function flushQueue(socket) {
  if (ws !== socket || ws.readyState !== WebSocket.OPEN) return
  for (const item of pendingQueue) ws.send(JSON.stringify(item))
  pendingQueue = []
}

export async function ensureConnection() {
  // Idempotent: already open / connecting, or a probe is in flight → no-op.
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return
  if (connecting) return
  connecting = true

  try {
    const { socket, index } = await openWithFallback({
      urls: WS_URLS,
      startIndex: activeServerIndex,   // prefer last-working endpoint on reconnect
      timeout: 3000,
    })

    activeServerIndex = index
    ws = socket
    console.log(`[ws] connected → ${WS_URLS[index]}`)

    let flushed = false

    ws.onmessage = (event) => {
      if (ws !== socket) return
      let data
      try { data = JSON.parse(event.data) } catch { return }

      if (data.status === 'authenticated') {
        console.log('[ws] authenticated')
        setConnected(true)
        if (!flushed) { flushed = true; flushQueue(socket) }
        return
      }

      if (data.error === 'Invalid or expired token' || data.error === 'Not authenticated') {
        console.warn('[ws] token issue, re-sending auth')
        const token = getToken()
        if (token) ws.send(JSON.stringify({ type: 'auth', token }))
        return
      }

      const responseText = data.response || data.conversation_output || ''
      messageCallback?.({ ...data, response_text: responseText })
    }

    ws.onerror = () => { /* onclose handles the retry */ }

    ws.onclose = (ev) => {
      if (ws !== socket) return   // superseded socket — ignore its close
      setConnected(false)
      ws = null
      console.log(`[ws] closed (code=${ev.code} reason=${ev.reason || 'none'}), reconnecting…`)
      scheduleReconnect()
    }

    // Send auth now that onmessage is wired up.
    const token = getToken()
    if (token) {
      ws.send(JSON.stringify({ type: 'auth', token }))
      console.log('[ws] auth sent')
    } else {
      console.warn('[ws] no token — flushing without auth')
      setConnected(true)
      flushed = true
      flushQueue(socket)
    }

    // Fallback flush in case the server accepts without an explicit
    // 'authenticated' reply (keeps queued messages from getting stuck).
    setTimeout(() => { if (!flushed) { flushed = true; flushQueue(socket) } }, 1500)

  } catch (err) {
    console.warn('[ws] all endpoints unreachable, retrying in 4s')
    ws = null
    scheduleReconnect()
  } finally {
    connecting = false
  }
}

export function sendMessage(text, attachments = []) {
  const payload = { query: text, client_id: CLIENT_ID, attachments }
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload))
  } else {
    pendingQueue.push(payload)
    ensureConnection()
  }
}

export async function uploadFile(file) {
  const token = getToken()
  if (!token) throw new Error('Not authenticated')

  // Make sure we've resolved which endpoint is alive before choosing baseUrl.
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    await ensureConnection()
  }

  const baseUrl = BASE_URLS[activeServerIndex]
  const form = new FormData()
  form.append('file', file)

  const res = await fetch(`${baseUrl}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })

  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    throw new Error(`Upload failed (${res.status}): ${msg}`)
  }

  const json = await res.json()
  return {
    file_id: json.file_id,
    filename: json.filename,
    content_type: json.content_type,
  }
}

export function disconnect() {
  if (ws) {
    const sock = ws
    ws = null            // mark superseded so its handlers no-op
    try { sock.close() } catch {}
  }
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  setConnected(false)
}
