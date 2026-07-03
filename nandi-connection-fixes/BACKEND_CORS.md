# Backend CORS — required for REST calls to work cross-origin

The WebSocket connections (chat, logs, vision-control, WebRTC signalling) do **not**
need CORS — the frontend now probes them by opening the socket, which browsers allow
regardless of origin.

But **REST calls still need CORS headers on the server**, because the frontend origin
(`http://localhost:5173` in dev, `https://your-app.vercel.app` in prod) is always
different from the API origin. These REST calls are:

- `POST /auth/google-login` (login)
- `POST /api/upload` (attachments)
- `POST /api/stt` (speech-to-text)
- `POST /api/tts` (text-to-speech)

Without CORS, the browser blocks the response even if the server replied 200 — which is
exactly the `No 'Access-Control-Allow-Origin' header` error you saw. Note this affects
`localhost:5173 → localhost:8000` too, since a different port is a different origin.

## FastAPI — Nandi Brain (localhost:8000 / api.shuun.site)

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    # "*" is fine because you authenticate with a Bearer token in the
    # Authorization header, NOT cookies. (Cookies would require listing
    # explicit origins and allow_credentials=True.)
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Add this **once**, near where you create `app = FastAPI(...)`, before defining routes.

If you'd rather lock it down instead of `"*"`:

```python
allow_origins=[
    "http://localhost:5173",
    "https://your-app.vercel.app",   # your real Vercel URL
],
```

## Vision server (localhost:8765 / vision.shuun.site)

The vision server is signalling over WebSocket, so it doesn't strictly need CORS for the
frontend. But if it exposes any HTTP endpoints you call from the browser, add the same
middleware. With the new WS-probe fallback you do **not** need to add a `/health`
endpoint to the vision server — opening the signalling WS is the liveness check.

## Cloudflare tunnel note

If CORS still fails through `api.shuun.site` but works on `localhost:8000`, check that
Cloudflare isn't stripping the header. The FastAPI middleware sets it correctly; a
`cloudflared` tunnel passes it through by default. Confirm with:

```bash
curl -i -H "Origin: http://localhost:5173" https://api.shuun.site/health
# look for: access-control-allow-origin: *
```
