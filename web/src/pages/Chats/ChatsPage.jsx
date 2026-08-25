import React, { useState, useEffect, useRef } from 'react';
import { Search, RefreshCw, Send, Lock, ShieldCheck, CheckCircle2, MessageSquare, AlertCircle, Sparkles, FileText, Paperclip, Download, X, ExternalLink, Eye, Smile, ThumbsUp, Heart, LogIn, Check, ArrowLeft } from 'lucide-react';
import { useChats } from '../../hooks/useChats';
import { useMessages } from '../../hooks/useMessages';
import { useAuth } from '../../hooks/useAuth';
import { acquireGraphToken } from '../../services/auth/authService';
import { getInitials, getAvatarColor } from '../../utils/avatarUtils';
import DocumentPreviewModal, { getFileCategoryMeta } from '../../components/DocumentPreviewModal';

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

  const isAccountConnected = connectedAccounts && connectedAccounts.length > 0;

  const getChatOwnerEmail = (c) => {
    if (!c) return '';
    const email = (c.accountEmail || '').toLowerCase().trim();
    if (email && email.includes('@')) return email;
    const badge = (c.company || c.accountBadge || '').toLowerCase().trim();
    if (badge.includes('aryan') || badge.includes('kumrecha')) return 'aryankumar.kumrecha@estatic-infotech.com';
    if (badge.includes('keval') || badge.includes('trivedi')) return 'keval.trivedi@estatic-infotech.com';
    const accId = (c.connectedAccountId || '').toLowerCase().trim();
    if (accId.includes('aryan') || accId.includes('kumrecha')) return 'aryankumar.kumrecha@estatic-infotech.com';
    if (accId.includes('keval') || accId.includes('trivedi')) return 'keval.trivedi@estatic-infotech.com';
    return email;
  };

  const filteredChats = chats.filter((chat) => {
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
    const chatOwnerEmail = getChatOwnerEmail(chat);

    // 1. Account Specific Matching
    if (filterKey.includes('aryan') || filterKey.includes('kumrecha')) {
      return chatOwnerEmail.includes('aryan') || chatOwnerEmail.includes('kumrecha');
    }
    if (filterKey.includes('keval') || filterKey.includes('trivedi')) {
      return chatOwnerEmail.includes('keval') || chatOwnerEmail.includes('trivedi');
    }

    // 2. Exact email or account ID match
    const chatAccId = (chat.connectedAccountId || '').toLowerCase().trim();
    return chatOwnerEmail === filterKey || chatAccId === filterKey;
  });

  // Set first chat as active on initial load only when an account is connected
  const selectedChatId = isAccountConnected ? (activeChatId || (filteredChats.length > 0 ? (filteredChats[0]._id || filteredChats[0].microsoftChatId || filteredChats[0].id) : (chats.length > 0 ? (chats[0]._id || chats[0].microsoftChatId || chats[0].id) : null))) : null;
  const activeChat = isAccountConnected ? chats.find((c) => (c._id === selectedChatId || c.microsoftChatId === selectedChatId || c.id === selectedChatId)) : null;
  const chatOwner = activeChat?.accountEmail || activeChat?.connectedAccountId;
  const { messages, loading: messagesLoading, error: messagesError, sendMessage } = useMessages(selectedChatId, chatOwner);
  const rawMessages = Array.isArray(messages) ? messages : [];
  const activeEmail = (localStorage.getItem('teamshub_active_email') || '').toLowerCase().trim();

  const getSenderString = (s) => {
    if (!s) return '';
    if (typeof s === 'string') return s;
    if (typeof s === 'object') return s.name || s.displayName || s.user?.displayName || s.email || '';
    return String(s);
  };

  const safeMessages = rawMessages.map((m) => {
    const rawSender = m.senderName || m.sender;
    const senderStr = getSenderString(rawSender);
    const sName = senderStr.toLowerCase().trim();
    const sEmail = (typeof m.senderEmail === 'string' ? m.senderEmail : getSenderString(m.senderEmail)).toLowerCase().trim();
    const pName = (activeChat?.participant || '').toLowerCase().trim();
    const pFirst = pName ? pName.split(' ')[0] : '';

    let isOut = m.isOutgoing;

    // In a 1:1 conversation:
    // If the message sender is the participant (e.g. "Hem Shah"), it MUST be on the LEFT side (isOutgoing = false).
    // If the message sender is NOT the participant (e.g. "Aryan Kumrecha" / "You"), it MUST be on the RIGHT side (isOutgoing = true).
    if (pFirst && pFirst.length >= 2 && (sName.includes(pFirst) || (pName && sName.includes(pName)))) {
      isOut = false;
    } else {
      isOut = true;
    }

    return {
      ...m,
      senderName: senderStr || (typeof m.senderName === 'string' ? m.senderName : '') || 'Teams User',
      isOutgoing: isOut
    };
  });

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

  // Microsoft Teams Read Receipt & Delivery Status Indices
  let lastSeenIndex = -1;
  let lastUnreadIndex = -1;
  safeMessages.forEach((m, idx) => {
    if (m.isOutgoing) {
      const hasLaterIncoming = safeMessages.slice(idx + 1).some(other => !other.isOutgoing);
      const isRead = m.isRead === true || m.seen === true || m.status === 'read' || hasLaterIncoming;
      if (isRead) {
        lastSeenIndex = idx;
      } else {
        lastUnreadIndex = idx;
      }
    }
  });
  const [draftMessage, setDraftMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const messagesEndRef = useRef(null);

  // Automatically mark currently opened chat as read
  useEffect(() => {
    if (selectedChatId) {
      markChatAsRead(selectedChatId, activeChat?.connectedAccountId);
    }
  }, [selectedChatId, activeChat?.connectedAccountId, markChatAsRead]);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!draftMessage.trim() || isSending) return;
    const msgContent = draftMessage;
    setIsSending(true);
    try {
      await sendMessage(msgContent);
      setDraftMessage('');
      // Immediately bump active chat to the top of the chat list with latest message preview
      if (selectedChatId) {
        bumpChatToTop(selectedChatId, msgContent);
      }
    } catch (err) {
      // Handle error gracefully
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
                    setActiveAccount(acc);
                    setActiveChatId(null);
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
          {chatsLoading ? (
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
                        {chat.lastMessagePreview}
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
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                  const msgId = msg._id || msg.id || msg.microsoftMessageId || `msg-${index}`;
                  const graphReactions = (msg.reactions || []).map((r) => {
                    const type = (r.reactionType || r.type || '').toLowerCase();
                    if (type === 'like' || type === 'thumbsup') return '👍';
                    if (type === 'heart' || type === 'love') return '❤️';
                    if (type === 'laugh') return '😂';
                    if (type === 'surprised') return '😮';
                    if (type === 'sad') return '😢';
                    return '👍';
                  });
                  const currentReactions = graphReactions;
                  
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
                          marginTop: showHeader && index !== 0 ? '14px' : '3px',
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

                          <div style={{ position: 'relative', width: 'fit-content', maxWidth: '100%' }}>
                            <div 
                              id={`msg-bubble-${msg._id || msg.id || msg.microsoftMessageId || `msg-${index}`}`}
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
                                    setPreviewDocModal({
                                      name: 'Image Attachment',
                                      contentType: 'image/jpeg',
                                      previewUrl: e.target.src,
                                      webUrl: e.target.src,
                                      category: 'Images'
                                    });
                                  }
                                }}
                              />
                            ) : (
                              msg.content
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
                                    key={att.id}
                                    attachment={att}
                                    onClick={(a) => {
                                      setPreviewDocModal({
                                        name: a.name,
                                        contentType: a.contentType,
                                        previewUrl: a.contentUrl,
                                        webUrl: a.contentUrl,
                                        downloadUrl: a.contentUrl
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
                          {currentReactions.length > 0 && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              position: 'absolute',
                              bottom: '-12px',
                              right: msg.isOutgoing ? '12px' : 'auto',
                              left: msg.isOutgoing ? 'auto' : '12px',
                              zIndex: 10
                            }}>
                              {currentReactions.map((emoji) => (
                                <div
                                  key={emoji}
                                  onClick={() => handleToggleReaction(msgId, emoji, graphReactions)}
                                  style={{
                                    backgroundColor: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    padding: '2px 6px',
                                    fontSize: '0.78rem',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '2px'
                                  }}
                                >
                                  <span>{emoji}</span>
                                </div>
                              ))}

                              <button
                                onClick={() => handleToggleReaction(msgId, '👍', graphReactions)}
                                style={{
                                  backgroundColor: '#ffffff',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '50%',
                                  width: '22px',
                                  height: '22px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                                  color: '#64748b'
                                }}
                                title="Add reaction"
                              >
                                <Smile size={13} />
                              </button>
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

            {/* Phase 5 Chat Composer */}
            <div style={{
              padding: '16px 24px',
              backgroundColor: 'var(--bg-secondary)',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <input
                type="text"
                value={draftMessage}
                onChange={(e) => setDraftMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendMessage();
                }}
                placeholder="Type a new message..."
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.92rem',
                  outline: 'none'
                }}
                disabled={isSending}
              />
              <button
                onClick={handleSendMessage}
                disabled={!draftMessage.trim() || isSending}
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

      {/* Shared Interactive Document Preview Modal (Word, Excel, PDF, Images) */}
      {previewDocModal && (
        <DocumentPreviewModal
          file={previewDocModal}
          accountId={activeChat?.connectedAccountId}
          onClose={() => setPreviewDocModal(null)}
        />
      )}
    </div>
  );
}
