const http = require('http');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const { initSocket } = require('./src/socket');

const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Create HTTP Server & Initialize Socket.IO
const server = http.createServer(app);
initSocket(server);

// Start Server
server.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 TeamsHub API Server running on port ${PORT}`);
  console.log(`⚡ Socket.IO real-time engine active`);
  console.log(`🌐 Health check endpoint: http://localhost:${PORT}/api/health`);
  console.log(`==================================================`);
});

