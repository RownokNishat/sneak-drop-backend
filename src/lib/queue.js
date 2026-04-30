const Bull = require("bull");
require("dotenv").config();

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Create queues with reliable connection method for Vercel
const reservationQueue = new Bull("reservation-queue", REDIS_URL, {
  defaultJobOptions: {
    attempts: 20, 
    backoff: { type: "fixed", delay: 5000 },
    removeOnComplete: true,
  },
});

const expiryQueue = new Bull("expiry-queue", REDIS_URL, {
  defaultJobOptions: {
    removeOnComplete: true,
  },
});

// Clean up old jobs on startup logic (Optional for Vercel)
async function cleanOldJobs() {
  try {
    await reservationQueue.clean(3600000, "completed");
    await reservationQueue.clean(3600000, "failed");
  } catch (error) {
    // Silent fail if Redis is busy
  }
}

setTimeout(cleanOldJobs, 5000);

module.exports = { reservationQueue, expiryQueue };
