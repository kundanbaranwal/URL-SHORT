const Redis = require("ioredis");

// Single shared Redis connection used for:
// 1) caching short_code -> long_url lookups
// 2) rate limiting counters
const redisClient = new Redis(process.env.REDIS_URL);

redisClient.on("connect", () => console.log("Redis connected"));
redisClient.on("error", (err) => console.error("Redis error:", err.message));

module.exports = redisClient;
