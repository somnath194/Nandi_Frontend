const WS_URL = "wss://api.shuun.site/ws/chat"

let ws = null
let isConnected = false
let pendingQueue = []
let requestResolvers = []
let globalOnMessage = null // persistent UI callback

export async function chat(history, attachments, onMessage) {
  // store global callback so even future pushes (follow-ups, sensor data) show up
  if (onMessage) {
    globalOnMessage = onMessage
  }

  return new Promise((resolve, reject) => {
    try {
      const last = history.filter(m => m.role === "user").slice(-1)[0]
      const text = (last?.text || "").trim()

      if (!ws || ws.readyState === WebSocket.CLOSED) {
        ws = new WebSocket(WS_URL)

        ws.onopen = () => {
          isConnected = true
          console.log("✅ WebSocket connected")
          for (const item of pendingQueue) ws.send(JSON.stringify(item))
          pendingQueue = []
        }

        ws.onmessage = (event) => {
          console.log("📩 Raw WS message:", event.data)
          const data = JSON.parse(event.data)

          // 🔹 Extract response text from new format (response field instead of conversation_output)
          const responseText = data.response || data.conversation_output
          
          // 🔹 Create normalized data object for UI with response_text property
          const normalizedData = {
            ...data,
            response_text: responseText
          }

          // 🔹 Always forward every message to UI
          if (globalOnMessage) {
            globalOnMessage(normalizedData)
          }

          // 🔹 Resolve only the *first* response for this chat call
          if (responseText && requestResolvers.length > 0) {
            const resolver = requestResolvers.shift()
            resolver(responseText)
          }
        }

        ws.onerror = (err) => {
          console.error("WS error:", err)
          reject("⚠️ WebSocket error")
        }

        ws.onclose = () => {
          isConnected = false
          console.log("⚠️ WebSocket closed")
        }
      }

      const payload = {
        query: text,
        session_id: "default",
      }

      requestResolvers.push(resolve)

      if (isConnected && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload))
      } else {
        pendingQueue.push(payload)
      }
    } catch (err) {
      reject("⚠️ Failed to send message")
    }
  })
}
