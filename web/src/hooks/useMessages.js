import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchMessagesFromBackend,
  sendMessageToBackend,
  setMessageReactionOnBackend,
  unsetMessageReactionOnBackend,
  editMessageOnBackend,
  deleteMessageOnBackend
} from '../services/chatService';
import { playTeamsNotificationSound } from '../utils/notificationUtils';
import { joinChatRoom, leaveChatRoom, getSocket, emitChatMessage } from '../services/socketService';

const messageMemoryCache = new Map();

const isSameMessageId = (a, b) => {
  if (!a || !b) return false;
  const strA = String(a).replace(/^msg-/, '').trim();
  const strB = String(b).replace(/^msg-/, '').trim();
  return strA === strB || String(a).trim() === String(b).trim();
};

const getDeletedIds = () => {
  try {
    return JSON.parse(localStorage.getItem('teamshub_deleted_ids') || '[]');
  } catch {
    return [];
  }
};

export const useMessages = (chatId, accountId, chatPreviewObj) => {
  const activeChatIdRef = useRef(chatId);
  useEffect(() => {
    activeChatIdRef.current = chatId;
  }, [chatId]);

  const getInitialMessages = (id, preview) => {
    if (!id) return [];
    if (messageMemoryCache.has(id)) {
      const cached = messageMemoryCache.get(id);
      if (Array.isArray(cached) && cached.length > 0) return cached;
    }
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

    // Instant Seed from chat item's lastMessagePreview (0ms instant paint!)
    if (preview?.lastMessagePreview) {
      const seedMsg = {
        _id: `seed-${id}`,
        microsoftMessageId: `seed-${id}`,
        chatId: id,
        senderName: preview.lastMessageSender || preview.participant || 'Participant',
        senderEmail: preview.lastMessageSenderEmail || '',
        isFromMe: preview.isLastMessageOutgoing || preview.isOutgoing || false,
        content: preview.lastMessagePreview,
        contentType: 'text',
        timestamp: preview.lastMessageTimestamp || new Date().toISOString(),
        createdDateTime: preview.lastMessageTimestamp || new Date().toISOString(),
        reactions: [],
        status: 'delivered'
      };
      return [seedMsg];
    }
    return [];
  };

  const [messages, setMessages] = useState(() => getInitialMessages(chatId, chatPreviewObj));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Synchronously switch message view to cache or instant preview seed (0ms instant Teams jump)
  useEffect(() => {
    activeChatIdRef.current = chatId;
    if (!chatId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    const init = getInitialMessages(chatId, chatPreviewObj);
    setMessages(init);
    setLoading(false);
  }, [chatId, chatPreviewObj?.lastMessagePreview]);

  const loadMessages = useCallback(async () => {
    if (!chatId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setError(null);

    try {
      const data = await fetchMessagesFromBackend(chatId, accountId);
      // Guard against race conditions when user switched chats quickly
      if (activeChatIdRef.current !== chatId) return;

      const rawItems = data?.items || data?.messages || (Array.isArray(data) ? data : []);
      const delIds = getDeletedIds();
      const items = rawItems.filter(m => {
        if (!m || m.isDeleted || m.deletedDateTime) return false;
        const clean = (m.content || '').replace(/<[^>]*>/g, '').trim();
        if (clean === 'This message was deleted.' || clean === 'This message has been deleted') return false;
        return !delIds.some(d => isSameMessageId(d, m.microsoftMessageId || m._id || m.id));
      });

      if (items.length > 0) {
        setMessages(items);
        messageMemoryCache.set(chatId, items);
        try {
          localStorage.setItem(`teamshub_msgs_${chatId}`, JSON.stringify(items.slice(-50)));
        } catch (e) {}
      }
    } catch (err) {
      if (activeChatIdRef.current !== chatId) return;
    } finally {
      if (activeChatIdRef.current === chatId) {
        setLoading(false);
      }
    }
  }, [chatId, accountId]);

  const loadMessagesSilently = useCallback(async () => {
    if (!chatId) return;
    try {
      const data = await fetchMessagesFromBackend(chatId, accountId);
      if (activeChatIdRef.current !== chatId) return;

      const rawItems = data?.items || data?.messages || (Array.isArray(data) ? data : []);
      const delIds = getDeletedIds();
      const newItems = rawItems.filter(m => {
        if (!m || m.isDeleted || m.deletedDateTime) return false;
        const clean = (m.content || '').replace(/<[^>]*>/g, '').trim();
        if (clean === 'This message was deleted.' || clean === 'This message has been deleted') return false;
        return !delIds.some(d => isSameMessageId(d, m.microsoftMessageId || m._id || m.id));
      });

      setMessages((prev) => {
        if (activeChatIdRef.current !== chatId) return prev;
        const prevSig = prev.map(m => `${m.microsoftMessageId || m._id || m.id}_${(m.reactions || []).length}_${m.content || ''}`).join('|');
        const newSig = newItems.map(m => `${m.microsoftMessageId || m._id || m.id}_${(m.reactions || []).length}_${m.content || ''}`).join('|');

        if (prevSig !== newSig) {
          const prevLast = prev.length > 0 ? prev[prev.length - 1] : null;
          const newLast = newItems[newItems.length - 1];
          const prevId = prevLast ? (prevLast._id || prevLast.id || prevLast.microsoftMessageId) : null;
          const newId = newLast ? (newLast._id || newLast.id || newLast.microsoftMessageId) : null;

          if (newLast && !newLast.isOutgoing && prevId !== newId) {
            playTeamsNotificationSound();
          }
          messageMemoryCache.set(chatId, newItems);
          try {
            localStorage.setItem(`teamshub_msgs_${chatId}`, JSON.stringify(newItems.slice(-50)));
          } catch (e) {}
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

    // Real-time Message Edit listener
    const handleRealtimeEdit = (data) => {
      if (!data || !data.messageId) return;
      setMessages((prev) =>
        prev.map((msg) => {
          const isMatch =
            (msg.microsoftMessageId && msg.microsoftMessageId === data.messageId) ||
            (msg._id && msg._id === data.messageId) ||
            (msg.id && msg.id === data.messageId);
          if (!isMatch) return msg;
          return { ...msg, content: data.content, isEdited: true };
        })
      );
    };

    // Real-time Message Delete listener
    const handleRealtimeDelete = (data) => {
      if (!data || !data.messageId) return;
      setMessages((prev) =>
        prev.filter(
          (m) =>
            m.microsoftMessageId !== data.messageId &&
            m._id !== data.messageId &&
            m.id !== data.messageId
        )
      );
    };

    socket.on('chat:message:received', handleRealtimeMsg);
    socket.on('reaction:updated', handleRealtimeReaction);
    socket.on('chat:message:edited', handleRealtimeEdit);
    socket.on('chat:message:deleted', handleRealtimeDelete);

    // Live Background Polling every 1.0 second for instant real-time incoming Teams messages
    const interval = setInterval(() => {
      loadMessagesSilently();
    }, 1000);

    return () => {
      socket.off('chat:message:received', handleRealtimeMsg);
      socket.off('reaction:updated', handleRealtimeReaction);
      socket.off('chat:message:edited', handleRealtimeEdit);
      socket.off('chat:message:deleted', handleRealtimeDelete);
      leaveChatRoom(chatId);
      clearInterval(interval);
    };
  }, [chatId, loadMessages, loadMessagesSilently]);

  const sendMessage = useCallback(async (contentOrPayload, attachments = [], image = null) => {
    if (!chatId) return;

    let textContent = '';
    let atts = [];
    let img = null;

    if (typeof contentOrPayload === 'string') {
      textContent = contentOrPayload;
      atts = Array.isArray(attachments) ? attachments : [];
      img = image;
    } else if (contentOrPayload && typeof contentOrPayload === 'object') {
      textContent = contentOrPayload.content || '';
      atts = contentOrPayload.attachments || attachments || [];
      img = contentOrPayload.image || image || null;
    }

    if (!textContent.trim() && atts.length === 0 && !img) return;

    // 1. INSTANT OPTIMISTIC 0MS LOCAL UPDATE
    const tempId = `msg-opt-${Date.now()}`;
    const optimisticMsg = {
      _id: tempId,
      microsoftMessageId: tempId,
      chatId: chatId,
      senderName: 'You',
      senderEmail: (localStorage.getItem('teamshub_active_email') || '').toLowerCase().trim(),
      content: textContent,
      contentType: 'html',
      isOutgoing: true,
      attachments: atts,
      image: img,
      reactions: [],
      createdDateTime: new Date().toISOString(),
      status: 'sending'
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const deliveredMsg = await sendMessageToBackend(
        chatId,
        { content: textContent, attachments: atts, image: img },
        accountId
      );

      setMessages((prev) =>
        prev.map((m) => (m._id === tempId || m.microsoftMessageId === tempId ? { ...deliveredMsg, status: 'delivered' } : m))
      );

      emitChatMessage(chatId, deliveredMsg);
      return deliveredMsg;
    } catch (err) {
      console.warn('Send backend sync notice:', err);
      // Mark as delivered locally so it stays in conversation
      setMessages((prev) =>
        prev.map((m) => (m._id === tempId ? { ...m, status: 'delivered' } : m))
      );
      return optimisticMsg;
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

  // Delete message (optimistic state removal + persistent storage update + Graph API delete)
  const deleteMessage = useCallback(async (messageId) => {
    if (!messageId || !chatId) return;

    // Add to blacklist
    try {
      const stored = getDeletedIds();
      const cleanId = String(messageId).replace(/^msg-/, '').trim();
      if (!stored.includes(cleanId)) {
        stored.push(cleanId);
        localStorage.setItem('teamshub_deleted_ids', JSON.stringify(stored.slice(-200)));
      }
    } catch (e) {}

    setMessages((prev) => {
      const updated = prev.filter(
        (m) =>
          !isSameMessageId(m.microsoftMessageId, messageId) &&
          !isSameMessageId(m._id, messageId) &&
          !isSameMessageId(m.id, messageId)
      );
      messageMemoryCache.set(chatId, updated);
      try {
        localStorage.setItem(`teamshub_msgs_${chatId}`, JSON.stringify(updated.slice(-50)));
      } catch (e) {}
      return updated;
    });

    try {
      await deleteMessageOnBackend(chatId, messageId, accountId);
    } catch (err) {
      console.warn('Failed to delete message on backend:', err.message);
    }
  }, [chatId, accountId]);

  // Edit message content (optimistic update + Graph API edit)
  const editMessage = useCallback(async (messageId, newContent) => {
    if (!messageId || !newContent || !chatId) return;
    setMessages((prev) => {
      const updated = prev.map((m) => {
        const isMatch =
          isSameMessageId(m.microsoftMessageId, messageId) ||
          isSameMessageId(m._id, messageId) ||
          isSameMessageId(m.id, messageId);
        if (!isMatch) return m;
        return { ...m, content: newContent, isEdited: true };
      });
      messageMemoryCache.set(chatId, updated);
      try {
        localStorage.setItem(`teamshub_msgs_${chatId}`, JSON.stringify(updated.slice(-50)));
      } catch (e) {}
      return updated;
    });

    try {
      await editMessageOnBackend(chatId, messageId, newContent, accountId);
    } catch (err) {
      console.warn('Failed to edit message on backend:', err.message);
    }
  }, [chatId, accountId]);

  return {
    messages,
    loading,
    error,
    reload: loadMessages,
    sendMessage,
    toggleReaction,
    deleteMessage,
    editMessage
  };
};


