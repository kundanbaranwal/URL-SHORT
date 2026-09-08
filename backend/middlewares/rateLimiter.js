const redisClient = require("../config/redis");

/**
 * Sliding-window rate limiter backed by Redis sorted sets.
 *
 * How it works:
 * 1. Each request for a given key (e.g. an IP address) adds a timestamped
 *    entry to a Redis sorted set (ZADD), where the score IS the timestamp.
 * 2. Before adding, we remove (ZREMRANGEBYSCORE) every entry older than
 *    "now - windowMs" - this is what makes it a *sliding* window rather
 *    than a fixed one (fixed windows let you burst 2x at the boundary
 *    between two windows; sliding windows don't).
 * 3. We count (ZCARD) how many entries are left in the window. If that
 *    count exceeds the limit, the request is rejected with 429.
 * 4. TTL is set on the key so Redis auto-cleans it up once the key goes
 *    quiet - no manual cleanup job needed.
 *
 * Why Redis and not an in-memory Map: an in-memory counter only works if
 * you have a single server process. The moment you run 2+ instances
 * behind a load balancer, each instance has its own counter and the
 * limit becomes meaningless. Redis gives every instance a shared,
 * consistent view of request counts.
 */
function rateLimiter({ windowMs = 60 * 1000, max = 10, keyPrefix = "rl" } = {}) {
  return async (req, res, next) => {
    try {
      const identifier = req.ip; // could also use req.user?.id for per-user limits
      const key = `${keyPrefix}:${identifier}`;
      const now = Date.now();
      const windowStart = now - windowMs;

      const multi = redisClient.multi();
      multi.zremrangebyscore(key, 0, windowStart); // drop stale entries
      multi.zadd(key, now, `${now}-${Math.random()}`); // record this request
      multi.zcard(key); // count requests currently in the window
      multi.pexpire(key, windowMs); // auto-expire the whole key

      const results = await multi.exec();
      const requestCount = results[2][1]; // result of ZCARD

      if (requestCount > max) {
        return res.status(429).json({
          error: "Too many requests. Please slow down and try again shortly.",
        });
      }

      next();
    } catch (err) {
      // Fail open: if Redis is briefly unavailable, don't block all traffic -
      // log it and let the request through rather than taking the API down.
      console.error("Rate limiter error:", err.message);
      next();
    }
  };
}

module.exports = rateLimiter;
