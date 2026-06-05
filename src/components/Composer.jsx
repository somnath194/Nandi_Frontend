/**
 * Composer.jsx
 *
 * Input bar with:
 *   - Text area (auto-growing, Enter to send, Shift+Enter for newline)
 *   - Attach button → triggers Attachment.jsx file picker
 *   - Attachment chip strip (via Attachment component)
 *   - Drag & drop onto entire composer
 *   - Send button (disabled while any file is still uploading)
 */

import React, { useRef, useState, useCallback } from "react"
import Attachment from "./Attachment.jsx"

export default function Composer({ onSend, inputRef }) {
  const [text, setText]                         = useState("")
  const [readyAttachments, setReadyAttachments] = useState([])
  const [isUploading, setIsUploading]           = useState(false)
  const attRef                                  = useRef(null)

  // ── Attachment state callback ─────────────────────────────────────────────
  const handleAttachmentChange = useCallback((ready, uploading) => {
    setReadyAttachments(ready)
    setIsUploading(uploading)
  }, [])

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const trimmed = text.trim()

    // Block while uploads are in progress
    if (isUploading) return

    // Need at least text OR at least one attached file
    if (!trimmed && readyAttachments.length === 0) return

    onSend(trimmed, readyAttachments)

    // Reset
    setText("")
    attRef.current?.clear()
  }, [text, readyAttachments, isUploading, onSend])

  // ── Keyboard: Enter = send, Shift+Enter = newline ─────────────────────────
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  // ── Auto-grow textarea ────────────────────────────────────────────────────
  const handleChange = useCallback((e) => {
    setText(e.target.value)
    // Shrink to auto first, then expand to fit content (max 180 px)
    e.target.style.height = "auto"
    e.target.style.height = Math.min(e.target.scrollHeight, 180) + "px"
  }, [])

  const canSend = !isUploading && (text.trim() || readyAttachments.length > 0)

  return (
    <div className="composer">
      {/*
        Attachment handles:
          - drag & drop zone (entire component acts as a drop target)
          - file input (hidden)
          - chip strip display
          - upload logic
      */}
      <Attachment ref={attRef} onChange={handleAttachmentChange} />

      {/* ── Bottom input bar ── */}
      <div className="composer__bar">

        {/* Attach button — delegates click to Attachment's hidden input */}
        <button
          className="composer__attach-btn"
          type="button"
          title="Attach files (or drag & drop)"
          onClick={() => attRef.current?.triggerSelect()}
        >
          <PaperclipIcon />
          <span>Attach</span>
        </button>

        {/* Text area */}
        <textarea
          ref={inputRef}
          className="composer__textarea"
          placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
          value={text}
          rows={1}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />

        {/* Drop-files hint (clickable shortcut, hidden on mobile via CSS) */}
        <span
          className="composer__drop-hint"
          onClick={() => attRef.current?.triggerSelect()}
          title="Click to attach or drag files anywhere"
        >
          Drop files
        </span>

        {/* Send button */}
        <button
          className={`composer__send-btn${canSend ? "" : " composer__send-btn--disabled"}`}
          type="button"
          disabled={!canSend}
          onClick={handleSend}
          title={
            isUploading
              ? "Waiting for uploads to finish…"
              : canSend
              ? "Send message"
              : "Type a message or attach a file"
          }
        >
          {isUploading ? (
            <>
              <span className="composer__spinner" />
              <span>Uploading…</span>
            </>
          ) : (
            <>
              Send
              <ArrowIcon />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Inline SVG icons (no icon library dep) ───────────────────────────────────

function PaperclipIcon() {
  return (
    <svg
      width="16" height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg
      width="13" height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}