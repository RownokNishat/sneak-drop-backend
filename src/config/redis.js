const Redis = require("ioredis");

const redisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  enableOfflineQueue: true,
  keepAlive: 10000, // Keep connection alive for Vercel -> Upstash
  tls: (process.env.REDIS_URL || "").startsWith("rediss://") ? {} : undefined,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  reconnectOnError: (err) => {
    if (err.message.includes("READONLY")) return true;
    return false;
  },
};

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", redisOptions);

redis.on("connect", () => console.log("✅ Redis connected"));
redis.on("error", (err) => console.error("❌ Redis error:", err));

module.exports = redis;
