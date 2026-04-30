const Bull = require("bull");
const redis = require("../config/redis");

// Create Redis client for Bull
const client = redis;
const subscriber = redis.duplicate();

// Create queues
const reservationQueue = new Bull("reservation-queue", {
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
    attempts: 20, // Retry for up to ~100 seconds (20 * 5s)
    backoff: {
      type: "fixed",
      delay: 5000, // Wait 5s between retries
    },
    removeOnComplete: true,
    removeOnFail: 100,
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
