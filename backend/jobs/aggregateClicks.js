/**
 * Background aggregation job.
 *
 * Why this exists: the Click collection logs one document per redirect.
 * A popular link could accumulate millions of these. If the analytics
 * endpoint had to scan/aggregate all of them on every request, it would
 * get slower as the link got MORE popular - exactly backwards from what
 * you want.
 *
 * This job runs on a schedule (every hour via node-cron) and rolls up
 * clicks that haven't been aggregated yet into per-day summary documents,
 * then marks the raw clicks as aggregated. Dashboards can then read the
 * small, pre-computed summary collection instead of the raw event log.
 *
 * This is the same pattern real analytics systems (e.g. rollup tables in
 * a data warehouse) use at much larger scale.
 */
const cron = require("node-cron");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Click = require("../models/Click");

dotenv.config();

const dailyStatSchema = new mongoose.Schema({
  urlId: { type: mongoose.Schema.Types.ObjectId, ref: "Url", required: true },
  date: { type: String, required: true }, // e.g. "2026-09-08"
  count: { type: Number, default: 0 },
});
dailyStatSchema.index({ urlId: 1, date: 1 }, { unique: true });
const DailyStat = mongoose.models.DailyStat || mongoose.model("DailyStat", dailyStatSchema);

async function runAggregation() {
  console.log("Running click aggregation job...");

  const unaggregated = await Click.find({ aggregated: false }).limit(5000);
  if (unaggregated.length === 0) {
    console.log("No new clicks to aggregate.");
    return;
  }

  const grouped = {}; // key: `${urlId}_${date}` -> count
  for (const click of unaggregated) {
    const date = click.timestamp.toISOString().slice(0, 10); // "YYYY-MM-DD"
    const key = `${click.urlId}_${date}`;
    grouped[key] = grouped[key] || { urlId: click.urlId, date, count: 0 };
    grouped[key].count += 1;
  }

  const bulkOps = Object.values(grouped).map(({ urlId, date, count }) => ({
    updateOne: {
      filter: { urlId, date },
      update: { $inc: { count } },
      upsert: true,
    },
  }));

  await DailyStat.bulkWrite(bulkOps);

  const ids = unaggregated.map((c) => c._id);
  await Click.updateMany({ _id: { $in: ids } }, { $set: { aggregated: true } });

  console.log(`Aggregated ${unaggregated.length} clicks into ${bulkOps.length} daily buckets.`);
}

// Runs once immediately if this file is executed directly (e.g. `npm run aggregate`),
// or on an hourly cron schedule when required by server.js.
if (require.main === module) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(async () => {
      await runAggregation();
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
} else {
  cron.schedule("0 * * * *", runAggregation); // every hour, on the hour
}

module.exports = { runAggregation, DailyStat };
