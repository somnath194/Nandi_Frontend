import React, { useEffect, useRef, useState } from 'react'

export default function CameraModal({ onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [facingMode, setFacingMode] = useState('environment') // 'user' for front
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false)

  useEffect(() => {
    // Check if device has multiple cameras
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const cameras = devices.filter(d => d.kind === 'videoinput')
      setHasMultipleCameras(cameras.length > 1)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false

    async function startCamera() {
      // Stop existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false,
        })

        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch (err) {
        console.error('[camera] failed:', err)
      }
    }

    startCamera()

    return () => {
      cancelled = true
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [facingMode])

  const switchCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')
  }

  const handleClose = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
    }
    onClose()
  }

  return (
    <div className="camera-modal" onClick={handleClose}>
      <div className="camera-modal__inner" onClick={(e) => e.stopPropagation()}>
        <div className="camera-modal__header">
          <span className="camera-modal__title">
            <span className="camera-modal__dot" />
            Device Camera
          </span>
          <button className="camera-modal__close" onClick={handleClose}>Close</button>
        </div>

        <video
          ref={videoRef}
          className="camera-modal__video"
          autoPlay
          playsInline
          muted
        />

        {hasMultipleCameras && (
          <div className="camera-modal__controls">
            <button className="camera-modal__switch-btn" onClick={switchCamera}>
              ⟳ Switch to {facingMode === 'environment' ? 'Front' : 'Back'} Camera
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
