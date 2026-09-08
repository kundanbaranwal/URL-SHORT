const crypto = require("crypto");
const Url = require("../models/Url");
const Click = require("../models/Click");
const redisClient = require("../config/redis");
const { encode } = require("../utils/base62");
const { getNextSequence } = require("../models/Counter");

const CACHE_TTL_SECONDS = 60 * 60; // cache each mapping for 1 hour

/**
 * POST /api/shorten
 * Creates a new short URL.
 *
 * Flow:
 * 1. Get the next atomic sequence number from MongoDB (Counter.js).
 * 2. Base62-encode it into a short code (e.g. 1000000 -> "4c92").
 * 3. Save { sequenceId, shortCode, longUrl, owner } to MongoDB.
 * 4. Immediately prime the Redis cache with this mapping, so the very
 *    first redirect request doesn't have to hit MongoDB at all.
 */
async function shortenUrl(req, res) {
  try {
    const { longUrl } = req.body;
    if (!longUrl || !isValidUrl(longUrl)) {
      return res.status(400).json({ error: "A valid longUrl is required" });
    }

    const sequenceId = await getNextSequence("url_id");
    const shortCode = encode(sequenceId);

    const url = await Url.create({
      sequenceId,
      shortCode,
      longUrl,
      owner: req.user?.id || null,
    });

    // Cache-aside write-through: populate the cache at creation time
    // instead of waiting for the first cache miss to fill it.
    await redisClient.set(`url:${shortCode}`, longUrl, "EX", CACHE_TTL_SECONDS);

    res.status(201).json({
      shortCode,
      shortUrl: `${process.env.BASE_URL}/${shortCode}`,
      longUrl,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to create short URL" });
  }
}

/**
 * GET /:code
 * Redirects a short code to its original long URL. This is the
 * highest-traffic endpoint in the whole system, so it's built
 * cache-first:
 *
 * 1. Check Redis for "url:<code>". If present (cache hit), redirect
 *    immediately - no database round-trip at all.
 * 2. If absent (cache miss), fall back to MongoDB, then populate the
 *    cache for next time before redirecting.
 * 3. Fire-and-forget: log a Click document for analytics. This is NOT
 *    awaited before responding, because the user redirecting shouldn't
 *    have to wait on an analytics write - it happens in the background.
 *
 * This "cache-aside" pattern is the standard approach for read-heavy,
 * write-light data: reads go through the cache, and a miss repopulates it.
 */
async function redirectUrl(req, res) {
  try {
    const { code } = req.params;
    let longUrl = await redisClient.get(`url:${code}`);
    let cacheHit = Boolean(longUrl);

    if (!longUrl) {
      const url = await Url.findOne({ shortCode: code });
      if (!url) {
        return res.status(404).json({ error: "Short URL not found" });
      }
      longUrl = url.longUrl;
      await redisClient.set(`url:${code}`, longUrl, "EX", CACHE_TTL_SECONDS);
    }

    // Fire-and-forget click logging - don't block the redirect on this.
    logClick(code, req).catch((err) => console.error("Click logging failed:", err.message));

    res.redirect(302, longUrl);
    console.log(`[${cacheHit ? "CACHE HIT" : "CACHE MISS"}] ${code}`);
  } catch (err) {
    res.status(500).json({ error: "Redirect failed" });
  }
}

async function logClick(shortCode, req) {
  const url = await Url.findOne({ shortCode }).select("_id");
  if (!url) return;

  const ip = req.ip || req.connection.remoteAddress || "";
  // Hash the IP instead of storing it raw - enough to dedupe/analyze
  // without keeping personally identifiable data at rest.
  const ipHash = crypto.createHash("sha256").update(ip).digest("hex");

  await Click.create({
    urlId: url._id,
    referrer: req.get("referrer") || "direct",
    ipHash,
  });

  // Keep a fast running total on the Url document itself so simple
  // "total clicks" reads don't need to touch the (much larger) Click
  // collection at all.
  await Url.updateOne({ _id: url._id }, { $inc: { totalClicks: 1 } });
}

/**
 * GET /api/analytics/:code
 * Returns click analytics for a short URL. Only the owner can view it.
 */
async function getAnalytics(req, res) {
  try {
    const { code } = req.params;
    const url = await Url.findOne({ shortCode: code });

    if (!url) return res.status(404).json({ error: "Short URL not found" });

    if (!url.owner || url.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "You don't have access to this link's analytics" });
    }

    // Break down clicks by referrer for a simple, useful chart on the
    // frontend, without scanning the whole Click collection on every request
    // for large volumes - this aggregation could itself be cached in Redis
    // with a short TTL if traffic grows.
    const referrerBreakdown = await Click.aggregate([
      { $match: { urlId: url._id } },
      { $group: { _id: "$referrer", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({
      shortCode: url.shortCode,
      longUrl: url.longUrl,
      totalClicks: url.totalClicks,
      createdAt: url.createdAt,
      referrerBreakdown,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
}

function isValidUrl(str) {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

module.exports = { shortenUrl, redirectUrl, getAnalytics };
