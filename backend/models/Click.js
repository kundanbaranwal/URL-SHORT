const mongoose = require("mongoose");

// One document per redirect/click. This table can grow very large, so it's
// deliberately kept "thin" - the aggregation job rolls these up into
// Url.totalClicks (and could roll into an hourly/daily analytics collection)
// so read-heavy analytics endpoints never have to scan this whole table.
const clickSchema = new mongoose.Schema({
  urlId: { type: mongoose.Schema.Types.ObjectId, ref: "Url", required: true, index: true },
  referrer: { type: String, default: "direct" },
  ipHash: { type: String, default: null }, // store a hash, never the raw IP
  timestamp: { type: Date, default: Date.now, index: true },
  aggregated: { type: Boolean, default: false }, // marked true once the cron job rolls it up
});

module.exports = mongoose.model("Click", clickSchema);
