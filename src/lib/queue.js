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
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: false,
    removeOnFail: false,
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
  await reservationQueue.clean(3600000, "completed"); // 1 hour
  await reservationQueue.clean(3600000, "failed");
  console.log("✅ Cleaned old jobs");
}

cleanOldJobs();

module.exports = { reservationQueue, expiryQueue };
