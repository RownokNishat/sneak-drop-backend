const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Force Permissive CORS for Debugging
app.use(cors());
app.use(express.json());

// Detailed Request Logging
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use("/api/drops", require("./routes/drops"));
app.use("/api", require("./routes/reservations"));
app.use("/api", require("./routes/purchases"));
app.use("/api/users", require("./routes/users"));

app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("💥 SERVER ERROR:", err.stack);
  res.status(500).json({ error: "Internal Server Error", details: err.message });
});

// Export for Vercel
module.exports = app;

// Local Development Server
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`🚀 API running on http://localhost:${PORT}`));
}
