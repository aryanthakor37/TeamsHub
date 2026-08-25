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

const isLegacyOrFakeChat = (c) => {
  if (!c) return true;
  return false;
};

const getStoredLocalChats = () => {
  try {
    const raw = localStorage.getItem('teamshub_cached_chats');
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((c) => !isLegacyOrFakeChat(c));
  } catch (e) {
    return [];
  }
};

const saveStoredLocalChats = (items) => {
  try {
    const filtered = (items || []).filter((c) => !isLegacyOrFakeChat(c));
    localStorage.setItem('teamshub_cached_chats', JSON.stringify(filtered));
  } catch (e) {}
};

// Helper: merge fresh incoming chats with existing cached multi-account chats
const mergeMultiAccountChats = (freshItems = [], existingItems = []) => {
  const map = new Map();

  // 1. Seed with existing cached chats
  existingItems.forEach((c) => {
    if (!c) return;
    const key = (c.microsoftChatId || c._id || c.id || '').toString();
    if (key) map.set(key, c);
  });

  // 2. Fresh items take priority and update existing items
  freshItems.forEach((c) => {
    if (!c) return;
    const key = (c.microsoftChatId || c._id || c.id || '').toString();
    if (key) map.set(key, c);
  });

  return Array.from(map.values());
};

export const useChats = () => {
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
      localStorage.removeItem('teamshub_cached_chats');
      localStorage.removeItem('teamshub_active_email');
      setChats([]);
      setLoading(false);
      setError(null);
    };

    const handleAccountSwitched = () => {
      loadChats(true);
    };

    window.addEventListener('teamshub:chat-marked-read', handleReadEvent);
    window.addEventListener('teamshub:logout', handleLogoutEvent);
    window.addEventListener('teamshub:account-switched', handleAccountSwitched);
    return () => {
      window.removeEventListener('teamshub:chat-marked-read', handleReadEvent);
      window.removeEventListener('teamshub:logout', handleLogoutEvent);
      window.removeEventListener('teamshub:account-switched', handleAccountSwitched);
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

  const loadChats = useCallback(async (isUserRefresh = false) => {
    if (isUserRefresh || chats.length === 0) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await fetchChatsFromBackend('all');
      const rawItems = Array.isArray(data)
        ? data
        : (data?.items || data?.chats || data?.value || []);

      const existingCached = getStoredLocalChats();
      const mergedList = mergeMultiAccountChats(rawItems, existingCached);

      const withRead = applyReadStatus(mergedList);
      const sorted = sortChatsByDate(withRead);
      setChats(sorted);
      saveStoredLocalChats(sorted);

      // Record initial timestamps
      rawItems.forEach(c => {
        const id = c._id || c.id || c.microsoftChatId;
        const ts = new Date(c.lastMessageTimestamp || 0).getTime();
        prevChatTimestamps.current.set(id, ts);
      });
      isInitialLoad.current = false;
    } catch (err) {
      console.warn('[useChats] load error:', err.message);
      if (chats.length === 0) {
        setError(err.message || 'Failed to load Microsoft Graph chats.');
      }
    } finally {
      setLoading(false);
    }
  }, [chats.length]);

  const loadChatsSilently = useCallback(async () => {
    try {
      const data = await fetchChatsFromBackend('all');
      const rawItems = data.items || [];
      const existingCached = getStoredLocalChats();
      const mergedList = mergeMultiAccountChats(rawItems, existingCached);

      const withRead = applyReadStatus(mergedList);
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

      if (sorted.length > 0) {
        setChats(sorted);
        saveStoredLocalChats(sorted);
      }
    } catch (err) {
      console.warn('Silent chat list sync failed:', err.message);
    }
  }, []);

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
    
    // Background polling every 15 seconds for Teams updates
    const interval = setInterval(() => {
      loadChatsSilently();
    }, 15000);

    return () => clearInterval(interval);
  }, [loadChats, loadChatsSilently]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await refreshChatsOnBackend('all');
      await loadChats(true);
    } catch (e) {
      console.warn('Refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  // Calculate real unread count
  const unreadCount = chats.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  return { chats, loading, refreshing, error, refresh, reload: loadChats, bumpChatToTop, markChatAsRead, unreadCount };
};

