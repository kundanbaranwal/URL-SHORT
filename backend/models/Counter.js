const mongoose = require("mongoose");

// MongoDB has no built-in auto-increment (unlike MySQL's AUTO_INCREMENT),
// so this single-document collection simulates one.
const counterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  value: { type: Number, default: 0 },
});

const Counter = mongoose.model("Counter", counterSchema);

/**
 * Atomically increments and returns the next sequence value.
 *
 * The key detail: findOneAndUpdate with $inc is a single atomic operation
 * at the database level. If two requests call this at the exact same
 * millisecond, MongoDB still guarantees each gets a unique, incremented
 * value - there's no read-modify-write race condition like there would be
 * with "read value, add 1, save value" done as two separate steps.
 */
async function getNextSequence(name) {
  const counter = await Counter.findOneAndUpdate(
    { name },
    { $inc: { value: 1 } },
    { new: true, upsert: true }
  );
  return counter.value;
}

module.exports = { Counter, getNextSequence };
