const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
require("./config/redis"); // establishes the Redis connection on startup

dotenv.config();

const authRoutes = require("./routes/authRoutes");
const urlRoutes = require("./routes/urlRoutes");

const app = express();

app.set("trust proxy", true); // so req.ip reflects the real client IP behind a proxy/load balancer

// Frontend now runs on its own origin/port (e.g. http://localhost:3000),
// so the browser will block API calls unless the backend explicitly
// allows that origin via CORS. FRONTEND_URL is set in .env.
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/", urlRoutes); // includes /api/shorten, /api/analytics/:code, and /:code redirect

app.get("/health", (req, res) => res.json({ status: "ok" }));

// Starts the hourly click-aggregation cron job in the same process.
// In a larger system this would run as a separate worker process instead.
require("./jobs/aggregateClicks");

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Backend API running on port ${PORT}`));
});
