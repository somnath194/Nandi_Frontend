import React, { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble.jsx'

export default function ChatWindow({ messages }){
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if(!el) return

    const scrollToBottom = (smooth = true) => {
      try {
        el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
      } catch (e) {
        el.scrollTop = el.scrollHeight
      }
    }

    // Scroll when messages change and keep the chat container focused
    scrollToBottom(true)
    try { el.focus({ preventScroll: true }) } catch (e) { /* ignore */ }

    // Also ensure we stay scrolled on window resize/orientation changes
    const onResize = () => scrollToBottom(false)
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [messages])

  return (
    <div className="chat" ref={ref} tabIndex={0} aria-live="polite">
      {messages.map(m => <MessageBubble key={m.id} msg={m} />)}
    </div>
  )
}
