const express = require('express');
const { createRoom, joinRoom, getRoomCount } = require('../game/roomManager');
const { startSessionTimer }                  = require('../game/roomTimers');
const { isRoomCode }                         = require('../utils/validate');

const MAX_ROOMS = 50;

const router = express.Router();

// POST /api/rooms
router.post('/', (req, res) => {
	if (getRoomCount() >= MAX_ROOMS) {
		return res.status(503).json({ error: 'Server is at capacity. Try again later.' });
	}

	const room = createRoom();
	startSessionTimer(room);
	res.status(201).json({ code: room.code, playerId: room.players[0].id });
});

// POST /api/rooms/:code/join
router.post('/:code/join', (req, res) => {
	const code = req.params.code.toUpperCase();
	if (!isRoomCode(code)) {
		return res.status(400).json({ error: 'Invalid room code format' });
	}

	const result = joinRoom(code);
	if (result.error) {
		return res.status(404).json({ error: result.error });
	}
	res.json({ code: result.room.code, playerId: result.playerId });
});

module.exports = router;
