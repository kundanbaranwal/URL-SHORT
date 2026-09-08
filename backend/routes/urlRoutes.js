const express = require("express");
const { shortenUrl, redirectUrl, getAnalytics } = require("../controllers/urlController");
const { requireAuth, optionalAuth } = require("../middlewares/auth");
const rateLimiter = require("../middlewares/rateLimiter");

const router = express.Router();

// Anonymous users can create up to 10 short links per minute per IP.
// Logged-in-only routes could use a higher/lower limit by changing keyPrefix.
const createLimiter = rateLimiter({ windowMs: 60 * 1000, max: 10, keyPrefix: "rl:create" });

router.post("/api/shorten", createLimiter, optionalAuth, shortenUrl);
router.get("/api/analytics/:code", requireAuth, getAnalytics);

// Kept separate from /api/* since this is the public-facing redirect a
// browser hits directly (e.g. https://yourapp.com/4c92).
router.get("/:code", redirectUrl);

module.exports = router;
