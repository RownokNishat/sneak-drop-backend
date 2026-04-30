const express = require("express");
const prisma = require("../lib/prisma");

const router = express.Router();

// Create new drop (Admin API)
router.post("/", async (req, res) => {
  try {
    const { name, description, price, stock, imageUrl, startTime, endTime } =
      req.body;

    const drop = await prisma.drop.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        stock: parseInt(stock),
        initialStock: parseInt(stock),
        imageUrl,
        startTime: startTime ? new Date(startTime) : new Date(),
        endTime: endTime ? new Date(endTime) : null,
      },
    });

    res.status(201).json(drop);
  } catch (error) {
    console.error("Create drop error:", error);
    res.status(500).json({ error: "Failed to create drop" });
  }
});

// Get all active drops with recent purchases
router.get("/", async (req, res) => {
  try {
    const drops = await prisma.drop.findMany({
      where: { isActive: true },
      include: {
        purchases: {
          take: 3,
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: { id: true, username: true },
            },
          },
        },
        _count: {
          select: { reservations: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(drops);
  } catch (error) {
    console.error("Get drops error:", error);
    res.status(500).json({ error: "Failed to fetch drops" });
  }
});

// Get single drop
router.get("/:id", async (req, res) => {
  try {
    const drop = await prisma.drop.findUnique({
      where: { id: req.params.id },
      include: {
        purchases: {
          take: 3,
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: { id: true, username: true },
            },
          },
        },
      },
    });

    if (!drop) {
      return res.status(404).json({ error: "Drop not found" });
    }

    res.json(drop);
  } catch (error) {
    console.error("Get drop error:", error);
    res.status(500).json({ error: "Failed to fetch drop" });
  }
});

// Check stock (real-time endpoint)
router.get("/:id/stock", async (req, res) => {
  try {
    const drop = await prisma.drop.findUnique({
      where: { id: req.params.id },
      select: { stock: true, name: true },
    });

    if (!drop) {
      return res.status(404).json({ error: "Drop not found" });
    }

    res.json(drop);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stock" });
  }
});

module.exports = router;
