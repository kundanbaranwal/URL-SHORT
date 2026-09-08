const jwt = require("jsonwebtoken");

/**
 * Verifies the JWT sent in the Authorization header ("Bearer <token>").
 * On success, attaches the decoded payload (which contains the user id)
 * to req.user so downstream route handlers know who's making the request.
 *
 * This is what lets us scope analytics ("show me clicks for MY links")
 * to the logged-in user instead of exposing everyone's data.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication token missing" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // e.g. { id: "...", email: "..." }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Like requireAuth, but doesn't reject the request if there's no token -
 * it just leaves req.user undefined. Used on the "create short URL"
 * endpoint so both logged-in and anonymous users can shorten links, but
 * logged-in users get ownership + analytics access.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      // invalid token on an optional route just means "treat as anonymous"
    }
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
