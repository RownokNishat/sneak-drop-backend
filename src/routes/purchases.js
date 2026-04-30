const express = require("express");
const prisma = require("../lib/prisma");
const { getIO } = require("../lib/socket");

const router = express.Router();

// Complete purchase
router.post("/drops/:dropId/purchase", async (req, res) => {
  try {
    const { dropId } = req.params;
    const { reservationId, userId } = req.body;

    if (!reservationId || !userId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Atomic purchase transaction
    const purchase = await prisma.$transaction(async (tx) => {
      // Verify reservation
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        include: { drop: true },
      });

      if (!reservation) {
        throw new Error("RESERVATION_NOT_FOUND");
      }

      if (reservation.userId !== userId) {
        throw new Error("UNAUTHORIZED");
      }

      if (reservation.status !== "ACTIVE") {
        throw new Error("RESERVATION_NOT_ACTIVE");
      }

      if (new Date() > reservation.expiresAt) {
        // Reservation expired during transaction
        await tx.reservation.update({
          where: { id: reservationId },
          data: { status: "EXPIRED" },
        });

        // Recover stock
        await tx.drop.update({
          where: { id: dropId },
          data: { stock: { increment: 1 } },
        });

        throw new Error("RESERVATION_EXPIRED");
      }

      // Create purchase
      const newPurchase = await tx.purchase.create({
        data: {
          userId,
          dropId,
          reservationId,
        },
        include: {
          user: {
            select: { id: true, username: true },
          },
          drop: {
            select: { name: true, price: true, stock: true },
          },
        },
      });

      // Update reservation status
      await tx.reservation.update({
        where: { id: reservationId },
        data: { status: "COMPLETED" },
      });

      return newPurchase;
    });

    // Broadcast updates (only when Socket.io is available in this process)
    const io = getIO();
    if (io) {
      io.to(`drop:${dropId}`).emit("stock-update", {
        dropId,
        stock: purchase.drop.stock,
        event: "purchased",
      });

      io.emit("global-stock-update", {
        dropId,
        stock: purchase.drop.stock,
      });

      io.to(`drop:${dropId}`).emit("new-purchase", {
        dropId,
        purchase: {
          id: purchase.id,
          username: purchase.user.username,
          createdAt: purchase.createdAt,
        },
      });

      io.emit("purchase-success", {
        userId,
        dropId,
        purchase: {
          id: purchase.id,
          dropName: purchase.drop.name,
          price: purchase.drop.price,
        },
        message: "Purchase completed successfully!",
      });
    }

    res.json(purchase);
  } catch (error) {
    console.error("Purchase error:", error);

    const errorMessages = {
      RESERVATION_NOT_FOUND: "Reservation not found",
      UNAUTHORIZED: "Unauthorized access",
      RESERVATION_NOT_ACTIVE: "Reservation is no longer active",
      RESERVATION_EXPIRED: "Reservation has expired",
    };

    res.status(400).json({
      error: errorMessages[error.message] || "Purchase failed",
    });
  }
});

// Get recent purchases for activity feed
router.get("/drops/:dropId/purchases", async (req, res) => {
  try {
    const purchases = await prisma.purchase.findMany({
      where: { dropId: req.params.dropId },
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { id: true, username: true },
        },
      },
    });

    res.json(purchases);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch purchases" });
  }
});

module.exports = router;
