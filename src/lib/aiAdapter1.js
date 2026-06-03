// ai adapter with automatic fallback between primary and backup servers
const SERVERS = [
  "wss://api.shuun.site/ws/chat",
  "ws://localhost:8001/ws/chat"
]

const HEALTH_URLS = [
  "https://api.shuun.site/health",
  "http://localhost:8001/health"
]

const CLIENT_ID = "react_web"

let ws = null
let isConnected = false
let pendingQueue = []
let requestResolvers = []
let globalOnMessage = null
let activeServerIndex = 0   // tracks which server is currently in use

// ── Health check: returns index of first healthy server ──────────────────────
async function pickHealthyServer() {
  for (let i = 0; i < HEALTH_URLS.length; i++) {
    try {
      const res = await fetch(HEALTH_URLS[i], { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        console.log(`✅ Health OK: ${HEALTH_URLS[i]}`)
        return i
      }
    } catch {
      console.warn(`⚠️ Health failed: ${HEALTH_URLS[i]}`)
    }
  }
  return 0   // fallback to primary even if both fail; WS error will surface it
}

function getUserToken() {
  return localStorage.getItem("user_token")
}

// ── Connect to a specific server index ───────────────────────────────────────
function connectWS(serverIndex, onOpen) {
  if (ws) {
    try { ws.close() } catch {}
    ws = null
    isConnected = false
  }

  const url = SERVERS[serverIndex]
  console.log(`🔌 Connecting to: ${url}`)
  ws = new WebSocket(url)

  ws.onopen = () => {
  isConnected = true
  activeServerIndex = serverIndex
  console.log(`✅ WebSocket connected: ${url}`)

  // 🔐 STEP 1: Send JWT FIRST
  const token = getUserToken()

  if (token) {
    ws.send(JSON.stringify({
      type: "auth",
      token: token
    }))
    console.log("🔐 JWT sent for authentication")
  } else {
    console.warn("⚠️ No user token found")
  }

  // ⏳ STEP 2: Delay sending messages (IMPORTANT)
  setTimeout(() => {
    for (const item of pendingQueue) {
      ws.send(JSON.stringify(item))
    }
    pendingQueue = []
  }, 100)

  if (onOpen) onOpen()
  }

  ws.onmessage = (event) => {
  console.log("📩 Raw WS message:", event.data)

  const data = JSON.parse(event.data)

  // 🔐 Auth success
  if (data.status === "authenticated") {
    console.log("✅ WebSocket authenticated")
    return
  }

  // 🔒 Token expired → re-auth
  if (data.error === "Invalid or expired token" || data.error === "Not authenticated") {
    console.warn("🔒 Token issue, re-authenticating...")

    const token = getUserToken()

    ws.send(JSON.stringify({
      type: "auth",
      token: token
    }))
    return
  }

  const responseText = data.response || data.conversation_output
  const normalizedData = { ...data, response_text: responseText }

  if (globalOnMessage) globalOnMessage(normalizedData)

  if (responseText && requestResolvers.length > 0) {
    const resolver = requestResolvers.shift()
    resolver(responseText)
  }
  }

  ws.onerror = (err) => {
    console.error("WS error:", err)
  }

  ws.onclose = () => {
    isConnected = false
    console.log(`⚠️ WebSocket closed: ${url}`)
  }
}

// ── Main exported function ────────────────────────────────────────────────────
export async function chat(history, attachments, onMessage) {
  if (onMessage) globalOnMessage = onMessage

  return new Promise(async (resolve, reject) => {
    try {
      const last = history.filter(m => m.role === "user").slice(-1)[0]
      const text = (last?.text || "").trim()

      const payload = { query: text, client_id: CLIENT_ID, attachments: [] }
      requestResolvers.push(resolve)

      // If already connected and open — just send
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload))
        return
      }

      // Otherwise: health-check to pick the best server, then connect
      const serverIndex = await pickHealthyServer()

      connectWS(serverIndex, () => {
        // onOpen fires after connection — send the queued payload
        // (connectWS already flushes pendingQueue on open)
      })

      // Queue payload to be sent once socket opens
      pendingQueue.push(payload)

    } catch (err) {
      console.error(err)
      reject("⚠️ Failed to send message")
    }
  })
}