const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

// Atomic Reservation System
router.post('/', async (req, res) => {
    const { userId, dropId } = req.body;

    if (!userId || !dropId) {
        return res.status(400).json({ error: "userId and dropId are required" });
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Atomically decrement availableStock only if > 0
            // We use updateMany because it allows a filter on the update operation itself
            const dropUpdate = await tx.drop.updateMany({
                where: {
                    id: dropId,
                    availableStock: { gt: 0 },
                    startsAt: { lte: new Date() },
                    isActive: true
                },
                data: {
                    availableStock: { decrement: 1 },
                },
            });

            if (dropUpdate.count === 0) {
                // Either out of stock, not started, or inactive
                const drop = await tx.drop.findUnique({ where: { id: dropId } });
                if (!drop) throw new Error('DROP_NOT_FOUND');
                if (drop.availableStock <= 0) throw new Error('OUT_OF_STOCK');
                if (new Date(drop.startsAt) > new Date()) throw new Error('DROP_NOT_STARTED');
                throw new Error('RESERVATION_FAILED');
            }

            // 2. Create the reservation (60-second window)
            const reservation = await tx.reservation.create({
                data: {
                    userId,
                    dropId,
                    expiresAt: new Date(Date.now() + 60_000), // 60 seconds
                    status: 'ACTIVE',
                },
            });

            return { reservation, dropId };
        });

        // 3. Notify all clients about the stock change via WebSockets
        const updatedDrop = await prisma.drop.findUnique({ where: { id: dropId } });
        req.io.emit('stockUpdate', { 
            dropId: result.dropId, 
            availableStock: updatedDrop.availableStock 
        });

        res.status(201).json(result.reservation);
    } catch (error) {
        console.error("Reservation Error:", error.message);
        res.status(400).json({ error: error.message });
    }
});

// Get user's active reservations
router.get('/user/:userId', async (req, res) => {
    try {
        const reservations = await prisma.reservation.findMany({
            where: {
                userId: req.params.userId,
                status: 'ACTIVE',
                expiresAt: { gt: new Date() }
            },
            include: { drop: true }
        });
        res.json(reservations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
