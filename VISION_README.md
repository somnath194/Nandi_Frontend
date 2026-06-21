# Nandi Frontend — Vision Integration

## What changed in v3

### Layout
- Chat area is now constrained to **720px max-width**, centered like ChatGPT/Claude
- Vision column widened to **400px** for proper streams
- Removed the "Vision ready / Click Start" footer
- Orb shrunk slightly to give chat more vertical room

### Vision system
- **VisionManager** — receives commands from your vision agent via WebSocket
- **VisionBox** — single stream/frame display with **📸 capture** and **✕ close** buttons
- **Multi-stream stacking** — boxes stack newest-at-bottom in the right column. When too many, the column scrolls. (Simpler than dynamic relayout; you always see at least the latest one.)
- **Camera button** = WebRTC producer. Pressing it starts streaming your device camera to the vision server with `stream_id = web_react_<deviceName>_camera`.

## How the vision agent talks to the browser

The browser can't run a FastAPI server. Instead:

```
Vision Agent  ──HTTP POST──►  Brain Server (api.shuun.site)
                                   │
                                   │  Brain holds a WebSocket open
                                   │  to each connected browser, keyed
                                   │  by client_id
                                   ▼
                              Browser → renders the vision box
```

### Steps to wire it up

**1. Add `BACKEND_VISION_DISPATCH.py` to your brain server**

```python
from vision_dispatch import router as vision_dispatch_router
app.include_router(vision_dispatch_router)
```

This adds:
- `WebSocket /ws/vision-control` — browser connects, registers with its `client_id`
- `POST /api/vision/dispatch/{client_id}/receive/frame` — same payload as desktop `/receive/frame`
- `POST /api/vision/dispatch/{client_id}/receive/stream` — same payload as desktop `/receive/stream`
- `POST /api/vision/dispatch/{client_id}/close`

**2. Update `CLIENT_REGISTRY` in your vision agent's `.env`**

```bash
CLIENT_REGISTRY=local:http://localhost:8766,web_react_somnath-pc:https://api.shuun.site/api/vision/dispatch/web_react_somnath-pc
```

The client_id matches what the browser registers as: `web_react_<deviceName>`. Whatever device name you typed at first launch becomes part of it. You can see it in the browser console (`[vision-ctrl] connected, registering…`).

**3. Use the agent normally**

```
"Nandi, show pc cam on web_react_somnath-pc"
```

The vision agent calls `start_raw_stream(stream_id='pc_cam', client_id='web_react_somnath-pc')`, which POSTs to the brain dispatch URL, brain forwards via WebSocket, browser opens a VisionBox showing the WebRTC stream.

## Vision server signaling URL

The browser consumer connects directly to your vision server's `/ws/signal`. Default is `wss://vision.shuun.site/ws/signal`. To override for dev, run this in the browser console:

```js
localStorage.setItem('nandi_vision_signal_url', 'ws://localhost:8765/ws/signal')
```

Then reload.

## Camera button behavior

- Click camera icon → asks for camera permission, opens local stream
- Starts a WebRTC producer with `stream_id = web_react_<device>_camera`
- A VisionBox appears in the right column showing the local preview
- Click the camera icon again, or the box's ✕ button, to stop

The vision agent can now `analyze_stream(stream_id='web_react_somnath-pc_camera', ...)` from your phone, PC, or any other client.

## Capture button (📸)

On any VisionBox, the 📸 button grabs the current frame and inserts it into the chat as a message. You can then type a question about it and Nandi will see it in context (the image is base64-encoded; your backend needs to handle inline base64 images in chat or you can upload it as an attachment — easy to wire in if needed).
