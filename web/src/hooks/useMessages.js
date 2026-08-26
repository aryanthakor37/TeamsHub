import { useState, useEffect, useCallback } from 'react';
import { fetchMessagesFromBackend, sendMessageToBackend } from '../services/chatService';
import { playTeamsNotificationSound } from '../utils/notificationUtils';
import { joinChatRoom, leaveChatRoom, getSocket, emitChatMessage } from '../services/socketService';

const messageMemoryCache = new Map();

export const useMessages = (chatId, accountId) => {
  const getInitialMessages = (id) => {
    if (!id) return [];
    if (messageMemoryCache.has(id)) return messageMemoryCache.get(id);
    try {
      const stored = localStorage.getItem(`teamshub_msgs_${id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        messageMemoryCache.set(id, parsed);
        return parsed;
      }
    } catch (e) {}
    return [];
  };

  const [messages, setMessages] = useState(() => getInitialMessages(chatId));
  const [loading, setLoading] = useState(() => {
    if (!chatId) return false;
    const initial = getInitialMessages(chatId);
    return initial.length === 0;
  });
  const [error, setError] = useState(null);

  // Synchronously switch message view to cache (0ms instant Teams jump)
  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    const cached = getInitialMessages(chatId);
    if (cached && cached.length > 0) {
      setMessages(cached);
      setLoading(false);
    } else {
      setMessages([]);
      setLoading(true);
    }
  }, [chatId]);

  const loadMessages = useCallback(async () => {
    if (!chatId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    const cached = messageMemoryCache.get(chatId);
    if (!cached || cached.length === 0) {
      setLoading(true);
    }

    setError(null);

    try {
      const data = await fetchMessagesFromBackend(chatId, accountId);
      const items = data?.items || [];
      setMessages(items);
      messageMemoryCache.set(chatId, items);
      try {
        localStorage.setItem(`teamshub_msgs_${chatId}`, JSON.stringify(items.slice(-50)));
      } catch (e) {}
    } catch (err) {
      if (!cached || cached.length === 0) {
        setError(err.message || 'Failed to load conversation messages.');
        setMessages([]);
      }
    } finally {
      setLoading(false);
    }
  }, [chatId, accountId]);

  const loadMessagesSilently = useCallback(async () => {
    if (!chatId) return;
    try {
      const data = await fetchMessagesFromBackend(chatId, accountId);
      setMessages((prev) => {
        const newItems = data.items || [];
        if (newItems.length === 0) return prev;

        const prevLast = prev.length > 0 ? prev[prev.length - 1] : null;
        const newLast = newItems[newItems.length - 1];
        const prevId = prevLast ? (prevLast._id || prevLast.id || prevLast.microsoftMessageId) : null;
        const newId = newLast ? (newLast._id || newLast.id || newLast.microsoftMessageId) : null;

        // If new message arrived in active chat
        if (newItems.length > prev.length || (prevId && newId && prevId !== newId)) {
          if (newLast && !newLast.isOutgoing) {
            playTeamsNotificationSound();
          }
          return newItems;
        }
        return prev;
      });
    } catch (err) {
      console.warn('Silent message sync failed:', err.message);
    }
  }, [chatId, accountId]);

  useEffect(() => {
    loadMessages();
    
    if (!chatId) return;

    joinChatRoom(chatId);

    const socket = getSocket();
    const handleRealtimeMsg = (msg) => {
      setMessages((prev) => {
        const exists = prev.some((m) => (m._id || m.id || m.microsoftMessageId) === (msg._id || msg.id || msg.microsoftMessageId));
        if (exists) return prev;
        if (!msg.isOutgoing) playTeamsNotificationSound();
        return [...prev, msg];
      });
    };

    socket.on('chat:message:received', handleRealtimeMsg);

    // Live Background Polling every 3 seconds for new incoming Teams messages
    const interval = setInterval(() => {
      loadMessagesSilently();
    }, 3000);

    return () => {
      socket.off('chat:message:received', handleRealtimeMsg);
      leaveChatRoom(chatId);
      clearInterval(interval);
    };
  }, [chatId, loadMessages, loadMessagesSilently]);

  const sendMessage = useCallback(async (content) => {
    if (!chatId || !content) return;
    try {
      const newMsg = await sendMessageToBackend(chatId, content, accountId);
      setMessages((prev) => [...prev, newMsg]);
      // Emit to Socket.IO room for instant delivery to other connected clients
      emitChatMessage(chatId, newMsg);
      return newMsg;
    } catch (err) {
      console.error('Failed to send message:', err);
      throw err;
    }
  }, [chatId, accountId]);

  return { messages, loading, error, reload: loadMessages, sendMessage };
};

