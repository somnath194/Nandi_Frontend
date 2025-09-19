import React, { useEffect, useRef, useState } from "react"

const VideoStream = () => {
  const imgRef = useRef(null)
  const [defaultImg] = useState("/video_logo.png") // 👈 put your logo file in `public/logo.png`

  useEffect(() => {
    const ws = new WebSocket("wss://api.shuun.site/ws/video")

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if ((data.type === "video" || data.type === "image") && data.frame) {
          if (imgRef.current) {
            imgRef.current.src = `data:image/jpeg;base64,${data.frame}`
          }
        }
      } catch (err) {
        console.error("Frame parse error:", err)
      }
    }

    ws.onerror = (err) => {
      console.error("Video WS error:", err)
    }

    ws.onclose = () => {
      console.log("Video WS closed")
    }

    return () => {
      ws.close()
    }
  }, [])

  return (
    <div
      style={{
    border: "2px solid #333",
    borderRadius: "12px",
    overflow: "hidden",
    width: "600px",   // ⬅️ wider
    height: "350px",  // ⬅️ taller
    backgroundColor: "black",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "16px", // ⬅️ gap before action log
    marginRight: "16px",  // ⬅️ align to right edge
  }}
    >
      <img
        ref={imgRef}
        src={defaultImg}  // 👈 show default logo until a frame arrives
        alt="Live Video"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain", // contain to keep logo aspect ratio
        }}
      />
    </div>
  )
}

export default VideoStream
