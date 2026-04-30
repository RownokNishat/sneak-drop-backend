const { PrismaClient } = require("@prisma/client");
const { reservationQueue, expiryQueue } = require("../lib/queue");
const { getIO } = require("../lib/socket");

const prisma = new PrismaClient();

// Process reservations - ONE AT A TIME PER DROP
reservationQueue.process("reserve", 1, async (job) => {
  const { dropId, userId } = job.data;

  console.log(`🔄 Processing reservation for drop ${dropId}, user ${userId}`);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get drop with current stock
      const drop = await tx.drop.findUnique({
        where: { id: dropId },
        select: { id: true, stock: true, name: true, price: true },
      });

      if (!drop) {
        throw new Error("DROP_NOT_FOUND");
      }

      if (drop.stock <= 0) {
        throw new Error("OUT_OF_STOCK");
      }

      // Check for existing active reservation
      const existingReservation = await tx.reservation.findFirst({
        where: {
          userId,
          dropId,
          status: "ACTIVE",
          expiresAt: { gt: new Date() },
        },
      });

      if (existingReservation) {
        throw new Error("ALREADY_RESERVED");
      }

      // Decrement stock atomically
      const updatedDrop = await tx.drop.updateMany({
        where: {
          id: dropId,
          stock: { gt: 0 }, // Double-check stock
        },
        data: {
          stock: { decrement: 1 },
        },
      });

      if (updatedDrop.count === 0) {
        throw new Error("OUT_OF_STOCK");
      }

      // Create reservation
      const reservation = await tx.reservation.create({
        data: {
          userId,
          dropId,
          status: "ACTIVE",
          expiresAt: new Date(Date.now() + 60000), // 60 seconds
        },
        include: {
          drop: {
            select: { name: true, price: true },
          },
        },
      });

      return reservation;
    });

    // Schedule expiry job
    await expiryQueue.add(
      "check-expiry",
      {
        reservationId: result.id,
        dropId: result.dropId,
        userId: result.userId,
      },
      {
        delay: 60000, // Execute in 60 seconds
        jobId: `expiry-${result.id}`,
        removeOnComplete: true,
      },
    );

    console.log(`✅ Reservation created: ${result.id}`);
    return result;
  } catch (error) {
    console.error(`❌ Reservation failed:`, error.message);
    throw error;
  }
});

// Handle completed jobs
reservationQueue.on("completed", async (job, result) => {
  if (!result) return;

  const io = getIO();
  const { dropId, userId } = job.data;

  // Get updated stock
  const drop = await prisma.drop.findUnique({
    where: { id: dropId },
    select: { stock: true, name: true },
  });

  // Notify the specific user
  io.emit("reservation-success", {
    userId,
    dropId,
    reservation: {
      id: result.id,
      expiresAt: result.expiresAt,
      dropName: result.drop.name,
      price: result.drop.price,
    },
    message:
      "Reservation successful! You have 60 seconds to complete purchase.",
  });

  // Broadcast stock update to all users watching this drop
  io.to(`drop:${dropId}`).emit("stock-update", {
    dropId,
    stock: drop.stock,
    event: "reserved",
  });

  // Also broadcast globally for dashboard
  io.emit("global-stock-update", {
    dropId,
    stock: drop.stock,
  });
});

// Handle failed jobs
reservationQueue.on("failed", async (job, err) => {
  const io = getIO();
  const { dropId, userId } = job.data;

  let message = "Reservation failed. Please try again.";

  switch (err.message) {
    case "OUT_OF_STOCK":
      message = "Sorry, this item is sold out!";
      break;
    case "ALREADY_RESERVED":
      message = "You already have an active reservation for this item.";
      break;
    case "DROP_NOT_FOUND":
      message = "This drop no longer exists.";
      break;
  }

  io.emit("reservation-failed", {
    userId,
    dropId,
    message,
  });
});

console.log("🔄 Reservation worker started");
