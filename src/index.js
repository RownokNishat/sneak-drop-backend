const express = require("express");
const http = require("http");
const cors = require("cors");
const { initializeSocket } = require("./lib/socket");

require("dotenv").config();

const app = express();
const server = http.createServer(app);

const io = initializeSocket(server);

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

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use("/api/drops", require("./routes/drops"));
app.use("/api", require("./routes/reservations"));
app.use("/api", require("./routes/purchases"));
app.use("/api/users", require("./routes/users"));

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something broke!" });
});

require("./workers/reservationWorker");
require("./workers/expiryWorker");

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready`);
  console.log(`🔄 Queue workers started`);
});
