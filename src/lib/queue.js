const Bull = require("bull");
const redis = require("../config/redis");

// Create Redis client for Bull
const client = redis;
const subscriber = redis.duplicate();

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Create queues with reliable connection method
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

const expiryQueue = new Bull("expiry-queue", {
  createClient: (type) => {
    switch (type) {
      case "client":
        return client;
      case "subscriber":
        return subscriber;
      default:
        return redis.duplicate();
    }
  },
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: true,
  },
});

// Clean up old jobs on startup
async function cleanOldJobs() {
  try {
    await reservationQueue.clean(3600000, "completed"); // 1 hour
    await reservationQueue.clean(3600000, "failed");
    console.log("✅ Cleaned old jobs");
  } catch (error) {
    console.error("Error cleaning jobs:", error);
  }
}

setTimeout(cleanOldJobs, 5000);

module.exports = { reservationQueue, expiryQueue };
