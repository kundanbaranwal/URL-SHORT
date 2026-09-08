const mongoose = require("mongoose");

const urlSchema = new mongoose.Schema(
  {
    // Auto-incrementing numeric id used to derive the short code (see utils/base62.js).
    // Mongo's default _id (ObjectId) isn't sequential, so we keep a separate counter.
    sequenceId: { type: Number, required: true, unique: true },

    shortCode: { type: String, required: true, unique: true, index: true },
    longUrl: { type: String, required: true },

    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Daily/hourly click counts get written here by the aggregation job,
    // so the analytics endpoint reads pre-computed numbers instead of
    // scanning every raw click event on every request.
    totalClicks: { type: Number, default: 0 },

    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Url", urlSchema);
