import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchChatsFromBackend, refreshChatsOnBackend, markChatAsReadOnBackend } from '../services/chatService';
import { playTeamsNotificationSound, showDesktopNotification, requestNotificationPermission } from '../utils/notificationUtils';

// Helper: sort chats chronologically (most recent on top)
export const sortChatsByDate = (list = []) => {
  return [...list].sort((a, b) => {
    const timeA = new Date(a.lastMessageTimestamp || a.updatedAt || a.lastUpdatedDateTime || 0).getTime();
    const timeB = new Date(b.lastMessageTimestamp || b.updatedAt || b.lastUpdatedDateTime || 0).getTime();
    return timeB - timeA;
  });
};

const getStoredReadChats = () => {
  try {
    return JSON.parse(localStorage.getItem('teamshub_read_chats') || '{}');
  } catch (e) {
    return {};
  }
};

const saveStoredReadChat = (chatId) => {
  try {
    const map = getStoredReadChats();
    map[chatId] = Date.now();
    localStorage.setItem('teamshub_read_chats', JSON.stringify(map));
  } catch (e) {}
};

const getStoredLocalChats = () => {
  try {
    const raw = localStorage.getItem('teamshub_cached_chats');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(c => c && c.company !== 'Hem Shah') : [];
  } catch (e) {
    return [];
  }
};

const saveStoredLocalChats = (items) => {
  try {
    const filtered = (items || []).filter(c => c && c.company !== 'Hem Shah');
    localStorage.setItem('teamshub_cached_chats', JSON.stringify(filtered));
  } catch (e) {}
};

