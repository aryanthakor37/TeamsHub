import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Send, ShieldCheck, CheckCircle2, MessageSquare, AlertCircle,
  FileText, Paperclip, Image as ImageIcon, Download, X, ExternalLink,
  Eye, Smile, LogIn, ArrowLeft, Columns, ChevronDown, Split, Search
} from 'lucide-react';
import { useMessages } from '../../hooks/useMessages';
import { useAuth } from '../../hooks/useAuth';
import { getAvatarColor, getInitials } from '../../utils/avatarUtils';
import { getFileCategoryMeta } from '../../components/DocumentPreviewModal';
import EmojiPicker from '../../components/EmojiPicker';
import MessageReactionsBar, { getEmojiForReactionType } from '../../components/MessageReactionsBar';

// Helper to format date divider headers like Teams
const formatMessageDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
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
        width: '240px',
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
      title={`Click to preview ${fileName}`}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 10px',
        backgroundColor: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
          <div style={{
            width: '22px',
            height: '22px',
            borderRadius: '4px',
            backgroundColor: meta.color,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: '0.62rem',
            fontWeight: 'bold'
          }}>
            {meta.category === 'Word' ? 'W' : meta.category === 'Excel' ? 'X' : meta.category === 'PDF' ? 'PDF' : <Icon size={12} />}
          </div>
          <span style={{
            fontSize: '0.78rem',
            fontWeight: '600',
            color: '#1e293b',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {fileName}
          </span>
        </div>
        <ExternalLink size={12} style={{ color: '#64748b', flexShrink: 0 }} />
      </div>
    </div>
  );
}

