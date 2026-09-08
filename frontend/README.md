# URL Shortener — Frontend

Plain HTML/CSS/JS — no React, no build step, no bundler. Talks to the
backend over HTTP (see `API_BASE` at the top of `app.js`).

## Run it

You need any static file server, since opening `index.html` directly via
`file://` will work for looks but some browsers restrict `fetch()` calls
from file:// origins. Pick one:

**Option A — VS Code Live Server extension (easiest, no npm needed)**
1. Install the "Live Server" extension in VS Code.
2. Right-click `index.html` → "Open with Live Server".
3. It opens at `http://127.0.0.1:5500` (or similar) by default.

**Option B — http-server via npm**
```bash
npm start
```
This runs `npx http-server . -p 3000`, serving the frontend at
`http://localhost:3000`.

## Important

Make sure `API_BASE` in `app.js` matches wherever your backend is actually
running (default: `http://localhost:5000`). Make sure the backend's
`FRONTEND_URL` in its `.env` matches wherever THIS frontend is actually
running, or the browser will block requests with a CORS error.
