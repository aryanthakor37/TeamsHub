import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  Search, RefreshCw, Send, Lock, ShieldCheck, CheckCircle2, MessageSquare,
  AlertCircle, Sparkles, FileText, Paperclip, Image as ImageIcon, Download,
  X, ExternalLink, Eye, Smile, ThumbsUp, Heart, LogIn, Check, ArrowLeft,
  FileSpreadsheet, FileCode, FileArchive
} from 'lucide-react';
import { useChats } from '../../hooks/useChats';
import { useMessages } from '../../hooks/useMessages';
import { useAuth } from '../../hooks/useAuth';
import { acquireGraphToken } from '../../services/auth/authService';
import { getInitials, getAvatarColor } from '../../utils/avatarUtils';
import DocumentPreviewModal, { getFileCategoryMeta } from '../../components/DocumentPreviewModal';
import EmojiPicker from '../../components/EmojiPicker';
import MessageReactionsBar, { getEmojiForReactionType, getReactionTypeForEmoji } from '../../components/MessageReactionsBar';

// Helper to format date divider headers like Teams
const formatMessageDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (d.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
};

// Helper to decode HTML entities like &nbsp;, &amp;, etc. for clean preview display
export const formatChatPreview = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
};

// Teams-style Attachment Card Component
function TeamsAttachmentCard({ attachment, onClick }) {
  const fileName = attachment.name || 'Attachment';
  const meta = getFileCategoryMeta(fileName, attachment.contentType);
  const Icon = meta.icon;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick(attachment);
      }}
      style={{
        width: '270px',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        textAlign: 'left',
        userSelect: 'none',
        margin: '4px 0'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';
        e.currentTarget.style.borderColor = meta.color;
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
        e.currentTarget.style.borderColor = '#e2e8f0';
      }}
      title={`Click to preview ${fileName}`}
    >
      {/* Top File Title Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        backgroundColor: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '4px',
            backgroundColor: meta.color,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: '0.65rem',
            fontWeight: 'bold'
          }}>
            {meta.category === 'Word' ? 'W' : meta.category === 'Excel' ? 'X' : meta.category === 'PDF' ? 'PDF' : <Icon size={14} />}
          </div>
          <span style={{
            fontSize: '0.82rem',
            fontWeight: '600',
            color: '#1e293b',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {fileName}
          </span>
        </div>

        <ExternalLink size={14} style={{ color: '#64748b', flexShrink: 0 }} />
      </div>

      {/* Document Page Preview Thumbnail */}
      <div style={{
        height: '110px',
        backgroundColor: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        position: 'relative',
        background: 'linear-gradient(to bottom, #ffffff, #f8fafc)'
      }}>
        {/* Paper Skeleton Effect like Microsoft Teams */}
        <div style={{
          width: '82%',
          height: '84px',
          backgroundColor: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '4px',
          padding: '8px 10px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px'
        }}>
          <div style={{ height: '6px', width: '60%', backgroundColor: meta.color, opacity: 0.75, borderRadius: '2px' }} />
          <div style={{ height: '4px', width: '95%', backgroundColor: '#e2e8f0', borderRadius: '2px' }} />
          <div style={{ height: '4px', width: '85%', backgroundColor: '#e2e8f0', borderRadius: '2px' }} />
          <div style={{ height: '4px', width: '90%', backgroundColor: '#e2e8f0', borderRadius: '2px' }} />
          <div style={{ height: '4px', width: '55%', backgroundColor: '#e2e8f0', borderRadius: '2px' }} />
        </div>
      </div>
    </div>
  );
}