export default function ChatConversationPane({
  chat,
  allChats = [],
  onSelectChat,
  isSplit = false,
  isSplitSecondPane = false,
  onToggleSplit,
  onCloseSplit,
  onOpenMicrosoftModal,
  onPreviewDoc,
  onBack,
  bumpChatToTop,
  paneTitle = '',
  paneIndex = 1
}) {
  const { connectedAccounts } = useAuth();
  const [showSwitchDropdown, setShowSwitchDropdown] = useState(false);
  const [switchSearchQuery, setSwitchSearchQuery] = useState('');
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
  const switchSearchInputRef = useRef(null);

  // Keyboard shortcut listener: Alt+1 and Alt+2 to focus composers
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && (e.key === '1' || e.key === '2')) {
        const target = e.key === '1' ? 1 : 2;
        if (paneIndex === target) {
          e.preventDefault();
          chatInputRef.current?.focus();
        }
      }
      if (e.key === 'Escape') {
        setShowSwitchDropdown(false);
        setShowComposerEmojiPicker(false);
        setLightboxImage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [paneIndex]);

  // Focus switch search input when switch dropdown opens
  useEffect(() => {
    if (showSwitchDropdown) {
      setTimeout(() => switchSearchInputRef.current?.focus(), 50);
    } else {
      setSwitchSearchQuery('');
    }
  }, [showSwitchDropdown]);

  // Group chats by account / company for Switch Dropdown
  const groupedSwitchChats = useMemo(() => {
    const q = switchSearchQuery.toLowerCase().trim();
    const filtered = allChats.filter(c => {
      if (!q) return true;
      return (
        c.participant?.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.accountBadge?.toLowerCase().includes(q) ||
        c.accountEmail?.toLowerCase().includes(q) ||
        c.lastMessagePreview?.toLowerCase().includes(q)
      );
    });

    const groups = {};
    filtered.forEach(c => {
      const rawBadge = (c.accountBadge || c.company || c.accountEmail || 'Other Account').trim();
      const groupName = rawBadge.includes('@') ? rawBadge.split('@')[0] : rawBadge;
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(c);
    });

    return groups;
  }, [allChats, switchSearchQuery]);

  const chatId = chat?._id || chat?.microsoftChatId || chat?.id;
  const chatOwner = chat?.accountEmail || chat?.connectedAccountId;

  const { messages, loading: messagesLoading, error: messagesError, sendMessage, toggleReaction } = useMessages(chatId, chatOwner);
  const rawMessages = Array.isArray(messages) ? messages : [];
  const activeEmail = (localStorage.getItem('teamshub_active_email') || '').toLowerCase().trim();

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

    // Resolve Account Owner for Active Chat
    const matchedAccount = (connectedAccounts || []).find((a) =>
      (chat?.connectedAccountId && (a._id === chat.connectedAccountId || a.id === chat.connectedAccountId || a.accountId === chat.connectedAccountId)) ||
      (chat?.accountEmail && a.email && a.email.toLowerCase() === chat.accountEmail.toLowerCase()) ||
      (chat?.accountBadge && a.displayName && a.displayName.toLowerCase() === chat.accountBadge.toLowerCase())
    );

    const ownerEmail = (matchedAccount?.email || chat?.accountEmail || localStorage.getItem('teamshub_active_email') || '').toLowerCase().trim();
    const ownerName = (matchedAccount?.displayName || matchedAccount?.name || chat?.accountBadge || chat?.company || localStorage.getItem('teamshub_active_name') || '').toLowerCase().replace(/[`'"\\]/g, '').trim();
    const ownerFirst = ownerName ? ownerName.split(' ')[0] : '';
    const pName = (chat?.participant || '').toLowerCase().replace(/[`'"\\]/g, '').trim();

    return sorted.map((m) => {
      const rawSender = m.senderName || m.sender;
      const senderStr = getSenderString(rawSender);
      const cleanSender = senderStr.toLowerCase().replace(/[`'"\\]/g, '').trim();
      const senderFirst = cleanSender ? cleanSender.split(' ')[0] : '';

      const isMeByEmail = ownerEmail && (m.senderEmail?.toLowerCase() === ownerEmail || m.email?.toLowerCase() === ownerEmail || cleanSender.includes(ownerEmail));
      const isMeByName = (
        cleanSender === 'you' ||
        cleanSender === 'aryan kumrecha' ||
        cleanSender === 'keval trivedi' ||
        cleanSender === 'kaushal nimavat' ||
        (ownerFirst && senderFirst === ownerFirst) ||
        (ownerName && (cleanSender === ownerName || cleanSender.includes(ownerName) || ownerName.includes(cleanSender)))
      );

      const isOutgoing = m.isOutgoing !== undefined
        ? m.isOutgoing
        : (isMeByEmail || isMeByName);

      let resolvedSenderName = isOutgoing ? (ownerName ? (ownerName.charAt(0).toUpperCase() + ownerName.slice(1)) : 'You') : (senderStr || pName || 'Teams User');

      return {
        ...m,
        isOutgoing,
        senderName: resolvedSenderName
      };
    });
  }, [rawMessages, chat, connectedAccounts]);

  // Auto scroll to bottom
  useEffect(() => {
    if (messagesThreadContainerRef.current) {
      messagesThreadContainerRef.current.scrollTop = messagesThreadContainerRef.current.scrollHeight;
    }
  }, [safeMessages]);

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const textToSend = draftMessage.trim();
    const imageToSend = selectedImage;
    const attachmentsToSend = [...selectedAttachments];

    if (!textToSend && !imageToSend && attachmentsToSend.length === 0) return;

    setIsSending(true);
    setDraftMessage('');
    setSelectedImage(null);
    setSelectedAttachments([]);
    setShowComposerEmojiPicker(false);

    if (bumpChatToTop && chatId) {
      bumpChatToTop(chatId, textToSend || (imageToSend ? 'Sent a photo' : 'Sent an attachment'));
    }

    try {
      await sendMessage(textToSend, attachmentsToSend, imageToSend);
    } catch (err) {
      console.warn('Send message error:', err);
    } finally {
      setIsSending(false);
      chatInputRef.current?.focus();
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach((file) => {
      const isImg = file.type.startsWith('image/');
      const reader = new FileReader();

      reader.onload = (event) => {
        const dataUrl = event.target.result;
        if (isImg) {
          setSelectedImage({
            name: file.name,
            contentType: file.type,
            size: file.size,
            dataUrl
          });
        } else {
          setSelectedAttachments((prev) => [
            ...prev,
            {
              id: `att-${Date.now()}-${Math.random()}`,
              name: file.name,
              contentType: file.type,
              size: file.size,
              dataUrl
            }
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const isPane2 = paneIndex === 2;
  const paneTheme = isPane2 ? {
    accentColor: '#0284c7', // Ocean Cyan / Sky
    accentHover: '#0369a1',
    accentLight: 'rgba(2, 132, 199, 0.12)',
    bubbleBg: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
    bubbleShadow: '0 3px 10px rgba(2, 132, 199, 0.35)',
    headerBadgeBg: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
    headerBadgeText: '#ffffff',
    pillText: '2️⃣ PANE 2 • DUAL',
    glowBorder: '1px solid rgba(6, 182, 212, 0.3)',
    headerBgTint: 'rgba(2, 132, 199, 0.04)',
    sendBtnBg: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)'
  } : {
    accentColor: '#4f46e5', // Indigo / Purple
    accentHover: '#4338ca',
    accentLight: 'rgba(79, 70, 229, 0.12)',
    bubbleBg: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
    bubbleShadow: '0 3px 10px rgba(79, 70, 229, 0.32)',
    headerBadgeBg: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
    headerBadgeText: '#ffffff',
    pillText: '1️⃣ PANE 1 • PRIMARY',
    glowBorder: '1px solid rgba(99, 102, 241, 0.3)',
    headerBgTint: 'rgba(79, 70, 229, 0.04)',
    sendBtnBg: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)'
  };

  if (!chat) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
        <MessageSquare size={36} style={{ opacity: 0.3, marginBottom: '8px' }} />
        <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>Select a conversation</div>
      </div>
    );
  }

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--bg-primary)',
      borderRight: isSplit && !isSplitSecondPane ? '2px solid var(--border-color)' : 'none',
      minWidth: 0,
      height: '100%',
      position: 'relative'
    }}>
      {/* Pane Header with Distinct Account Tint */}
      <div style={{
        height: '64px',
        padding: '0 18px',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-glass)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: 'var(--shadow-sm)',
        zIndex: 5,
        gap: '10px'
      }}>
        {/* Left: Participant Info + Pane Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
          {onBack && (
            <button
              className="mobile-back-btn"
              onClick={onBack}
              title="Back to list"
            >
              <ArrowLeft size={16} />
            </button>
          )}

          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div className="avatar-3d" style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: getAvatarColor(chat.participant),
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              fontSize: '0.9rem',
              boxShadow: '0 3px 8px rgba(0,0,0,0.12)'
            }}>
              {getInitials(chat.participant)}
            </div>
            <div className="live-pulse-dot" style={{
              position: 'absolute',
              bottom: '0px',
              right: '0px',
              width: '10px',
              height: '10px',
              backgroundColor: '#10b981',
              border: '2px solid var(--bg-secondary)',
              borderRadius: '50%'
            }} />
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontWeight: '800',
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{chat.participant}</span>
              
              {/* Split Mode Pane Tag */}
              {isSplit && (
                <span style={{
                  padding: '2px 7px',
                  borderRadius: '6px',
                  background: paneTheme.headerBadgeBg,
                  color: paneTheme.headerBadgeText,
                  fontSize: '0.64rem',
                  fontWeight: '800',
                  letterSpacing: '0.02em',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                  flexShrink: 0
                }}>
                  {paneTheme.pillText}
                </span>
              )}

              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                backgroundColor: 'rgba(16, 185, 129, 0.14)', color: '#10b981',
                padding: '1px 6px', borderRadius: '10px', fontSize: '0.62rem', fontWeight: '800',
                flexShrink: 0
              }}>
                <div style={{ width: '5px', height: '5px', backgroundColor: '#10b981', borderRadius: '50%' }} />
                LIVE
              </div>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <strong style={{ color: paneTheme.accentColor, fontWeight: '700' }}>{chat.company || chat.accountBadge || 'Teams'}</strong>
              {chat.accountEmail ? ` • ${chat.accountEmail}` : ''}
            </div>
          </div>
        </div>

        {/* Right: Split View Controls & Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Quick Switch Dropdown for Split Mode */}
          {isSplit && (
            <div style={{ position: 'relative' }}>
              <button
                className="tab-pill-3d"
                onClick={() => setShowSwitchDropdown(!showSwitchDropdown)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 9px',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: '600',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer'
                }}
                title="Switch conversation in this pane"
              >
                <span>Switch</span>
                <ChevronDown size={12} />
              </button>

              {showSwitchDropdown && (
                <div
                  className="no-scrollbar"
                  style={{
                    position: 'absolute',
                    top: '36px',
                    right: 0,
                    width: '300px',
                    maxHeight: '360px',
                    overflowY: 'auto',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    boxShadow: '0 14px 36px -4px rgba(0,0,0,0.25), 0 0 0 1px var(--border-color)',
                    zIndex: 100,
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'slideUp3D 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                >
                  {/* Search Header */}
                  <div style={{
                    padding: '8px 10px',
                    borderBottom: '1px solid var(--border-color)',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: 'var(--bg-secondary)',
                    zIndex: 10
                  }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Search size={13} style={{ position: 'absolute', left: '8px', color: 'var(--text-muted)' }} />
                      <input
                        ref={switchSearchInputRef}
                        type="text"
                        placeholder="Search conversations..."
                        value={switchSearchQuery}
                        onChange={(e) => setSwitchSearchQuery(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '5px 8px 5px 26px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-tertiary)',
                          color: 'var(--text-primary)',
                          fontSize: '0.75rem',
                          outline: 'none'
                        }}
                      />
                      {switchSearchQuery && (
                        <button
                          onClick={() => setSwitchSearchQuery('')}
                          style={{ position: 'absolute', right: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Grouped Chats List */}
                  <div style={{ padding: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Object.keys(groupedSwitchChats).length === 0 ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                        No conversations found
                      </div>
                    ) : (
                      Object.entries(groupedSwitchChats).map(([groupName, groupChats]) => (
                        <div key={groupName} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {/* Group Section Header */}
                          <div style={{
                            padding: '4px 8px',
                            fontSize: '0.66rem',
                            fontWeight: '800',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            color: 'var(--accent-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: 'var(--bg-tertiary)',
                            borderRadius: '4px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden' }}>
                              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: getAvatarColor(groupName), flexShrink: 0 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{groupName}</span>
                            </div>
                            <span style={{ opacity: 0.75 }}>{groupChats.length}</span>
                          </div>

                          {/* Chat Items */}
                          {groupChats.map((c) => {
                            const id = c._id || c.microsoftChatId || c.id;
                            const isSelected = id === chatId;
                            return (
                              <div
                                key={id}
                                onClick={() => {
                                  setShowSwitchDropdown(false);
                                  if (onSelectChat) onSelectChat(id, c);
                                }}
                                style={{
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: isSelected ? 'var(--accent-light)' : 'transparent',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  transition: 'background-color 0.15s ease'
                                }}
                              >
                                <div style={{
                                  width: '26px',
                                  height: '26px',
                                  borderRadius: '50%',
                                  backgroundColor: getAvatarColor(c.participant),
                                  color: '#fff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.72rem',
                                  fontWeight: '700',
                                  flexShrink: 0
                                }}>
                                  {getInitials(c.participant)}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{
                                      fontSize: '0.78rem',
                                      fontWeight: isSelected ? '800' : '600',
                                      color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      {c.participant}
                                    </span>
                                    {c.unreadCount > 0 && (
                                      <span style={{
                                        backgroundColor: '#ef4444',
                                        color: '#fff',
                                        fontSize: '0.6rem',
                                        fontWeight: '800',
                                        padding: '1px 5px',
                                        borderRadius: '8px'
                                      }}>
                                        {c.unreadCount}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{
                                    fontSize: '0.68rem',
                                    color: 'var(--text-muted)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {(c.lastMessagePreview || '').replace(/<[^>]*>/g, '').trim() || 'No preview'}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Toggle Split / Close Split Button */}
          {!isSplit ? (
            <button
              className="tab-pill-3d"
              onClick={onToggleSplit}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.76rem',
                fontWeight: '700',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                cursor: 'pointer'
              }}
              title="Open Split View (2 chats side-by-side)"
            >
              <Columns size={14} style={{ color: 'var(--accent-primary)' }} />
              <span>Split View</span>
            </button>
          ) : isSplitSecondPane && onCloseSplit ? (
            <button
              className="tab-pill-3d"
              onClick={onCloseSplit}
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)'
              }}
              title="Close Split View"
            >
              <X size={15} />
            </button>
          ) : null}
        </div>
      </div>

      {/* Messages Thread Container */}
      <div
        ref={messagesThreadContainerRef}
        key={chatId}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}
      >
        {messagesLoading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: '40px', fontSize: '0.84rem' }}>
            Loading conversation history...
          </div>
        ) : messagesError ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: '40px', maxWidth: '360px', margin: '0 auto' }}>
            <AlertCircle size={32} color="var(--accent-primary)" style={{ marginBottom: '10px' }} />
            <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
              Authentication Required
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Sign in with your Microsoft account to load messages.
            </div>
            {onOpenMicrosoftModal && (
              <button className="btn btn-primary" onClick={onOpenMicrosoftModal} style={{ margin: '0 auto', fontSize: '0.8rem', padding: '6px 14px' }}>
                <LogIn size={14} />
                <span>Sign In</span>
              </button>
            )}
          </div>
        ) : safeMessages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: '40px', fontSize: '0.84rem' }}>
            No messages in this conversation.
          </div>
        ) : (
          safeMessages.map((msg, index) => {
            const prevMsg = index > 0 ? safeMessages[index - 1] : null;
            const msgId = msg.microsoftMessageId || msg._id || msg.id || `msg-${index}`;
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

            const prevDate = prevMsg ? new Date(prevMsg.createdDateTime).toDateString() : null;
            const currDate = new Date(msg.createdDateTime).toDateString();
            const showDateDivider = prevDate !== currDate;
            const isSameSenderAsPrev = prevMsg && prevMsg.isOutgoing === msg.isOutgoing && prevMsg.senderName === msg.senderName;
            const showHeader = !isSameSenderAsPrev || showDateDivider;

            return (
              <React.Fragment key={msgId}>
                {showDateDivider && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '14px 0 8px 0', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 0, right: 0, height: '1px', backgroundColor: 'var(--border-color)' }} />
                    <span style={{ position: 'relative', backgroundColor: 'var(--bg-secondary)', padding: '2px 10px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: '600', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                      {formatMessageDate(msg.createdDateTime)}
                    </span>
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: msg.isOutgoing ? 'flex-end' : 'flex-start',
                  marginTop: showHeader && index !== 0 ? '10px' : '3px',
                  width: '100%',
                  gap: '8px'
                }}>
                  {!msg.isOutgoing && (
                    <div style={{ width: '28px', height: '28px', flexShrink: 0, marginTop: '2px', opacity: showHeader ? 1 : 0 }}>
                      <div className="avatar-3d" style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: getAvatarColor(msg.senderName),
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                        fontSize: '0.72rem'
                      }}>
                        {getInitials(msg.senderName)}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: msg.isOutgoing ? 'flex-end' : 'flex-start', maxWidth: '85%', minWidth: 0 }}>
                    {showHeader && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px', padding: '0 2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {!msg.isOutgoing && <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{msg.senderName}</span>}
                        <span>{new Date(msg.createdDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    )}

                    <div
                      style={{ position: 'relative', width: 'fit-content', maxWidth: '100%' }}
                      onMouseEnter={() => setHoveredMessageId(msgId)}
                      onMouseLeave={() => setHoveredMessageId((curr) => (curr === msgId ? null : curr))}
                    >
                      {hoveredMessageId === msgId && (
                        <MessageReactionsBar
                          isOutgoing={msg.isOutgoing}
                          activeUserReactions={activeUserReactions}
                          onSelectReaction={(reactionType) => toggleReaction(msgId, reactionType, rawReactions)}
                        />
                      )}

                      <div
                        className={msg.isOutgoing ? 'outgoing-bubble' : 'incoming-bubble'}
                        style={{
                          padding: '9px 13px',
                          borderRadius: msg.isOutgoing ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                          background: msg.isOutgoing ? paneTheme.bubbleBg : 'var(--bg-secondary)',
                          color: msg.isOutgoing ? '#ffffff' : 'var(--text-primary)',
                          fontSize: '0.84rem',
                          lineHeight: '1.45',
                          wordBreak: 'break-word',
                          boxShadow: msg.isOutgoing ? paneTheme.bubbleShadow : '0 1px 3px rgba(0,0,0,0.05)',
                          border: msg.isOutgoing ? 'none' : '1px solid var(--border-color)'
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
                                setLightboxImage(e.target.src);
                              }
                            }}
                          />
                        ) : (
                          <div>{msg.content}</div>
                        )}

                        {/* Attachments */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div style={{ marginTop: msg.content ? '8px' : '0', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {msg.attachments.map((att) => (
                              <TeamsAttachmentCard
                                key={att.id || att.name}
                                attachment={att}
                                onClick={(a) => {
                                  if (onPreviewDoc) {
                                    onPreviewDoc({
                                      name: a.name,
                                      contentType: a.contentType,
                                      previewUrl: a.contentUrl || a.dataUrl,
                                      webUrl: a.contentUrl || a.dataUrl,
                                      downloadUrl: a.contentUrl || a.dataUrl
                                    });
                                  }
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Read receipts */}
                      {msg.isOutgoing && (
                        <div style={{ position: 'absolute', bottom: '2px', right: '-20px', display: 'flex', alignItems: 'center' }}>
                          <CheckCircle2 size={13} color="#64748b" />
                        </div>
                      )}

                      {/* Reaction Pills */}
                      {reactionList.length > 0 && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '3px',
                          position: 'absolute',
                          bottom: '-10px',
                          right: msg.isOutgoing ? '8px' : 'auto',
                          left: msg.isOutgoing ? 'auto' : '8px',
                          zIndex: 10
                        }}>
                          {reactionList.map((r) => (
                            <div
                              key={r.type}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleReaction(msgId, r.type, rawReactions);
                              }}
                              style={{
                                backgroundColor: r.hasUserReacted ? 'var(--accent-light)' : 'var(--bg-secondary)',
                                border: r.hasUserReacted ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                borderRadius: '10px',
                                padding: '1px 6px',
                                fontSize: '0.72rem',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              <span>{r.emoji}</span>
                              <span style={{ fontSize: '0.68rem', fontWeight: '700' }}>{r.count}</span>
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

      {/* Chat Composer */}
      <div style={{
        padding: '12px 18px',
        backgroundColor: 'var(--bg-glass)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        {/* Hidden inputs */}
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

        {/* Selected Image / Attachment previews */}
        {(selectedImage || selectedAttachments.length > 0) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {selectedImage && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '4px 8px', position: 'relative' }}>
                <img src={selectedImage.dataUrl} alt="Preview" style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover' }} />
                <span style={{ fontSize: '0.72rem', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedImage.name}</span>
                <button onClick={() => setSelectedImage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={12} /></button>
              </div>
            )}
            {selectedAttachments.map((att, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '4px 8px' }}>
                <FileText size={14} color="var(--accent-primary)" />
                <span style={{ fontSize: '0.72rem', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
                <button onClick={() => setSelectedAttachments(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={12} /></button>
              </div>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
          {showComposerEmojiPicker && (
            <div style={{ position: 'absolute', bottom: '50px', left: 0, zIndex: 100 }}>
              <EmojiPicker onSelect={(emoji) => {
                setDraftMessage(prev => prev + emoji);
                setShowComposerEmojiPicker(false);
                chatInputRef.current?.focus();
              }} />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <button type="button" onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px', borderRadius: '6px' }} title="Attach Document">
              <Paperclip size={18} />
            </button>
            <button type="button" onClick={() => imageInputRef.current?.click()} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px', borderRadius: '6px' }} title="Attach Photo">
              <ImageIcon size={18} />
            </button>
            <button type="button" onClick={() => setShowComposerEmojiPicker(!showComposerEmojiPicker)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px', borderRadius: '6px' }} title="Insert Emoji">
              <Smile size={18} />
            </button>
          </div>

          <input
            ref={chatInputRef}
            type="text"
            placeholder={`Type a message to ${chat.participant}... (Alt+${paneIndex})`}
            value={draftMessage}
            onChange={(e) => setDraftMessage(e.target.value)}
            style={{
              flex: 1,
              padding: '9px 14px',
              borderRadius: '24px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          />

          <button
            type="submit"
            disabled={isSending || (!draftMessage.trim() && !selectedImage && selectedAttachments.length === 0)}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: 'none',
              background: (draftMessage.trim() || selectedImage || selectedAttachments.length > 0) ? paneTheme.sendBtnBg : 'var(--border-color)',
              color: '#ffffff',
              cursor: (draftMessage.trim() || selectedImage || selectedAttachments.length > 0) ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              flexShrink: 0,
              boxShadow: (draftMessage.trim() || selectedImage || selectedAttachments.length > 0) ? paneTheme.bubbleShadow : 'none'
            }}
          >
            <Send size={15} />
          </button>
        </form>
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '24px'
          }}
        >
          <img src={lightboxImage} alt="Expanded" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '8px', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  );
}