export const useChats = (selectedAccountId = 'all') => {
  const [chats, setChats] = useState(() => {
    const cached = getStoredLocalChats();
    return cached.length > 0 ? sortChatsByDate(cached) : [];
  });
  const [loading, setLoading] = useState(() => {
    const cached = getStoredLocalChats();
    return cached.length === 0;
  });
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  // Track previous message timestamps to detect brand new incoming messages
  const prevChatTimestamps = useRef(new Map());
  const isInitialLoad = useRef(true);

  // Request browser notification permission once on hook mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Synchronize read chats and clear state on logout
  useEffect(() => {
    const handleReadEvent = (e) => {
      const { chatId } = e.detail || {};
      if (chatId) {
        setChats((prev) =>
          prev.map((c) =>
            (c._id === chatId || c.id === chatId || c.microsoftChatId === chatId)
              ? { ...c, unreadCount: 0 }
              : c
          )
        );
      }
    };

    const handleLogoutEvent = () => {
      setChats([]);
      setLoading(false);
      setError(null);
    };

    window.addEventListener('teamshub:chat-marked-read', handleReadEvent);
    window.addEventListener('teamshub:logout', handleLogoutEvent);
    return () => {
      window.removeEventListener('teamshub:chat-marked-read', handleReadEvent);
      window.removeEventListener('teamshub:logout', handleLogoutEvent);
    };
  }, []);

  const applyReadStatus = (items) => {
    const readMap = getStoredReadChats();
    return items.map((chat) => {
      const id = chat._id || chat.id || chat.microsoftChatId;
      const markedReadTime = readMap[id];
      if (markedReadTime) {
        const msgTime = new Date(chat.lastMessageTimestamp || 0).getTime();
        // If a new message arrived AFTER the user marked it read, it is UNREAD!
        if (msgTime > (markedReadTime + 1000)) {
          return { ...chat, unreadCount: 1 };
        }
        return { ...chat, unreadCount: 0 };
      }
      return chat;
    });
  };

  const loadChats = useCallback(async () => {
    const activeEmail = localStorage.getItem('teamshub_active_email');
    if (!activeEmail) {
      setChats([]);
      setLoading(false);
      return;
    }

    if (chats.length === 0) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await fetchChatsFromBackend(selectedAccountId);
      const rawItems = data.items || [];
      if (rawItems.length > 0) {
        const withRead = applyReadStatus(rawItems);
        const sorted = sortChatsByDate(withRead);
        setChats(sorted);
        saveStoredLocalChats(sorted);

        // Record initial timestamps
        rawItems.forEach(c => {
          const id = c._id || c.id || c.microsoftChatId;
          const ts = new Date(c.lastMessageTimestamp || 0).getTime();
          prevChatTimestamps.current.set(id, ts);
        });
      } else if (data.source === 'unauthenticated' || data.source === 'empty') {
        setChats([]);
        saveStoredLocalChats([]);
      }
      isInitialLoad.current = false;
    } catch (err) {
      setError(err.message || 'Failed to load Microsoft Graph chats.');
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId, chats.length]);

  const loadChatsSilently = useCallback(async () => {
    const activeEmail = localStorage.getItem('teamshub_active_email');
    if (!activeEmail) return;

    try {
      await refreshChatsOnBackend(selectedAccountId);
      const data = await fetchChatsFromBackend(selectedAccountId);
      const rawItems = data.items || [];
      const withRead = applyReadStatus(rawItems);
      const sorted = sortChatsByDate(withRead);
      
      // Check if any chat received a NEW incoming message since last sync
      let hasNewIncomingMessage = false;
      let newestChat = null;

      if (!isInitialLoad.current && prevChatTimestamps.current.size > 0) {
        for (const chat of withRead) {
          const id = chat._id || chat.id || chat.microsoftChatId;
          const currentTs = new Date(chat.lastMessageTimestamp || 0).getTime();
          const prevTs = prevChatTimestamps.current.get(id) || 0;

          // If timestamp is newer and chat is not a self-chat
          if (currentTs > prevTs && prevTs > 0 && !chat.isSelfChat && !chat.participant?.includes('(You)')) {
            hasNewIncomingMessage = true;
            newestChat = chat;
            break;
          }
        }
      }

      // Update timestamps map
      rawItems.forEach(c => {
        const id = c._id || c.id || c.microsoftChatId;
        const ts = new Date(c.lastMessageTimestamp || 0).getTime();
        prevChatTimestamps.current.set(id, ts);
      });

      // Play Teams chime & show notification if a new message arrived
      if (hasNewIncomingMessage && newestChat) {
        playTeamsNotificationSound();
        showDesktopNotification(
          newestChat.participant || 'Microsoft Teams',
          newestChat.lastMessagePreview || 'New message received',
          () => {
            window.dispatchEvent(new CustomEvent('teamshub:open-chat', { detail: { chatId: newestChat._id || newestChat.id } }));
          }
        );
        window.dispatchEvent(new CustomEvent('teamshub:new-toast-notification', { detail: { chat: newestChat } }));
      }

      setChats(sorted);
    } catch (err) {
      console.warn('Silent chat list sync failed:', err.message);
    }
  }, [selectedAccountId]);

  // Immediately mark a chat as read (zeroes unreadCount and persists)
  const markChatAsRead = useCallback((chatId, accountId = null) => {
    if (!chatId) return;
    saveStoredReadChat(chatId);

    setChats((prev) =>
      prev.map((c) =>
        (c._id === chatId || c.id === chatId || c.microsoftChatId === chatId)
          ? { ...c, unreadCount: 0 }
          : c
      )
    );

    window.dispatchEvent(new CustomEvent('teamshub:chat-marked-read', { detail: { chatId } }));
    markChatAsReadOnBackend(chatId, accountId);
  }, []);

  // Immediately bump a chat to top when sending/receiving message in active view
  const bumpChatToTop = useCallback((chatId, newLastMessagePreview) => {
    setChats((prev) => {
      const now = new Date().toISOString();
      const updated = prev.map((c) => {
        if ((c._id && c._id === chatId) || (c.id && c.id === chatId) || (c.microsoftChatId && c.microsoftChatId === chatId)) {
          return {
            ...c,
            lastMessagePreview: newLastMessagePreview !== undefined ? newLastMessagePreview : c.lastMessagePreview,
            lastMessageTimestamp: now,
            unreadCount: 0
          };
        }
        return c;
      });
      return sortChatsByDate(updated);
    });
  }, []);

  useEffect(() => {
    loadChats();
    
    // Live Background Polling every 4 seconds for real-time Teams updates
    const interval = setInterval(() => {
      loadChatsSilently();
    }, 4000);

    return () => clearInterval(interval);
  }, [loadChats, loadChatsSilently]);

  const refresh = async () => {
    setRefreshing(true);
    await refreshChatsOnBackend(selectedAccountId);
    await loadChats();
    setRefreshing(false);
  };

  // Calculate real unread count
  const unreadCount = chats.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  return { chats, loading, refreshing, error, refresh, reload: loadChats, bumpChatToTop, markChatAsRead, unreadCount };
};

