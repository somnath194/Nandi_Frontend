export function supportsRecognition() {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
}

let recog = null
let shouldRestart = true   // flag controls restart

export function startRecognition({ onResult, onError, interimCb }) {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!Rec) return
  if (recog) stopRecognition()
  recog = new Rec()
  recog.continuous = true
  recog.interimResults = true
  recog.lang = navigator.language || 'en-US'
  shouldRestart = true

  let interim = ''
  recog.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i]
      const txt = res[0].transcript
      if (res.isFinal) {
        onResult?.(txt.trim())
        interim = ''
      } else {
        interim = txt
        interimCb?.(interim)
      }
    }
  }

  recog.onerror = (e) => {
    console.warn("Speech recognition error:", e.error)

    if (e.error === "no-speech" || e.error === "aborted") {
      // ignore these, keep restarting
      return
    }

    // for real errors, still notify
    onError?.(e)
  }

  recog.onend = () => {
    if (shouldRestart) {
      try { recog.start() } catch {}
    }
  }

  try { recog.start() } catch (e) { onError?.(e) }
}

export function stopRecognition() {
  if (recog) {
    shouldRestart = false
    try { recog.onend = null; recog.stop() } catch {}
    recog = null
  }
}

export function listVoices() {
  return window.speechSynthesis ? window.speechSynthesis.getVoices() : []
}

export function speak(text, { voiceName = '', rate = 1, pitch = 1 } = {}) {
  if (!window.speechSynthesis) return
  const u = new SpeechSynthesisUtterance(text)
  if (voiceName) {
    const v = listVoices().find(v => v.name === voiceName)
    if (v) u.voice = v
  }
  u.rate = rate
  u.pitch = pitch
  window.speechSynthesis.speak(u)
}
