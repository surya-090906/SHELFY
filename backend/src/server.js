require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initSocket } = require('./services/socketService');

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

server.listen(PORT, () => {
  console.log(`🚀 Shelfy Backend Server running on http://localhost:${PORT}`);
  console.log(`📦 Realtime WebSocket server initialized`);
});