export default function ChatsPage({
  onOpenMicrosoftModal,
  initialChatId,
  initialParticipant,
  initialMessageId,
  initialKeyword
}) {
  const { connectedAccounts, activeAccount, setActiveAccount } = useAuth();
  const [selectedFilterAccount, setSelectedFilterAccount] = useState('all');
  const { chats, loading: chatsLoading, refreshing, refresh, bumpChatToTop, markChatAsRead } = useChats();
  const [activeChatId, setActiveChatId] = useState(initialChatId || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewDocModal, setPreviewDocModal] = useState(null);

  const [targetMessageId, setTargetMessageId] = useState(initialMessageId || null);
  const [targetKeyword, setTargetKeyword] = useState(initialKeyword || null);

  // Sync initial props when passed from App state
  useEffect(() => {
    if (initialMessageId) {
      setTargetMessageId(initialMessageId);
    }
    if (initialKeyword) {
      setTargetKeyword(initialKeyword);
    }
  }, [initialMessageId, initialKeyword]);

  // Track applied initial navigation key so user manual clicks in list are never overwritten
  const appliedInitialChatRef = useRef(null);

  useEffect(() => {
    if (initialChatId || initialParticipant) {
      const key = `${initialChatId || ''}-${initialParticipant || ''}`;
      if (appliedInitialChatRef.current !== key) {
        // Find matching chat by ID or by participant name
        const found = chats.find(c => {
          const matchId = initialChatId && (c._id === initialChatId || c.id === initialChatId || c.microsoftChatId === initialChatId);
          const matchName = initialParticipant && c.participant && (
            c.participant.toLowerCase().trim() === initialParticipant.toLowerCase().trim() ||
            c.participant.toLowerCase().includes(initialParticipant.toLowerCase()) ||
            initialParticipant.toLowerCase().includes(c.participant.toLowerCase())
          );
          return matchId || matchName;
        });

        if (found) {
          const targetId = found._id || found.microsoftChatId || found.id;
          setActiveChatId(targetId);
          appliedInitialChatRef.current = key;
        } else if (initialChatId && chats.length > 0) {
          setActiveChatId(initialChatId);
          appliedInitialChatRef.current = key;
        }
      }
    }
  }, [initialChatId, initialParticipant, chats]);

  // Listen for open-chat event from search / desktop notification / toast
  useEffect(() => {
    const handleOpenChatEvent = (e) => {
      const { chatId, participant, messageId, keyword } = e.detail || {};
      if (messageId) {
        setTargetMessageId(messageId);
      }
      if (keyword) {
        setTargetKeyword(keyword);
      }
      if (chatId || participant) {
        const found = chats.find(c =>
          (chatId && (c._id === chatId || c.id === chatId || c.microsoftChatId === chatId)) ||
          (participant && c.participant?.toLowerCase() === participant.toLowerCase())
        );
        if (found) {
          setActiveChatId(found._id || found.microsoftChatId || found.id);
        } else if (chatId) {
          setActiveChatId(chatId);
        }
      }
    };
    window.addEventListener('teamshub:open-chat', handleOpenChatEvent);
    return () => window.removeEventListener('teamshub:open-chat', handleOpenChatEvent);
  }, [chats]);

  // Synchronize active chat ID globally to suppress self-notifications on active view
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__teamshub_active_chat_id = activeChatId;
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.__teamshub_active_chat_id = null;
      }
    };
  }, [activeChatId]);

  const isAccountConnected = connectedAccounts && connectedAccounts.length > 0;

  const getChatOwnerEmail = (c) => {
    if (!c) return '';
    const email = (c.accountEmail || '').toLowerCase().trim();
    if (email && email.includes('@')) return email;

    // Check connectedAccountId match against any connected account
    const accId = (c.connectedAccountId || '').toLowerCase().trim();
    const foundByAccId = (connectedAccounts || []).find(a => {
      const id = (a._id || a.accountId || a.id || '').toString().toLowerCase().trim();
      return id && (id === accId || accId.includes(id));
    });
    if (foundByAccId && foundByAccId.email) return foundByAccId.email.toLowerCase().trim();

    // Check company/accountBadge against connected account display names or emails
    const badge = (c.company || c.accountBadge || '').toLowerCase().trim();
    const foundByBadge = (connectedAccounts || []).find(a => {
      const aName = (a.displayName || a.name || '').toLowerCase().trim();
      const aEmail = (a.email || '').toLowerCase().trim();
      const aUser = aEmail.split('@')[0];
      return (aName && (badge.includes(aName) || aName.includes(badge))) ||
             (aUser && (badge.includes(aUser) || aUser.includes(badge)));
    });
    if (foundByBadge && foundByBadge.email) return foundByBadge.email.toLowerCase().trim();

    return email;
  };

  const filteredChats = chats.filter((chat) => {
    // 1. Strictly verify chat belongs to currently CONNECTED accounts in this browser session
    if (connectedAccounts && connectedAccounts.length > 0) {
      const chatOwnerEmail = getChatOwnerEmail(chat).toLowerCase().trim();
      const chatAccId = (chat.connectedAccountId || '').toLowerCase().trim();
      const chatAccount = (chat.account || chat.company || chat.accountBadge || '').toLowerCase().trim();

      const isConnected = connectedAccounts.some(acc => {
        const accEmail = (acc.email || acc.username || '').toLowerCase().trim();
        const accName = (acc.displayName || acc.name || '').toLowerCase().trim();
        const accId = (acc._id || acc.accountId || acc.id || '').toString().toLowerCase().trim();
        const accUser = accEmail.split('@')[0];

        if (accEmail && (chatOwnerEmail === accEmail || chatOwnerEmail.includes(accEmail) || accEmail.includes(chatOwnerEmail))) return true;
        if (accId && (chatAccId === accId || chatAccId.includes(accId))) return true;
        if (accName && (chatAccount.includes(accName) || accName.includes(chatAccount))) return true;
        if (accUser && (chatAccount.includes(accUser) || chatOwnerEmail.includes(accUser) || chatAccId.includes(accUser))) return true;
        return false;
      });

      if (!isConnected) return false;
    }

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || (
      chat.participant?.toLowerCase().includes(q) ||
      chat.company?.toLowerCase().includes(q) ||
      chat.accountBadge?.toLowerCase().includes(q) ||
      chat.accountEmail?.toLowerCase().includes(q) ||
      chat.lastMessagePreview?.toLowerCase().includes(q)
    );
    if (!matchesSearch) return false;

    if (!selectedFilterAccount || selectedFilterAccount === 'all') return true;

    const filterKey = selectedFilterAccount.toLowerCase().trim();
    const filterUser = filterKey.split('@')[0];
    const chatOwnerEmail = getChatOwnerEmail(chat).toLowerCase().trim();
    const chatAccId = (chat.connectedAccountId || '').toLowerCase().trim();
    const chatAccount = (chat.account || chat.company || chat.accountBadge || '').toLowerCase().trim();

    if (chatOwnerEmail && (chatOwnerEmail === filterKey || chatOwnerEmail.includes(filterKey) || filterKey.includes(chatOwnerEmail))) return true;
    if (chatAccId && (chatAccId === filterKey || chatAccId.includes(filterKey) || filterKey.includes(chatAccId))) return true;
    if (chatAccount && (chatAccount.includes(filterKey) || filterKey.includes(chatAccount))) return true;
    if (filterUser && (chatOwnerEmail.includes(filterUser) || chatAccount.includes(filterUser) || chatAccId.includes(filterUser))) return true;

    return false;
  });

  // Set active chat instantaneously based on current filtered view
  const isSelectedChatInFiltered = filteredChats.some(c => (c._id === activeChatId || c.microsoftChatId === activeChatId || c.id === activeChatId));
  const selectedChatId = isAccountConnected 
    ? (isSelectedChatInFiltered ? activeChatId : (filteredChats.length > 0 ? (filteredChats[0]._id || filteredChats[0].microsoftChatId || filteredChats[0].id) : null))
    : null;
  const activeChat = isAccountConnected ? chats.find((c) => (c._id === selectedChatId || c.microsoftChatId === selectedChatId || c.id === selectedChatId)) : null;
  const chatOwner = activeChat?.accountEmail || activeChat?.connectedAccountId;
  const { messages, loading: messagesLoading, error: messagesError, sendMessage, toggleReaction } = useMessages(selectedChatId, chatOwner);
  const rawMessages = Array.isArray(messages) ? messages : [];
  const activeEmail = (localStorage.getItem('teamshub_active_email') || '').toLowerCase().trim();

  // Chat Composer & Attachment States
  const [draftMessage, setDraftMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showComposerEmojiPicker, setShowComposerEmojiPicker] = useState(false);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [selectedAttachments, setSelectedAttachments] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);

  const chatInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesThreadContainerRef = useRef(null);

  const getSenderString = (s) => {
    if (!s) return '';
    if (typeof s === 'string') return s;
    if (typeof s === 'object') return s.name || s.displayName || s.user?.displayName || s.email || '';
    return String(s);
  };

  const safeMessages = useMemo(() => {
    const valid = [...rawMessages].filter((m) => {
      if (!m) return false;
      const clean = (m.content || '').replace(/<[^>]*>/g, '').trim();
      const hasAttachments = Array.isArray(m.attachments) && m.attachments.length > 0;
      const hasImage = !!m.image || (m.content && m.content.includes('<img'));
      return clean.length > 0 || hasAttachments || hasImage;
    });

    const sorted = valid.sort((a, b) => {
      const tA = new Date(a.createdDateTime || a.timestamp || 0).getTime() || 0;
      const tB = new Date(b.createdDateTime || b.timestamp || 0).getTime() || 0;
      return tA - tB;
    });

    // 1. Resolve Account Owner for Active Chat (Supports Keval Trivedi, Aryan Kumrecha, etc.)
    const matchedAccount = (connectedAccounts || []).find((a) =>
      (activeChat?.connectedAccountId && (a._id === activeChat.connectedAccountId || a.id === activeChat.connectedAccountId || a.accountId === activeChat.connectedAccountId)) ||
      (activeChat?.accountEmail && a.email && a.email.toLowerCase() === activeChat.accountEmail.toLowerCase()) ||
      (activeChat?.accountBadge && a.displayName && a.displayName.toLowerCase() === activeChat.accountBadge.toLowerCase())
    );

    const ownerEmail = (matchedAccount?.email || activeChat?.accountEmail || localStorage.getItem('teamshub_active_email') || '').toLowerCase().trim();
    const ownerName = (matchedAccount?.displayName || matchedAccount?.name || activeChat?.accountBadge || activeChat?.company || localStorage.getItem('teamshub_active_name') || '').toLowerCase().replace(/[`'"\\]/g, '').trim();
    const ownerFirst = ownerName ? ownerName.split(' ')[0] : '';

    const pName = (activeChat?.participant || '').toLowerCase().replace(/[`'"\\]/g, '').trim();
    const pFirst = pName ? pName.split(' ')[0] : '';

    return sorted.map((m) => {
      const rawSender = m.senderName || m.sender;
      const senderStr = getSenderString(rawSender);
      const sName = senderStr.toLowerCase().replace(/[`'"\\]/g, '').trim();
      const sEmail = (typeof m.senderEmail === 'string' ? m.senderEmail : getSenderString(m.senderEmail)).toLowerCase().trim();

      // Check if message is from the account owner (Outgoing -> Right) or participant (Incoming -> Left)
      let isOut = false;

      // 1. If sender name is 'you' or matches account owner's email or name -> OUTGOING (Right side)
      if (
        sName === 'you' ||
        sName === 'me' ||
        (ownerEmail && sEmail && sEmail === ownerEmail) ||
        (ownerFirst && ownerFirst.length >= 2 && sName.includes(ownerFirst)) ||
        (ownerName && ownerName.length >= 2 && (sName.includes(ownerName) || ownerName.includes(sName)))
      ) {
        isOut = true;
      }
      // 2. If sender name matches the remote participant's name -> INCOMING (Left side)
      else if (
        pFirst && pFirst.length >= 2 && (sName.includes(pFirst) || (pName && sName.includes(pName)))
      ) {
        isOut = false;
      }
      // 3. Fallback to m.isOutgoing if set by Graph API
      else {
        isOut = m.isOutgoing !== undefined ? m.isOutgoing : false;
      }

      return {
        ...m,
        senderName: senderStr || (typeof m.senderName === 'string' ? m.senderName : '') || 'Teams User',
        isOutgoing: isOut
      };
    });
  }, [rawMessages, activeChat, connectedAccounts, activeEmail]);

  const prevChatIdRef = useRef(selectedChatId);
  const isChatSwitchRef = useRef(true);

  useEffect(() => {
    if (prevChatIdRef.current !== selectedChatId) {
      prevChatIdRef.current = selectedChatId;
      isChatSwitchRef.current = true;
    }
  }, [selectedChatId]);

  // Instantly snap to the bottom on chat switch, or smooth scroll on new message
  useLayoutEffect(() => {
    if (safeMessages.length > 0 && !targetMessageId && !targetKeyword) {
      const container = messagesThreadContainerRef.current;
      if (!container) return;

      if (isChatSwitchRef.current) {
        // Direct instant jump to latest message on chat switch (like Teams)
        container.scrollTop = container.scrollHeight;
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
        }

        let runs = 0;
        const pinTimer = setInterval(() => {
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
          runs++;
          if (runs >= 16) {
            clearInterval(pinTimer);
            isChatSwitchRef.current = false;
          }
        }, 50);

        return () => clearInterval(pinTimer);
      } else {
        // Smooth scroll for new message in the same chat
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        } else if (container) {
          container.scrollTop = container.scrollHeight;
        }
      }
    }
  }, [safeMessages.length, selectedChatId, targetMessageId, targetKeyword]);

  // Smooth scroll & highlight targeted search message (Bright Yellow / Glow like Teams)
  useEffect(() => {
    if ((targetMessageId || targetKeyword) && !messagesLoading && safeMessages.length > 0) {
      const timer = setTimeout(() => {
        let el = null;
        if (targetMessageId) {
          el = document.getElementById(`msg-bubble-${targetMessageId}`);
        }
        if (!el && targetKeyword) {
          const kwLower = targetKeyword.toLowerCase().trim();
          const matchedMsg = safeMessages.find((m) =>
            (m.content && m.content.toLowerCase().includes(kwLower)) ||
            (m.body && m.body.toLowerCase().includes(kwLower))
          );
          if (matchedMsg) {
            const mId = matchedMsg._id || matchedMsg.id || matchedMsg.microsoftMessageId;
            el = document.getElementById(`msg-bubble-${mId}`);
          }
        }

        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const origBg = el.style.backgroundColor;
          const origColor = el.style.color;
          const origBorder = el.style.border;
          const origShadow = el.style.boxShadow;
          const origTransform = el.style.transform;

          el.style.transition = 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
          el.style.backgroundColor = '#fef08a';
          el.style.color = '#0f172a'; // Sharp dark text for 100% readability on yellow highlight
          el.style.border = '2px solid #eab308';
          el.style.boxShadow = '0 0 24px rgba(234, 179, 8, 0.9)';
          el.style.transform = 'scale(1.04)';

          setTimeout(() => {
            el.style.backgroundColor = origBg;
            el.style.color = origColor;
            el.style.border = origBorder;
            el.style.boxShadow = origShadow;
            el.style.transform = origTransform;
            setTargetMessageId(null);
            setTargetKeyword(null);
          }, 3500);
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [targetMessageId, targetKeyword, messagesLoading, safeMessages]);
  const lastOutgoingMsgIndex = safeMessages.map(m => m.isOutgoing).lastIndexOf(true);

  // Microsoft Teams Read Receipt & Delivery Status Indices (Exact Teams Parity)
  const outgoingIndices = [];
  safeMessages.forEach((m, idx) => {
    if (m.isOutgoing) outgoingIndices.push(idx);
  });

  let lastSeenIndex = -1;
  let lastUnreadIndex = -1;

  if (outgoingIndices.length > 0) {
    const lastOutgoingIdx = outgoingIndices[outgoingIndices.length - 1];

    // Find the highest outgoing message index that is strictly confirmed as seen
    outgoingIndices.forEach((idx) => {
      const msg = safeMessages[idx];
      const hasLaterIncoming = safeMessages.slice(idx + 1).some(m => !m.isOutgoing);
      const hasRecipientReaction = (msg.reactions || []).some(r => {
        const uEmail = (r.user?.email || '').toLowerCase().trim();
        const uName = (r.user?.displayName || r.user?.name || '').toLowerCase().trim();
        return uEmail !== activeEmail && uName !== 'you';
      });
      const isExplicitlyRead = msg.isRead === true || msg.seen === true || msg.status === 'read';

      if (hasLaterIncoming || hasRecipientReaction || isExplicitlyRead) {
        lastSeenIndex = idx;
      }
    });

    // If the latest outgoing message has not been confirmed read, show Sent Checkmark on it
    if (lastSeenIndex !== lastOutgoingIdx) {
      lastUnreadIndex = lastOutgoingIdx;
    }
  }

  // Automatically mark currently opened chat as read
  useEffect(() => {
    if (selectedChatId) {
      markChatAsRead(selectedChatId, activeChat?.connectedAccountId);
    }
  }, [selectedChatId, activeChat?.connectedAccountId, markChatAsRead]);

  // Instant Teams Jump to Bottom (0ms, directly opens on the latest message)
  useLayoutEffect(() => {
    if (messagesThreadContainerRef.current) {
      messagesThreadContainerRef.current.scrollTop = messagesThreadContainerRef.current.scrollHeight;
    }
  }, [activeChatId, safeMessages.length]);

  useEffect(() => {
    // Secondary micro-adjustment for loaded images/attachments
    const timer = setTimeout(() => {
      if (messagesThreadContainerRef.current) {
        messagesThreadContainerRef.current.scrollTop = messagesThreadContainerRef.current.scrollHeight;
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [activeChatId, safeMessages.length]);

  // Format file sizes into human-readable string
  const formatFileSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Handle file picker selection
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          setSelectedImage({
            name: file.name,
            size: file.size,
            type: file.type,
            dataUrl: reader.result
          });
        };
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          const attObj = {
            id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            size: file.size,
            contentType: file.type || 'application/octet-stream',
            contentUrl: reader.result,
            dataUrl: reader.result
          };
          setSelectedAttachments((prev) => [...prev, attObj]);
        };
        reader.readAsDataURL(file);
      }
    });
    if (e.target) e.target.value = '';
  };

  // Handle drag and drop files onto the chat
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    files.forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          setSelectedImage({
            name: file.name,
            size: file.size,
            type: file.type,
            dataUrl: reader.result
          });
        };
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          const attObj = {
            id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            size: file.size,
            contentType: file.type || 'application/octet-stream',
            contentUrl: reader.result,
            dataUrl: reader.result
          };
          setSelectedAttachments((prev) => [...prev, attObj]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  // Insert emoji at current caret position in draftMessage input
  const handleInsertEmoji = (emojiChar) => {
    const input = chatInputRef.current;
    if (!input) {
      setDraftMessage((prev) => prev + emojiChar);
      return;
    }

    const start = input.selectionStart ?? draftMessage.length;
    const end = input.selectionEnd ?? draftMessage.length;
    const nextVal = draftMessage.substring(0, start) + emojiChar + draftMessage.substring(end);
    setDraftMessage(nextVal);

    setTimeout(() => {
      input.focus();
      const newCursorPos = start + emojiChar.length;
      input.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  };

  const handleSendMessage = async () => {
    if ((!draftMessage.trim() && selectedAttachments.length === 0 && !selectedImage) || isSending) return;
    const msgContent = draftMessage;
    const attsToSend = [...selectedAttachments];
    const imgToSend = selectedImage;

    setIsSending(true);
    try {
      const payload = {
        content: msgContent,
        attachments: attsToSend,
        image: imgToSend ? (imgToSend.dataUrl || imgToSend) : null
      };

      await sendMessage(payload);
      setDraftMessage('');
      setSelectedAttachments([]);
      setSelectedImage(null);
      setShowComposerEmojiPicker(false);

      // Immediately bump active chat to the top of the chat list with latest message preview
      if (selectedChatId) {
        const previewText = msgContent || (imgToSend ? '📷 Photo' : '📎 Attachment');
        bumpChatToTop(selectedChatId, previewText);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Securely load proxy images inside dangerouslySetInnerHTML
  useEffect(() => {
    const loadSecureImages = async () => {
      const imgElements = document.querySelectorAll('.message-html-content img');
      if (imgElements.length === 0) return;
      
      const targetAccount = activeChat?.accountEmail || activeChat?.email || activeChat?.company || activeChat?.connectedAccountId;
      const token = await acquireGraphToken(targetAccount);

      imgElements.forEach(async (img) => {
        const src = img.getAttribute('src');
        // Only process unresolved proxy URLs
        if (src && (src.startsWith('/api/chats/') || src.includes('/api/chats/')) && !img.dataset.loaded) {
          img.dataset.loaded = 'true'; 
          try {
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await fetch(src, { headers });
            if (res.ok) {
              const contentType = res.headers.get('content-type') || 'image/jpeg';
              const blob = await res.blob();
              const objectUrl = URL.createObjectURL(blob);
              img.src = objectUrl;
              img.style.cursor = 'pointer';
              img.title = 'Click to preview';
              img.onclick = () => {
                setPreviewDocModal({
                  name: 'Teams Photo Attachment',
                  contentType: contentType,
                  previewUrl: objectUrl,
                  webUrl: objectUrl,
                  category: 'Images'
                });
              };
            }
          } catch (e) {
            console.error('Failed to load secure image', e);
          }
        }
      });
    };

    if (messages && messages.length > 0) {
      loadSecureImages();
    }
  }, [messages, activeChat]);

  return (
    <div className="chats-page-container" style={{ flex: 1, display: 'flex', overflow: 'hidden', height: '100%' }}>
      {/* Sidebar Chat List Pane */}
      <div className={`chats-sidebar-pane ${activeChatId ? 'mobile-hidden' : ''}`} style={{
        width: '360px',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header & Filter Controls */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Teams Conversations</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={refresh}
                disabled={refreshing}
                title="Refresh Graph Chats"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.8rem',
                  fontWeight: '600'
                }}
              >
                <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
                <span>{refreshing ? 'Syncing...' : 'Sync'}</span>
              </button>
            </div>
          </div>

          {/* Account Filter Chips Bar */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            alignItems: 'center',
            paddingBottom: '4px'
          }}>
            <button
              onClick={() => setSelectedFilterAccount('all')}
              title="Show chats from all connected accounts"
              style={{
                padding: '5px 10px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.75rem',
                fontWeight: selectedFilterAccount === 'all' ? '700' : '600',
                backgroundColor: selectedFilterAccount === 'all' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                color: selectedFilterAccount === 'all' ? '#ffffff' : 'var(--text-secondary)',
                border: selectedFilterAccount === 'all' ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                boxShadow: selectedFilterAccount === 'all' ? '0 2px 8px rgba(79, 70, 229, 0.28)' : 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.18s ease'
              }}
            >
              <span>✨</span>
              <span>All Accounts</span>
              <span style={{
                backgroundColor: selectedFilterAccount === 'all' ? 'rgba(255,255,255,0.25)' : 'var(--bg-secondary)',
                padding: '1px 5px',
                borderRadius: '10px',
                fontSize: '0.7rem',
                fontWeight: '700'
              }}>
                {connectedAccounts.length}
              </span>
            </button>

            {connectedAccounts.map((acc) => {
              const accEmailKey = (acc.email || acc.username || acc._id || acc.accountId || acc.id || '').toLowerCase().trim();
              const isSelected = selectedFilterAccount === accEmailKey || (selectedFilterAccount && (
                selectedFilterAccount === (acc._id || '').toString() ||
                selectedFilterAccount === (acc.accountId || '').toString() ||
                selectedFilterAccount === (acc.email || '').toLowerCase() ||
                selectedFilterAccount === (acc.username || '').toLowerCase()
              ));
              const rawName = acc.displayName || acc.company || acc.email?.split('@')[0] || 'Account';
              const name = rawName.replace(/[`'"]/g, '').trim();
              const initial = (name[0] || 'A').toUpperCase();
              return (
                <button
                  key={acc._id || acc.email || acc.accountId}
                  onClick={() => {
                    setSelectedFilterAccount(accEmailKey);
                  }}
                  title={`${name} (${acc.email || ''})`}
                  style={{
                    padding: '4px 10px 4px 6px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.75rem',
                    fontWeight: isSelected ? '700' : '600',
                    backgroundColor: isSelected ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                    color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                    border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                    boxShadow: isSelected ? '0 2px 8px rgba(79, 70, 229, 0.28)' : 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.18s ease'
                  }}
                >
                  <span style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: isSelected ? 'rgba(255,255,255,0.3)' : getAvatarColor(name),
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.65rem',
                    fontWeight: '700',
                    flexShrink: 0
                  }}>
                    {initial}
                  </span>
                  <span style={{
                    maxWidth: '130px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {name}
                  </span>
                </button>
              );
            })}
          </div>
          
          {/* Search Bar */}
          <div style={{ marginTop: '12px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '50%', left: '12px', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
              <Search size={16} />
            </div>
            <input
              type="text"
              placeholder="Search by name, company, or message..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none',
                transition: 'border-color var(--transition-fast)'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
            />
          </div>
        </div>

        {/* Unified Chat List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {chatsLoading && chats.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' }}>
              {[1, 2, 3, 4].map((n) => (
                <div key={n} style={{ height: '64px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', opacity: 0.6 }} />
              ))}
            </div>
          ) : !isAccountConnected || chats.length === 0 ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {!isAccountConnected ? (
                <>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--accent-light)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                    <Lock size={24} />
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>No Account Connected</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px', maxWidth: '220px' }}>
                    Connect your Microsoft Teams account to view your live chats.
                  </div>
                  <button
                    onClick={onOpenMicrosoftModal}
                    className="btn btn-primary"
                    style={{ fontSize: '0.8rem', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <LogIn size={14} /> Connect Account
                  </button>
                </>
              ) : (
                <>
                  <MessageSquare size={32} style={{ marginBottom: '8px', opacity: 0.6 }} />
                  <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>No conversations found</div>
                  <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>Your Teams conversations will appear here.</div>
                </>
              )}
            </div>
          ) : filteredChats.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Search size={32} style={{ marginBottom: '8px', opacity: 0.6, margin: '0 auto' }} />
              <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>No results found</div>
              <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>Try a different search term.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filteredChats.map((chat) => {
                const chatId = chat._id || chat.microsoftChatId || chat.id;
                const isSelected = selectedChatId === chatId;
                return (
                  <div
                    key={chatId}
                    onClick={() => {
                      setActiveChatId(chatId);
                      markChatAsRead(chatId, chat.connectedAccountId);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: isSelected ? 'var(--accent-light)' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--accent-primary)' : '3px solid transparent',
                      cursor: 'pointer',
                      transition: 'background-color var(--transition-fast)'
                    }}
                  >
                    <div style={{ position: 'relative' }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        backgroundColor: getAvatarColor(chat.participant),
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '600',
                        fontSize: '1rem',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}>
                        {getInitials(chat.participant)}
                      </div>
                      {/* Online Status Indicator */}
                      <div style={{
                        position: 'absolute',
                        bottom: '-2px',
                        right: '-2px',
                        width: '14px',
                        height: '14px',
                        backgroundColor: '#22c55e',
                        border: '2px solid var(--bg-secondary)',
                        borderRadius: '50%'
                      }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontWeight: isSelected ? '700' : '600', fontSize: '0.88rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {chat.participant}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          <span style={{ fontSize: '0.72rem', color: isSelected ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                            {chat.lastMessageTimestamp ? new Date(chat.lastMessageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                          {chat.unreadCount > 0 && (
                            <div style={{
                              backgroundColor: '#ef4444',
                              color: '#fff',
                              fontSize: '0.65rem',
                              fontWeight: 'bold',
                              padding: '1px 6px',
                              borderRadius: '10px',
                              minWidth: '16px',
                              textAlign: 'center',
                              boxShadow: '0 1px 2px rgba(239, 68, 68, 0.3)'
                            }}>
                              {chat.unreadCount}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginBottom: '4px' }}>
                        {formatChatPreview(chat.lastMessagePreview)}
                      </div>

                      {/* Parent Company Account Badge */}
                      <span className={`badge ${chat.accountBadge || 'badge-company-a'}`} style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                        {chat.company}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Conversation Thread View Pane */}
      <div className={`chats-active-pane ${!activeChatId ? 'mobile-hidden' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
        {isAccountConnected && activeChat ? (
          <>
            {/* Conversation Header */}
            <div style={{
              height: '64px',
              padding: '0 24px',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  className="mobile-back-btn"
                  onClick={() => setActiveChatId(null)}
                  title="Back to conversation list"
                >
                  <ArrowLeft size={16} />
                  <span>Back</span>
                </button>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: getAvatarColor(activeChat.participant),
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '600',
                    fontSize: '1rem',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>
                    {getInitials(activeChat.participant)}
                  </div>
                  {/* Online Status Indicator */}
                  <div style={{
                    position: 'absolute',
                    bottom: '-2px',
                    right: '-2px',
                    width: '12px',
                    height: '12px',
                    backgroundColor: '#22c55e',
                    border: '2px solid var(--bg-secondary)',
                    borderRadius: '50%'
                  }} />
                </div>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {activeChat.participant}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e',
                      padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '700'
                    }}>
                      <div style={{ width: '6px', height: '6px', backgroundColor: '#22c55e', borderRadius: '50%', boxShadow: '0 0 6px #22c55e' }} />
                      LIVE
                    </div>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {activeChat.role} • <strong style={{ color: 'var(--accent-primary)' }}>{activeChat.company}</strong>
                  </div>
                </div>
              </div>

              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                color: 'var(--accent-primary)',
                fontSize: '0.78rem',
                fontWeight: '600'
              }}>
                <ShieldCheck size={14} />
                <span>Microsoft Graph Connected</span>
              </div>
            </div>

            {/* Messages Thread List */}
            <div ref={messagesThreadContainerRef} key={selectedChatId} style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {messagesLoading ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: '40px' }}>Loading conversation history...</div>
              ) : messagesError ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: '40px', maxWidth: '420px', margin: '0 auto' }}>
                  <AlertCircle size={36} color="var(--accent-primary)" style={{ marginBottom: '12px', opacity: 0.9 }} />
                  <div style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '6px' }}>
                    Microsoft Authentication Required
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '18px', lineHeight: '1.5' }}>
                    Sign in with your Microsoft Teams account to sync live Graph messages for this conversation.
                  </div>
                  <button className="btn btn-primary" onClick={() => onOpenMicrosoftModal && onOpenMicrosoftModal()} style={{ margin: '0 auto', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <LogIn size={16} />
                    <span>Sign in with Microsoft</span>
                  </button>
                </div>
              ) : safeMessages.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: '40px' }}>No messages in this conversation.</div>
              ) : (
                safeMessages.map((msg, index) => {
                  const prevMsg = index > 0 ? safeMessages[index - 1] : null;
                  const msgId = msg.microsoftMessageId || msg._id || msg.id || `msg-${index}`;
                  
                  // Group reactions by type for clean pill badges
                  const rawReactions = Array.isArray(msg.reactions) ? msg.reactions : [];
                  const groupedReactions = {};
                  rawReactions.forEach((r) => {
                    const type = (typeof r === 'string' ? r : r.reactionType || 'like').toLowerCase();
                    const emoji = getEmojiForReactionType(type);
                    if (!groupedReactions[type]) {
                      groupedReactions[type] = { type, emoji, count: 0, users: [], hasUserReacted: false };
                    }
                    groupedReactions[type].count += 1;
                    const userName = r.user?.displayName || r.user?.name || (r.user?.email ? r.user.email.split('@')[0] : 'User');
                    groupedReactions[type].users.push(userName);
                    if (r.user?.email?.toLowerCase() === activeEmail || userName === 'You') {
                      groupedReactions[type].hasUserReacted = true;
                    }
                  });
                  const reactionList = Object.values(groupedReactions);
                  const activeUserReactions = reactionList.filter((r) => r.hasUserReacted).map((r) => r.type);
                  
                  // Date divider check
                  const prevDate = prevMsg ? new Date(prevMsg.createdDateTime).toDateString() : null;
                  const currDate = new Date(msg.createdDateTime).toDateString();
                  const showDateDivider = prevDate !== currDate;

                  const isSameSenderAsPrev = prevMsg && prevMsg.isOutgoing === msg.isOutgoing && prevMsg.senderName === msg.senderName;
                  
                  // Show sender header if sender changed, date changed, or >5 mins apart
                  let showHeader = !isSameSenderAsPrev || showDateDivider;
                  if (isSameSenderAsPrev && !showDateDivider) {
                    const prevTime = new Date(prevMsg.createdDateTime).getTime();
                    const currTime = new Date(msg.createdDateTime).getTime();
                    if (currTime - prevTime > 5 * 60 * 1000) {
                      showHeader = true;
                    }
                  }

                  return (
                    <React.Fragment key={msgId}>
                      {showDateDivider && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '20px 0 12px 0',
                          position: 'relative'
                        }}>
                          <div style={{ position: 'absolute', left: 0, right: 0, height: '1px', backgroundColor: 'var(--border-color)' }} />
                          <span style={{
                            position: 'relative',
                            backgroundColor: 'var(--bg-secondary)',
                            padding: '4px 14px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border-color)'
                          }}>
                            {formatMessageDate(msg.createdDateTime)}
                          </span>
                        </div>
                      )}

                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'row',
                          alignItems: 'flex-start',
                          justifyContent: msg.isOutgoing ? 'flex-end' : 'flex-start',
                          marginTop: showHeader && index !== 0 ? '14px' : '4px',
                          width: '100%',
                          gap: '10px'
                        }}
                      >
                        {/* Show Avatar ONLY for Incoming Messages on Left */}
                        {!msg.isOutgoing && (
                          <div style={{ width: '32px', height: '32px', flexShrink: 0, marginTop: '2px', opacity: showHeader ? 1 : 0 }}>
                            <div className="avatar-3d" style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: getAvatarColor(msg.senderName),
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: '700',
                              fontSize: '0.78rem'
                            }}>
                              {getInitials(msg.senderName)}
                            </div>
                          </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: msg.isOutgoing ? 'flex-end' : 'flex-start', maxWidth: '82%', minWidth: 0 }}>
                          {showHeader && (
                            <div style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)',
                              marginBottom: '4px',
                              padding: '0 2px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              {!msg.isOutgoing && (
                                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{msg.senderName}</span>
                              )}
                              <span>{new Date(msg.createdDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          )}

                          <div
                            style={{ position: 'relative', width: 'fit-content', maxWidth: '100%' }}
                            onMouseEnter={() => setHoveredMessageId(msgId)}
                            onMouseLeave={() => setHoveredMessageId((curr) => (curr === msgId ? null : curr))}
                          >
                            {/* Floating Hover Reactions Bar (Microsoft Teams Parity) */}
                            {hoveredMessageId === msgId && (
                              <MessageReactionsBar
                                isOutgoing={msg.isOutgoing}
                                activeUserReactions={activeUserReactions}
                                onSelectReaction={(reactionType) => {
                                  toggleReaction(msgId, reactionType, rawReactions);
                                }}
                              />
                            )}

                            <div 
                              id={`msg-bubble-${msgId}`}
                              className={msg.isOutgoing ? 'teams-msg-outgoing' : 'teams-msg-incoming'}
                              style={{
                                padding: '10px 14px',
                                borderRadius: msg.isOutgoing ? '12px 8px 12px 12px' : '8px 12px 12px 12px',
                                backgroundColor: msg.isOutgoing ? 'var(--accent-light)' : 'var(--bg-secondary)',
                                color: msg.isOutgoing ? 'var(--accent-text)' : 'var(--text-primary)',
                                fontSize: '0.9rem',
                                lineHeight: '1.45',
                                border: msg.isOutgoing ? '1px solid rgba(99, 102, 241, 0.25)' : '1px solid var(--border-color)',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                wordBreak: 'break-word',
                                overflow: 'hidden'
                              }}
                            >
                              {/* Quoted Message Reference Box (Teams-style Reply) */}
                              {msg.quoteReply && msg.quoteReply.text && !msg.content?.includes('<blockquote') && (
                                <div className="teams-quote-box">
                                  <div className="teams-quote-header">
                                    <span>{msg.quoteReply.sender}</span>
                                    {msg.quoteReply.date && (
                                      <span style={{ fontSize: '0.74rem', opacity: 0.8, marginLeft: '8px', fontWeight: 'normal' }}>
                                        {new Date(msg.quoteReply.date).toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' })} {new Date(msg.quoteReply.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ color: 'var(--text-secondary)', marginTop: '2px', wordBreak: 'break-word' }}>
                                    {msg.quoteReply.text}
                                  </div>
                                </div>
                              )}

                              {msg.contentType === 'html' ? (
                                <div
                                  className="message-html-content"
                                  dangerouslySetInnerHTML={{
                                    __html: (() => {
                                      if (!msg.content) return '';
                                      const apiBase = (import.meta.env.VITE_API_BASE_URL && import.meta.env.VITE_API_BASE_URL.trim())
                                        ? import.meta.env.VITE_API_BASE_URL.trim().replace(/\/$/, '')
                                        : '';
                                      return apiBase ? msg.content.replace(/src=["'](?:\/api\/chats\/)/gi, `src="${apiBase}/api/chats/`) : msg.content;
                                    })()
                                  }}
                                  style={{ margin: 0 }}
                                  onClick={(e) => {
                                    if (e.target.tagName === 'IMG' && e.target.src) {
                                      setLightboxImage(e.target.src);
                                    }
                                  }}
                                />
                              ) : (
                                <div>{msg.content}</div>
                              )}

                              {/* Teams-Style Document Cards Grid */}
                              {msg.attachments && msg.attachments.length > 0 && (
                                <div style={{
                                  marginTop: (msg.content && msg.content.trim()) ? '10px' : '0',
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: '12px'
                                }}>
                                  {msg.attachments.map((att) => (
                                    <TeamsAttachmentCard
                                      key={att.id || att.name}
                                      attachment={att}
                                      onClick={(a) => {
                                        setPreviewDocModal({
                                          name: a.name,
                                          contentType: a.contentType,
                                          previewUrl: a.contentUrl || a.dataUrl,
                                          webUrl: a.contentUrl || a.dataUrl,
                                          downloadUrl: a.contentUrl || a.dataUrl
                                        });
                                      }}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Teams Read Receipt Status (Eye ONLY on last seen message, CheckCircle ONLY on unread message) */}
                            {msg.isOutgoing && (index === lastSeenIndex || index === lastUnreadIndex) && (
                              <div
                                title={index === lastSeenIndex ? "Seen by recipient" : "Sent"}
                                style={{
                                  position: 'absolute',
                                  bottom: '4px',
                                  right: '-24px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                {index === lastSeenIndex ? (
                                  <Eye size={15} color="#4f46e5" style={{ filter: 'drop-shadow(0 1px 2px rgba(79, 70, 229, 0.3))' }} />
                                ) : (
                                  <CheckCircle2 size={15} color="#64748b" style={{ filter: 'drop-shadow(0 1px 1px rgba(0, 0, 0, 0.1))' }} />
                                )}
                              </div>
                            )}

                            {/* Teams Reaction Pills Attached to Corner of Bubble */}
                            {reactionList.length > 0 && (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '4px',
                                position: 'absolute',
                                bottom: '-12px',
                                right: msg.isOutgoing ? '12px' : 'auto',
                                left: msg.isOutgoing ? 'auto' : '12px',
                                zIndex: 10
                              }}>
                                {reactionList.map((r) => (
                                  <div
                                    key={r.type}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleReaction(msgId, r.type, rawReactions);
                                    }}
                                    title={`Reacted by: ${r.users.join(', ')} (Click to toggle)`}
                                    style={{
                                      backgroundColor: r.hasUserReacted ? 'var(--accent-light)' : 'var(--bg-secondary)',
                                      border: r.hasUserReacted ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                      borderRadius: '12px',
                                      padding: '2px 7px',
                                      fontSize: '0.78rem',
                                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      transition: 'all 0.15s ease',
                                      userSelect: 'none'
                                    }}
                                  >
                                    <span>{r.emoji}</span>
                                    <span style={{ fontSize: '0.74rem', fontWeight: '700', color: r.hasUserReacted ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                                      {r.count}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Advanced Teams Chat Composer */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                position: 'relative',
                padding: '14px 20px',
                backgroundColor: 'var(--bg-secondary)',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              {/* Hidden File / Image Pickers */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                multiple
                accept=".pdf,.docx,.xlsx,.pptx,.txt,.zip,.csv"
                style={{ display: 'none' }}
              />
              <input
                type="file"
                ref={imageInputRef}
                accept="image/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />

              {/* Attachment Preview Tray */}
              {(selectedImage || selectedAttachments.length > 0) && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  overflowX: 'auto',
                  paddingBottom: '6px',
                  borderBottom: '1px solid var(--border-color)'
                }}>
                  {/* Selected Image Card */}
                  {selectedImage && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px',
                      padding: '6px 12px 6px 6px',
                      position: 'relative'
                    }}>
                      <img
                        src={selectedImage.dataUrl}
                        alt="Preview"
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '6px',
                          objectFit: 'cover',
                          border: '1px solid var(--border-color)'
                        }}
                      />
                      <div style={{ maxWidth: '140px' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {selectedImage.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {formatFileSize(selectedImage.size)}
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedImage(null)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex'
                        }}
                        title="Remove photo"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  {/* Selected Document Cards */}
                  {selectedAttachments.map((att) => {
                    const meta = getFileCategoryMeta(att.name, att.contentType);
                    const Icon = meta.icon;
                    return (
                      <div
                        key={att.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          backgroundColor: 'var(--bg-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '10px',
                          padding: '6px 12px',
                          position: 'relative'
                        }}
                      >
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '6px',
                          backgroundColor: meta.color,
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Icon size={16} />
                        </div>
                        <div style={{ maxWidth: '150px' }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {att.name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {formatFileSize(att.size)}
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex'
                          }}
                          title="Remove document"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Input Action Controls & Text Field */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                {/* Paperclip Button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach File (PDF, DOCX, XLSX, ZIP)"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    borderRadius: '8px',
                    padding: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                    e.currentTarget.style.color = 'var(--accent-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  <Paperclip size={19} />
                </button>

                {/* Photo / Image Upload Button */}
                <button
                  onClick={() => imageInputRef.current?.click()}
                  title="Attach Photo / Screenshot"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    borderRadius: '8px',
                    padding: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                    e.currentTarget.style.color = 'var(--accent-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  <ImageIcon size={19} />
                </button>

                {/* Emoji Selector Trigger */}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowComposerEmojiPicker((prev) => !prev)}
                    title="Insert Emoji"
                    style={{
                      background: showComposerEmojiPicker ? 'var(--accent-light)' : 'transparent',
                      border: 'none',
                      color: showComposerEmojiPicker ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      borderRadius: '8px',
                      padding: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!showComposerEmojiPicker) {
                        e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                        e.currentTarget.style.color = 'var(--accent-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!showComposerEmojiPicker) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }
                    }}
                  >
                    <Smile size={19} />
                  </button>

                  {showComposerEmojiPicker && (
                    <EmojiPicker
                      position="bottom"
                      onSelectEmoji={(emojiChar) => {
                        handleInsertEmoji(emojiChar);
                      }}
                      onClose={() => setShowComposerEmojiPicker(false)}
                    />
                  )}
                </div>

                {/* Chat Input Field */}
                <input
                  ref={chatInputRef}
                  type="text"
                  value={draftMessage}
                  onChange={(e) => setDraftMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={
                    selectedImage || selectedAttachments.length > 0
                      ? 'Add a caption...'
                      : 'Type a new message (or drop files/photos here)...'
                  }
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.92rem',
                    outline: 'none',
                    transition: 'border-color 0.15s ease'
                  }}
                  disabled={isSending}
                />

                {/* Send Button */}
                <button
                  onClick={handleSendMessage}
                  disabled={(!draftMessage.trim() && selectedAttachments.length === 0 && !selectedImage) || isSending}
                  className="btn btn-primary"
                  style={{ padding: '10px 20px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {isSending ? (
                    <RefreshCw size={16} className="spin" />
                  ) : (
                    <Send size={16} />
                  )}
                  <span>Send</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', padding: '24px', textAlign: 'center' }}>
            {!isAccountConnected ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', maxWidth: '360px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--accent-light)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldCheck size={28} />
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)' }}>Account Authentication Required</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  To access your Microsoft Teams chats, messages, and files, please connect your Microsoft account.
                </p>
                <button
                  onClick={onOpenMicrosoftModal}
                  className="btn btn-primary"
                  style={{ padding: '10px 24px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}
                >
                  <LogIn size={16} /> Connect Microsoft Account
                </button>
              </div>
            ) : (
              <div>Select a conversation to view messages</div>
            )}
          </div>
        )}
      </div>

      {/* Shared Interactive Document Preview Modal (Word, Excel, PDF, Documents) */}
      {previewDocModal && (
        <DocumentPreviewModal
          file={previewDocModal}
          accountId={activeChat?.connectedAccountId}
          onClose={() => setPreviewDocModal(null)}
        />
      )}

      {/* Full-Screen Image Lightbox Modal */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(8px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            <div style={{
              position: 'absolute',
              top: '-44px',
              right: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <a
                href={lightboxImage}
                download="teamshub-image.png"
                target="_blank"
                rel="noreferrer"
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: '#fff',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  textDecoration: 'none',
                  cursor: 'pointer'
                }}
              >
                <Download size={14} /> Download
              </a>
              <button
                onClick={() => setLightboxImage(null)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: '#fff',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <img
              src={lightboxImage}
              alt="Full resolution"
              style={{
                maxWidth: '90vw',
                maxHeight: '85vh',
                borderRadius: '12px',
                boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)',
                objectFit: 'contain'
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
