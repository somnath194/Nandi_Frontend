/**
 * Attachment.jsx  –  v2 (fixes)
 *
 * CHANGES FROM v1:
 * 1. ✅ Fixed React warning "Cannot update a component while rendering another"
 *       → Removed notify() calls inside setItems() callbacks
 *       → Parent is now notified via useEffect that watches [items]
 * 2. ✅ Added file.size to every item so message bubbles can show "12 KB" not "NaN KB"
 * 3. ✅ clear() no longer needs to call onChange manually — useEffect handles it
 */

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react"
import { uploadFile } from "../lib/aiAdapter.js"

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _counter = 0
const nextId = () => `att_${++_counter}`

function truncate(str, n = 22) {
  return str.length > n ? str.slice(0, n - 1) + "…" : str
}

function fileIcon(type = "") {
  if (type.startsWith("image/"))                              return "🖼️"
  if (type.startsWith("video/"))                              return "🎥"
  if (type.startsWith("audio/"))                              return "🎵"
  if (type.includes("pdf"))                                   return "📄"
  if (type.includes("zip") || type.includes("tar"))           return "🗜️"
  if (
    type.includes("text") || type.includes("json") ||
    type.includes("javascript") || type.includes("python") ||
    type.includes("xml")
  )                                                            return "📝"
  return "📎"
}

// ─── FileChip ─────────────────────────────────────────────────────────────────

function FileChip({ item, onRemove }) {
  const isImg = item.content_type?.startsWith("image/")

  return (
    <div className={`att-chip att-chip--${item.status}`} title={item.filename}>

      {/* Thumbnail or icon */}
      <div className="att-chip__thumb">
        {isImg && item.preview
          ? <img src={item.preview} alt="" />
          : <span className="att-chip__icon">{fileIcon(item.content_type)}</span>
        }
        {item.status === "uploading" && (
          <div className="att-chip__spinner-overlay">
            <span className="att-chip__spinner" />
          </div>
        )}
      </div>

      {/* Name + progress / status */}
      <div className="att-chip__body">
        <span className="att-chip__name">{truncate(item.filename)}</span>

        {item.status === "uploading" && (
          <div className="att-chip__progress-bar">
            <div className="att-chip__progress-fill" style={{ width: `${item.progress}%` }} />
          </div>
        )}
        {item.status === "done" && (
          <span className="att-chip__status att-chip__status--ok">✓ Ready</span>
        )}
        {item.status === "error" && (
          <span className="att-chip__status att-chip__status--err">✕ Failed</span>
        )}
      </div>

      {/* Remove — disabled while uploading */}
      <button
        className="att-chip__rm"
        type="button"
        aria-label="Remove"
        disabled={item.status === "uploading"}
        onClick={() => onRemove(item.id)}
      >
        ✕
      </button>
    </div>
  )
}

// ─── Attachment ───────────────────────────────────────────────────────────────

/**
 * Props
 *   onChange(readyAttachments, isUploading)
 *     readyAttachments: [{ file_id, filename, content_type, size }, ...]
 *     isUploading: boolean
 *
 * Ref methods
 *   triggerSelect()   open file picker
 *   clear()           remove all attachments
 */
const Attachment = forwardRef(function Attachment({ onChange }, ref) {
  const [items, setItems]           = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef                = useRef(null)
  const dragCount                   = useRef(0)

  // ── ✅ FIX 1: Notify parent via useEffect, NOT inside setItems callbacks ──
  // Calling onChange inside setItems() → setState of parent during child render → React warning
  // useEffect fires after the render is committed, which is the correct time
  useEffect(() => {
    if (!onChange) return
    const ready = items
      .filter(f => f.status === "done")
      .map(({ file_id, filename, content_type, size }) => ({
        file_id,
        filename,
        content_type,
        size,             // ✅ FIX 2: include size so message bubbles show "X KB" not "NaN KB"
      }))
    const uploading = items.some(f => f.status === "uploading")
    onChange(ready, uploading)
  }, [items, onChange])

  // ── Expose imperative API ─────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    triggerSelect: () => fileInputRef.current?.click(),
    clear: () => {
      setItems(prev => {
        prev.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview) })
        return []
      })
      // ✅ No need to call onChange here — the useEffect above will fire
      //    when items becomes [] and will call onChange([], false) automatically
    },
  }))

  // ── Upload one item (NO notify calls — useEffect handles parent notification) ─
  const uploadItem = useCallback(async (id, file) => {
    const timer = setInterval(() => {
      setItems(prev => prev.map(f =>
        f.id === id && f.status === "uploading"
          ? { ...f, progress: Math.min(f.progress + 10, 80) }
          : f
      ))
    }, 300)

    try {
      const result = await uploadFile(file)
      clearInterval(timer)
      setItems(prev => prev.map(f =>
        f.id === id
          ? { ...f, status: "done", progress: 100, file_id: result.file_id }
          : f
      ))
    } catch (err) {
      clearInterval(timer)
      console.error(`[Attachment] upload failed for "${file.name}":`, err)
      setItems(prev => prev.map(f =>
        f.id === id ? { ...f, status: "error", progress: 0 } : f
      ))
    }
  }, [])

  // ── Add new files ─────────────────────────────────────────────────────────
  const addFiles = useCallback((fileList) => {
    const newItems = Array.from(fileList).map(file => ({
      id:           nextId(),
      file,
      filename:     file.name,
      size:         file.size,   // ✅ FIX 2: capture size from File object before upload
      content_type: file.type || "application/octet-stream",
      status:       "uploading",
      progress:     0,
      preview:      file.type.startsWith("image/")
                      ? URL.createObjectURL(file)
                      : null,
      file_id:      null,
    }))

    setItems(prev => [...prev, ...newItems])           // trigger: useEffect notifies parent
    newItems.forEach(item => uploadItem(item.id, item.file))
  }, [uploadItem])

  // ── Remove a file ─────────────────────────────────────────────────────────
  const removeFile = useCallback((id) => {
    setItems(prev => {
      const target = prev.find(f => f.id === id)
      if (target?.preview) URL.revokeObjectURL(target.preview)
      return prev.filter(f => f.id !== id)            // trigger: useEffect notifies parent
    })
  }, [])

  // ── Drag & drop ───────────────────────────────────────────────────────────
  const onDragEnter = (e) => { e.preventDefault(); dragCount.current++; setIsDragging(true) }
  const onDragLeave = (e) => { e.preventDefault(); if (--dragCount.current === 0) setIsDragging(false) }
  const onDragOver  = (e) => e.preventDefault()
  const onDrop      = (e) => {
    e.preventDefault()
    dragCount.current = 0
    setIsDragging(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className={`att-root${isDragging ? " att-root--dragging" : ""}`}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Hidden native file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          addFiles(e.target.files)
          e.target.value = ""   // reset so same file can be re-added after remove
        }}
      />

      {/* Chip strip — only shown when files exist */}
      {items.length > 0 && (
        <div className="att-chips">
          {items.map(item => (
            <FileChip key={item.id} item={item} onRemove={removeFile} />
          ))}
        </div>
      )}

      {/* Drag-over overlay */}
      {isDragging && (
        <div className="att-drop-overlay">
          <span>📎 Drop files to attach</span>
        </div>
      )}
    </div>
  )
})

export default Attachment