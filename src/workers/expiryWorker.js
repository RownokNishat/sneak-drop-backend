const { PrismaClient } = require("@prisma/client");
const { expiryQueue } = require("../lib/queue");
const { getIO } = require("../lib/socket");

const prisma = new PrismaClient();

// Process expiry checks
expiryQueue.process("check-expiry", async (job) => {
  const { reservationId, dropId, userId } = job.data;

  console.log(`⏰ Checking expiry for reservation ${reservationId}`);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Check if reservation is still active
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
      });

      if (!reservation || reservation.status !== "ACTIVE") {
        console.log(`Reservation ${reservationId} already processed`);
        return null;
      }

      // Recover stock
      const updatedDrop = await tx.drop.update({
        where: { id: dropId },
        data: { stock: { increment: 1 } },
        select: { stock: true, name: true },
      });

      // Mark reservation as expired
      await tx.reservation.update({
        where: { id: reservationId },
        data: { status: "EXPIRED" },
      });

      return { drop: updatedDrop, reservationId };
    });

    if (result) {
      const io = getIO();

      // Notify user their reservation expired
      io.emit("reservation-expired", {
        userId,
        dropId,
        reservationId,
        message: "Your reservation has expired. Item returned to stock.",
      });

      // Broadcast stock recovery
      io.to(`drop:${dropId}`).emit("stock-update", {
        dropId,
        stock: result.drop.stock,
        event: "expired",
      });

      io.emit("global-stock-update", {
        dropId,
        stock: result.drop.stock,
      });

      console.log(
        `✅ Stock recovered for drop ${dropId}: ${result.drop.stock}`,
      );
    }
  } catch (error) {
    console.error(`❌ Expiry processing failed:`, error);
    throw error;
  }
});

console.log("⏰ Expiry worker started");
