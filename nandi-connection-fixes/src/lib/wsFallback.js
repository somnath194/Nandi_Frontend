// ═══════════════════════════════════════════════════════════
//  wsFallback.js — open a WebSocket to the first URL that connects
//
//  Tries each URL in order (starting at startIndex, wrapping around),
//  giving each `timeout` ms to open. Resolves with the first socket that
//  opens, plus the index it came from. Rejects only if ALL fail.
//
//  Why this replaces fetch('/health') probing:
//   • No CORS dependency. A cross-origin fetch to /health (localhost:5173 →
//     localhost:8000, OR → api.shuun.site) is blocked unless the server sets
//     CORS headers, and a CORS-blocked fetch looks identical to a dead server.
//     A WebSocket upgrade is NOT gated by CORS, so this always reflects reality.
//   • It tests the exact thing we care about: can this WS actually open?
//   • Mixed-content rules auto-skip ws://localhost when the page is served over
//     https:// (e.g. Vercel), so the SAME url list works in dev and prod:
//        dev  (http://localhost:5173): can reach domain (wss) AND localhost (ws)
//        prod (https://*.vercel.app) : domain (wss) works, ws://localhost is
//                                       blocked and skipped automatically.
// ═══════════════════════════════════════════════════════════

export function openWithFallback({ urls, timeout = 3000, startIndex = 0 }) {
  return new Promise((resolve, reject) => {
    // Build the try-order: startIndex first, then the rest, wrapping around.
    const order = urls.map((_, i) => (startIndex + i) % urls.length)
    let step = 0

    function attempt() {
      if (step >= order.length) {
        reject(new Error('all endpoints unreachable'))
        return
      }

      const idx = order[step]
      const url = urls[idx]
      let done = false
      let sock

      try {
        sock = new WebSocket(url)
      } catch {
        // e.g. SecurityError: ws:// from an https:// page (mixed content)
        step++
        attempt()
        return
      }

      const timer = setTimeout(() => {
        if (done) return
        done = true
        try { sock.close() } catch {}
        step++
        attempt()
      }, timeout)

      sock.onopen = () => {
        if (done) { try { sock.close() } catch {}; return }
        done = true
        clearTimeout(timer)
        // Hand back an already-open socket. The caller attaches its own
        // onmessage/onclose in the resolving microtask, which runs before any
        // further message macrotask — so no inbound messages are missed.
        resolve({ socket: sock, index: idx })
      }

      // A failed/refused connection fires onerror then onclose.
      sock.onerror = () => {}
      sock.onclose = () => {
        if (done) return
        done = true
        clearTimeout(timer)
        step++
        attempt()
      }
    }

    attempt()
  })
}
