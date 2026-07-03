// ═══════════════════════════════════════════════════════════
//  visionControl.js  –  WebSocket to brain server for vision commands
//
//  Vision agent → brain server → this WebSocket → browser action.
//  The browser identifies itself with a client_id (e.g. web_react_pc).
//
//  Connection: domain first, localhost fallback — probed by opening the WS
//  (see wsFallback.js), so it falls back correctly even when /health is
//  CORS-blocked or the tunnel is down.
//
//  Hardened against React StrictMode double-mount and stale-socket cascades.
// ═══════════════════════════════════════════════════════════

import { openWithFallback } from './wsFallback.js'

const VISION_CTRL_URLS = [
  'wss://api.shuun.site/ws/vision-control',
  'ws://localhost:8000/ws/vision-control',
]

let ws = null
let connected = false
let commandHandler = null
let preferIndex = 0
let reconnectTimer = null
let connecting = false

function getToken() {
  return localStorage.getItem('user_token')
}

function getClientId() {
  // client_id format: web_react_<deviceName>
  const match = document.cookie.match(/(?:^|;\s*)nandi_device_id=([^;]+)/)
  const device = match ? decodeURIComponent(match[1]) : 'unknown'
  return `web_react_${device}`
}

export function getMyClientId() {
  return getClientId()
}

export function onVisionCommand(handler) {
  commandHandler = handler
}

function scheduleReconnect() {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connect()
  }, 4000)
}

async function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return
  if (connecting) return
  connecting = true

  try {
    const { socket, index } = await openWithFallback({
      urls: VISION_CTRL_URLS,
      startIndex: preferIndex,
      timeout: 3000,
    })

    preferIndex = index
    ws = socket
    console.log(`[vision-ctrl] connected → ${VISION_CTRL_URLS[index]}`)

    socket.onmessage = (event) => {
      if (ws !== socket) return
      let msg
      try { msg = JSON.parse(event.data) } catch { return }

      if (msg.type === 'registered') {
        connected = true
        console.log(`[vision-ctrl] registered as ${msg.client_id}`)
        return
      }
      if (msg.error) {
        console.warn('[vision-ctrl] error:', msg.error)
        return
      }

      // Vision commands from the agent:
      //   { action: 'show_frame',  image_b64, label, wid }
      //   { action: 'show_stream', stream_id, label, wid }
      //   { action: 'close',       wid }
      //   { action: 'close_all' }
      if (msg.action && commandHandler) commandHandler(msg)
    }

    socket.onerror = () => {}
    socket.onclose = () => {
      if (ws !== socket) return   // superseded — ignore
      connected = false
      ws = null
      console.warn('[vision-ctrl] closed, will retry')
      scheduleReconnect()
    }

    // Register now that onmessage is wired up.
    socket.send(JSON.stringify({
      type: 'register',
      client_id: getClientId(),
      token: getToken(),
    }))

  } catch {
    console.warn('[vision-ctrl] all endpoints unreachable, retry in 4s')
    ws = null
    scheduleReconnect()
  } finally {
    connecting = false
  }
}

export function startVisionControl() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return
  connect()
}

export function isVisionControlConnected() {
  return connected
}

export function disconnect() {
  if (ws) {
    const sock = ws
    ws = null            // mark superseded so handlers no-op
    try { sock.close() } catch {}
  }
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  connected = false
}
