const express = require("express");
const prisma = require("../lib/prisma");
const { reservationQueue } = require("../lib/queue");

const router = express.Router();

// Reserve item (adds to queue)
router.post("/drops/:dropId/reserve", async (req, res) => {
  try {
    const { dropId } = req.params;
    const userId = req.body?.userId || req.headers["x-user-id"];

    if (!userId) {
      return res.status(400).json({ error: "User ID required" });
    }

    // Remove waiting jobs older than 60s — they will never produce a valid reservation
    try {
      const waitingJobs = await reservationQueue.getWaiting();
      const stale = waitingJobs.filter(
        (j) => Date.now() - j.data.timestamp > 60000
      );
      await Promise.all(stale.map((j) => j.remove()));
      if (stale.length) {
        console.log(`🧹 Removed ${stale.length} stale waiting jobs`);
      }
    } catch (cleanupErr) {
      console.error("Failed to clean stale jobs:", cleanupErr);
    }

    // Add to queue
    const job = await reservationQueue.add(
      "reserve",
      {
        dropId,
        userId,
        timestamp: Date.now(),
      },
      {
        jobId: `reserve-${dropId}-${userId}-${Date.now()}`,
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );

    // Get queue position estimate
    const waitingCount = await reservationQueue.getWaitingCount();

    res.status(202).json({
      status: "queued",
      jobId: job.id,
      message: "Your reservation is being processed...",
      estimatedWait: waitingCount,
    });
  } catch (error) {
    console.error("Reserve error:", error);
    res.status(500).json({ error: "Failed to queue reservation" });
  }
});

// Get user's active reservations
router.get("/users/:userId/reservations", async (req, res) => {
  try {
    const reservations = await prisma.reservation.findMany({
      where: {
        userId: req.params.userId,
        status: "ACTIVE",
        expiresAt: { gt: new Date() },
      },
      include: {
        drop: {
          select: { name: true, price: true, imageUrl: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(reservations);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch reservations" });
  }
});

module.exports = router;
