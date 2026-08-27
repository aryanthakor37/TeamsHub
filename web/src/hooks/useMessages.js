import { useState, useEffect, useCallback } from 'react';
import {
  fetchMessagesFromBackend,
  sendMessageToBackend,
  setMessageReactionOnBackend,
  unsetMessageReactionOnBackend
} from '../services/chatService';
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
        if (Array.isArray(parsed) && parsed.length > 0) {
          messageMemoryCache.set(id, parsed);
          return parsed;
        }
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

    const cached = messageMemoryCache.get(chatId) || getInitialMessages(chatId);
    if (cached && cached.length > 0) {
      setMessages(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const data = await fetchMessagesFromBackend(chatId, accountId);
      const items = data?.items || [];
      if (items.length > 0) {
        setMessages(items);
        messageMemoryCache.set(chatId, items);
        try {
          localStorage.setItem(`teamshub_msgs_${chatId}`, JSON.stringify(items.slice(-50)));
        } catch (e) {}
      }
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
      const newItems = data.items || [];
      if (newItems.length === 0) return;

      setMessages((prev) => {
        const prevSig = prev.map(m => `${m.microsoftMessageId || m._id || m.id}_${(m.reactions || []).length}`).join('|');
        const newSig = newItems.map(m => `${m.microsoftMessageId || m._id || m.id}_${(m.reactions || []).length}`).join('|');

        if (prevSig !== newSig) {
          const prevLast = prev.length > 0 ? prev[prev.length - 1] : null;
          const newLast = newItems[newItems.length - 1];
          const prevId = prevLast ? (prevLast._id || prevLast.id || prevLast.microsoftMessageId) : null;
          const newId = newLast ? (newLast._id || newLast.id || newLast.microsoftMessageId) : null;

          if (newLast && !newLast.isOutgoing && prevId !== newId) {
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

    // Real-time Reaction listener
    const handleRealtimeReaction = (data) => {
      if (!data || !data.messageId) return;
      setMessages((prev) =>
        prev.map((msg) => {
          const isMatch =
            (msg.microsoftMessageId && msg.microsoftMessageId === data.messageId) ||
            (msg._id && msg._id === data.messageId) ||
            (msg.id && msg.id === data.messageId);
          if (!isMatch) return msg;

          const currentReactions = Array.isArray(msg.reactions) ? [...msg.reactions] : [];
          if (data.action === 'set') {
            const hasSame = currentReactions.some(
              (r) => r.reactionType === data.reactionType && (r.user?.displayName === data.user?.displayName || r.user?.email === data.user?.email)
            );
            if (!hasSame) {
              currentReactions.push({ reactionType: data.reactionType, user: data.user, createdDateTime: new Date().toISOString() });
            }
          } else if (data.action === 'unset') {
            const index = currentReactions.findIndex(
              (r) => r.reactionType === data.reactionType && (r.user?.displayName === data.user?.displayName || r.user?.email === data.user?.email)
            );
            if (index !== -1) {
              currentReactions.splice(index, 1);
            }
          }

          return { ...msg, reactions: currentReactions };
        })
      );
    };

    socket.on('chat:message:received', handleRealtimeMsg);
    socket.on('reaction:updated', handleRealtimeReaction);

    // Live Background Polling every 2.5 seconds for instant new incoming Teams messages
    const interval = setInterval(() => {
      loadMessagesSilently();
    }, 2500);

    return () => {
      socket.off('chat:message:received', handleRealtimeMsg);
      socket.off('reaction:updated', handleRealtimeReaction);
      leaveChatRoom(chatId);
      clearInterval(interval);
    };
  }, [chatId, loadMessages, loadMessagesSilently]);

  const sendMessage = useCallback(async (contentOrPayload) => {
    if (!chatId || !contentOrPayload) return;
    try {
      const newMsg = await sendMessageToBackend(chatId, contentOrPayload, accountId);
      setMessages((prev) => [...prev, newMsg]);
      // Emit to Socket.IO room for instant delivery to other connected clients
      emitChatMessage(chatId, newMsg);
      return newMsg;
    } catch (err) {
      console.error('Failed to send message:', err);
      throw err;
    }
  }, [chatId, accountId]);

  // Toggle a reaction (optimistic update + backend sync)
  const toggleReaction = useCallback(async (messageId, reactionType, currentReactions = []) => {
    if (!chatId || !messageId || !reactionType) return;

    const userEmail = (localStorage.getItem('teamshub_active_email') || '').toLowerCase().trim();
    const hasAlreadyReacted = currentReactions.some(
      (r) => (r.reactionType === reactionType || r === reactionType) && (!r.user?.email || r.user?.email.toLowerCase() === userEmail)
    );

    const action = hasAlreadyReacted ? 'unset' : 'set';

    // 1. Optimistic local state update
    setMessages((prev) =>
      prev.map((msg) => {
        const isTarget =
          (msg.microsoftMessageId && msg.microsoftMessageId === messageId) ||
          (msg._id && msg._id === messageId) ||
          (msg.id && msg.id === messageId);
        if (!isTarget) return msg;

        let reactions = Array.isArray(msg.reactions) ? [...msg.reactions] : [];
        if (action === 'set') {
          reactions.push({
            reactionType,
            user: { displayName: 'You', email: userEmail },
            createdDateTime: new Date().toISOString()
          });
        } else {
          reactions = reactions.filter(
            (r) => (r.reactionType || r) !== reactionType
          );
        }
        return { ...msg, reactions };
      })
    );

    // 2. Call backend API
    try {
      if (action === 'set') {
        await setMessageReactionOnBackend(chatId, messageId, reactionType, accountId);
      } else {
        await unsetMessageReactionOnBackend(chatId, messageId, reactionType, accountId);
      }
    } catch (err) {
      console.warn('Failed to sync reaction to backend:', err.message);
    }
  }, [chatId, accountId]);

  return { messages, loading, error, reload: loadMessages, sendMessage, toggleReaction };
};

