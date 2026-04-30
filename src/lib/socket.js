const { Server } = require("socket.io");
const prisma = require("./prisma");

let io;

function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("🔌 Client connected:", socket.id);

    // Join drop-specific rooms
    socket.on("join-drop", (dropId) => {
      if (dropId) {
        socket.join(`drop:${dropId}`);
        console.log(`Client ${socket.id} joined drop:${dropId}`);
      }
    });

    // Leave drop room
    socket.on("leave-drop", (dropId) => {
      if (dropId) {
        socket.leave(`drop:${dropId}`);
      }
    });

    // Join all drops (for dashboard)
    socket.on("join-all-drops", async () => {
      try {
        const drops = await prisma.drop.findMany({
          where: { isActive: true },
          select: { id: true },
        });

        drops.forEach((drop) => {
          socket.join(`drop:${drop.id}`);
        });

        console.log(`Client ${socket.id} joined all drops`);
      } catch (error) {
        console.error("Error joining all drops:", error);
      }
    });

    socket.on("disconnect", () => {
      console.log("🔌 Client disconnected:", socket.id);
    });
  });

  return io;
}

function getIO() {
  return io || null;
}

module.exports = { initializeSocket, getIO };
