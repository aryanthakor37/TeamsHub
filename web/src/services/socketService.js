import { io } from 'socket.io-client';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    const envUrl = import.meta.env.VITE_API_BASE_URL;
    const serverUrl = (envUrl && envUrl.trim())
      ? envUrl.trim().replace(/\/$/, '')
      : (window.location.hostname === 'localhost' ? 'http://localhost:5000' : window.location.origin);
    
    socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      console.log('[Socket.IO Client] Connected with ID:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('[Socket.IO Client] Disconnected from server');
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket.IO Client] Connection warning:', err.message);
    });
  }

  return socket;
};

export const joinChatRoom = (chatId) => {
  const s = getSocket();
  if (s && chatId) {
    s.emit('chat:join', chatId);
  }
};

export const leaveChatRoom = (chatId) => {
  const s = getSocket();
  if (s && chatId) {
    s.emit('chat:leave', chatId);
  }
};

export const emitChatMessage = (chatId, message) => {
  const s = getSocket();
  if (s && chatId && message) {
    s.emit('chat:message', { chatId, message });
  }
};

export const emitTypingStatus = (chatId, user, isTyping) => {
  const s = getSocket();
  if (s && chatId) {
    if (isTyping) {
      s.emit('chat:typing', { chatId, user });
    } else {
      s.emit('chat:stop_typing', { chatId, user });
    }
  }
};
