const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middleware
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL,
      "https://sneak-drop-frontend.vercel.app",
      "http://localhost:5173",
    ],
    credentials: true,
  }),
);
app.use(express.json());

// Routes
app.use("/api/drops", require("./routes/drops"));
app.use("/api", require("./routes/reservations"));
app.use("/api", require("./routes/purchases"));
app.use("/api/users", require("./routes/users"));

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something broke!" });
});

// Note: Workers and Socket.io are handled by the Real-time Server (Render)
// Vercel only serves as the API gateway.

module.exports = app;
