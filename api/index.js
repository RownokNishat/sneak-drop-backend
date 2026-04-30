const express = require("express");
const cors = require("cors");

require("dotenv").config();

const app = express();

app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL,
      "https://sneak-drop-frontend.vercel.app",
      "http://localhost:5173",
    ],
    credentials: true,
  })
);
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.use("/api/drops", require("../src/routes/drops"));
app.use("/api", require("../src/routes/reservations"));
app.use("/api", require("../src/routes/purchases"));
app.use("/api/users", require("../src/routes/users"));

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something broke!" });
});

module.exports = app;
