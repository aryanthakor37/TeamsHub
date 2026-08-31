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

const hasConnectedAccounts = () => {
  try {
    const rawAccs = localStorage.getItem('teamshub_connected_accounts');
    const accs = rawAccs ? JSON.parse(rawAccs) : [];
    if (Array.isArray(accs) && accs.length > 0) return true;

    const activeEmail = localStorage.getItem('teamshub_active_email');
    if (activeEmail && activeEmail.trim()) return true;

    return false;
  } catch (e) {
    return false;
  }
};

const getStoredLocalChats = () => {
  try {
    if (!hasConnectedAccounts()) return [];
    const raw = localStorage.getItem('teamshub_cached_chats');
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (e) {
    return [];
  }
};

const saveStoredLocalChats = (items) => {
  try {
    if (!hasConnectedAccounts()) {
      localStorage.removeItem('teamshub_cached_chats');
      return;
    }
    const filtered = (items || []).filter(Boolean);
    localStorage.setItem('teamshub_cached_chats', JSON.stringify(filtered));
  } catch (e) {}
};

// Helper: unique composite key for multi-account chat isolation
const getChatUniqueKey = (c) => {
  if (!c) return '';
  const acc = (c.accountEmail || c.connectedAccountId || '').toLowerCase().trim();
  const id = (c.microsoftChatId || c._id || c.id || '').toString().trim();
  return acc ? `${acc}_${id}` : id;
};

// Helper: merge fresh incoming chats with existing cached multi-account chats
const mergeMultiAccountChats = (freshItems = [], existingItems = []) => {
  const map = new Map();

  // 1. Seed with existing cached chats
  existingItems.forEach((c) => {
    if (!c) return;
    const key = getChatUniqueKey(c);
    if (key) map.set(key, c);
  });

  // 2. Fresh items take priority and update existing items
  freshItems.forEach((c) => {
    if (!c) return;
    const key = getChatUniqueKey(c);
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
      loadChats(false);
    };

    const handleAccountDisconnected = (e) => {
      const { email } = e.detail || {};
      if (email) {
        const cleanEmail = email.toLowerCase().trim();
        setChats((prev) => {
          const filtered = prev.filter((c) => {
            const owner = (c.accountEmail || c.connectedAccountId || c.company || '').toLowerCase().trim();
            const userClean = cleanEmail.split('@')[0];
            if (owner === cleanEmail || owner.includes(cleanEmail) || (userClean && owner.includes(userClean))) return false;
            return true;
          });
          saveStoredLocalChats(filtered);
          return filtered;
        });
      }
      setTimeout(() => loadChats(true), 300);
    };

    const handleAccountConnected = () => {
      loadChats(true);
    };

    window.addEventListener('teamshub:chat-marked-read', handleReadEvent);
    window.addEventListener('teamshub:logout', handleLogoutEvent);
    window.addEventListener('teamshub:account-switched', handleAccountSwitched);
    window.addEventListener('teamshub:account-disconnected', handleAccountDisconnected);
    window.addEventListener('teamshub:account-connected', handleAccountConnected);
    return () => {
      window.removeEventListener('teamshub:chat-marked-read', handleReadEvent);
      window.removeEventListener('teamshub:logout', handleLogoutEvent);
      window.removeEventListener('teamshub:account-switched', handleAccountSwitched);
      window.removeEventListener('teamshub:account-disconnected', handleAccountDisconnected);
      window.removeEventListener('teamshub:account-connected', handleAccountConnected);
    };
  }, []);

  const applyReadStatus = (items) => {
    const readMap = getStoredReadChats();
    const activeChatId = typeof window !== 'undefined' ? window.__teamshub_active_chat_id : null;

    let connectedEmails = [];
    let connectedNames = [];
    try {
      const stored = localStorage.getItem('teamshub_connected_accounts');
      if (stored) {
        const accs = JSON.parse(stored);
        connectedEmails = accs.map(a => (a.email || a.username || '').toLowerCase().trim()).filter(Boolean);
        connectedNames = accs.map(a => (a.displayName || a.name || '').toLowerCase().trim().replace(/[`'"]/g, '')).filter(Boolean);
      }
    } catch (e) {}

    const activeUserEmail = (localStorage.getItem('teamshub_active_email') || '').toLowerCase().trim();
    if (activeUserEmail && !connectedEmails.includes(activeUserEmail)) connectedEmails.push(activeUserEmail);

    return items.map((chat) => {
      const id = chat._id || chat.id || chat.microsoftChatId;
      
      // Determine if the last message in this chat was sent by ANY connected account / current user (outgoing)
      const senderName = (chat.lastMessageSender || '').toLowerCase().trim().replace(/[`'"]/g, '');
      const senderEmail = (chat.lastMessageSenderEmail || '').toLowerCase().trim();
      const isFromConnectedUser = (
        (senderEmail && connectedEmails.some(e => e === senderEmail || e.startsWith(senderEmail) || senderEmail.startsWith(e))) ||
        (senderName && connectedNames.some(n => n === senderName || (n.length >= 3 && senderName.includes(n)) || (senderName.length >= 3 && n.includes(senderName)))) ||
        (senderEmail && connectedEmails.some(e => {
          const u = e.split('@')[0];
          return u && senderEmail.includes(u);
        }))
      );

      const isOutgoing = !!(chat.isLastMessageOutgoing || chat.isOutgoing || isFromConnectedUser);
      const isSelf = !!(chat.isSelfChat || chat.participant?.includes('(You)'));
      const isActive = activeChatId && (activeChatId === id || activeChatId === chat.microsoftChatId || activeChatId === chat.id);

      // NEVER mark unread if the last message was sent by the user / outgoing / self-chat / currently open active chat!
      if (isOutgoing || isSelf || isActive) {
        return { ...chat, isLastMessageOutgoing: isOutgoing, unreadCount: 0 };
      }

      const markedReadTime = readMap[id];
      if (markedReadTime) {
        const msgTime = new Date(chat.lastMessageTimestamp || 0).getTime();
        // If a new INCOMING message arrived strictly after the user marked it read:
        if (msgTime > (markedReadTime + 1000)) {
          return { ...chat, isLastMessageOutgoing: false, unreadCount: 1 };
        }
        return { ...chat, isLastMessageOutgoing: false, unreadCount: 0 };
      }
      return { ...chat, isLastMessageOutgoing: false, unreadCount: chat.unreadCount || 0 };
    });
  };

  const loadChats = useCallback(async (isUserRefresh = false) => {
    if (!hasConnectedAccounts()) {
      setChats([]);
      setLoading(false);
      localStorage.removeItem('teamshub_cached_chats');
      return;
    }

    if (isUserRefresh) {
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
    } finally {
      setLoading(false);
    }
  }, []);

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

          const isOutgoing = !!(chat.isLastMessageOutgoing || chat.isOutgoing);
          const isSelf = !!(chat.isSelfChat || chat.participant?.includes('(You)'));
          const isActiveChat = typeof window !== 'undefined' && window.__teamshub_active_chat_id &&
            (window.__teamshub_active_chat_id === id || window.__teamshub_active_chat_id === chat.microsoftChatId || window.__teamshub_active_chat_id === chat.id);

          // ONLY trigger notification if it is an INCOMING message from the other person
          if (currentTs > prevTs && prevTs > 0 && !isOutgoing && !isSelf && !isActiveChat) {
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

      // Play Teams chime & show notification if a new incoming message arrived from the other person
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
    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();
    prevChatTimestamps.current.set(chatId, nowMs);
    setChats((prev) => {
      const updated = prev.map((c) => {
        if ((c._id && c._id === chatId) || (c.id && c.id === chatId) || (c.microsoftChatId && c.microsoftChatId === chatId)) {
          return {
            ...c,
            lastMessagePreview: newLastMessagePreview !== undefined ? newLastMessagePreview : c.lastMessagePreview,
            lastMessageTimestamp: now,
            isLastMessageOutgoing: true,
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
    
    // Background polling every 1.5 seconds for instant live Teams incoming messages & notifications
    const interval = setInterval(() => {
      loadChatsSilently();
    }, 1500);

    return () => clearInterval(interval);
  }, []);

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

