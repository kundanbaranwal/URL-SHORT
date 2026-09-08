# URL Shortener — Backend (MVC Architecture)

Express + MongoDB + Redis REST API, structured using the MVC pattern.

## MVC mapping

A pure REST API has no "View" in the traditional server-rendered-HTML sense —
the JSON response itself is the "view" the client (frontend) consumes. This
project follows the standard Node/Express interpretation of MVC:

| MVC Layer  | Folder          | Responsibility                                             |
|------------|-----------------|--------------------------------------------------------------|
| **Model**      | `models/`       | Mongoose schemas — `User`, `Url`, `Click`, `Counter`. Defines data shape and DB rules only. |
| **Controller** | `controllers/`  | Business logic — `authController.js`, `urlController.js`. Reads the request, talks to Models, decides what response to send. |
| **View**       | *(JSON response)* | No template engine needed for an API — the JSON returned by controllers is what the frontend renders. |
| **Route**      | `routes/`       | Maps HTTP verb + path to a controller function (the "traffic director" — not part of classic MVC, but standard in Express apps). |
| **Middleware** | `middlewares/`  | Cross-cutting logic that runs before controllers: `auth.js` (JWT check), `rateLimiter.js` (Redis sliding window). |
| **Config**     | `config/`       | Database and Redis connection setup. |
| **Jobs**       | `jobs/`         | Background cron task (click aggregation) — not user-request-triggered, so it sits outside the request/response MVC flow. |

## Setup

```bash
npm install
cp .env.example .env   # fill in MongoDB URI, Redis URL, JWT secret, and FRONTEND_URL
npm run dev
```

The frontend lives in a **separate** `frontend/` folder and calls this API
over HTTP — this backend enables CORS (see `server.js`) so the two can talk
even though they run on different ports.

## API Endpoints

| Method | Endpoint              | Auth      | Description                          |
|--------|-----------------------|-----------|---------------------------------------|
| POST   | /api/auth/register    | none      | Create an account                     |
| POST   | /api/auth/login       | none      | Log in, get a JWT                     |
| POST   | /api/shorten          | optional  | Create a short URL (rate limited)     |
| GET    | /:code                | none      | Redirect to the original long URL     |
| GET    | /api/analytics/:code  | required  | View click analytics (owner only)     |

See `smoke_test.sh` to verify every route locally once the server is running.
See `PROJECT_EXPLANATION.md` (root of the earlier full-stack zip) for the
full design walkthrough of caching, rate limiting, and the aggregation job.
