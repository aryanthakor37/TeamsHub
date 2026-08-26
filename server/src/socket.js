const { Server } = require('socket.io');

let io = null;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*', // Allow all origins for dev
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] New client connected: ${socket.id}`);

    // Join user-specific notification room
    socket.on('user:join', (userId) => {
      if (userId) {
        socket.join(`user:${userId}`);
        console.log(`[Socket.IO] Socket ${socket.id} joined user room: user:${userId}`);
      }
    });

    // Join specific chat room
    socket.on('chat:join', (chatId) => {
      if (chatId) {
        socket.join(`chat:${chatId}`);
        console.log(`[Socket.IO] Socket ${socket.id} joined chat room: chat:${chatId}`);
      }
    });

    // Leave chat room
    socket.on('chat:leave', (chatId) => {
      if (chatId) {
        socket.leave(`chat:${chatId}`);
        console.log(`[Socket.IO] Socket ${socket.id} left chat room: chat:${chatId}`);
      }
    });

    // Handle real-time messaging
    socket.on('chat:message', (data) => {
      const { chatId, message } = data;
      if (chatId && message) {
        // Broadcast to chat room
        socket.to(`chat:${chatId}`).emit('chat:message:received', message);
        // Broadcast toast notification only to other clients (exclude sender)
        socket.broadcast.emit('teamshub:new-toast-notification', { chat: { ...message, _id: chatId } });
      }
    });

    // Handle typing indicators
    socket.on('chat:typing', ({ chatId, user }) => {
      socket.to(`chat:${chatId}`).emit('chat:typing:status', { chatId, user, isTyping: true });
    });

    socket.on('chat:stop_typing', ({ chatId, user }) => {
      socket.to(`chat:${chatId}`).emit('chat:typing:status', { chatId, user, isTyping: false });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized!');
  }
  return io;
};

module.exports = { initSocket, getIO };
