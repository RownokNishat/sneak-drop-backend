const express = require("express");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = new PrismaClient();

// Create user (simplified - no auth)
router.post("/", async (req, res) => {
  try {
    const { username, email } = req.body;

    const user = await prisma.user.create({
      data: {
        username,
        email: email || `${username}@example.com`,
      },
    });

    res.status(201).json(user);
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(400).json({ error: "Username already taken" });
    }
    res.status(500).json({ error: "Failed to create user" });
  }
});

// Get user
router.get("/:id", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        reservations: {
          where: { status: "ACTIVE" },
          include: {
            drop: true,
          },
        },
        purchases: {
          include: {
            drop: true,
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

module.exports = router;
