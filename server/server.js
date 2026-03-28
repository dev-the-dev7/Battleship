const http    = require('http');
const path    = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');

const roomRoutes = require('./routes/rooms');
const wsHandler  = require('./ws/handler');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server });

// ---- Middleware ----
// Limit JSON body size to prevent payload floods on REST endpoints
app.use(express.json({ limit: '10kb' }));

// Serve the frontend (battleship/ root is one level up from server/)
app.use(express.static(path.join(__dirname, '..')));

// ---- REST API ----
app.use('/api/rooms', roomRoutes);

// ---- WebSocket ----
wss.on('connection', (ws, req) => wsHandler(ws, req, wss));

// ---- Start ----
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
	console.log(`Battleship server running on http://localhost:${PORT}`);
});
