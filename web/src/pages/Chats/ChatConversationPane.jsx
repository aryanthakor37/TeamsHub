import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Send, ShieldCheck, CheckCircle2, MessageSquare, AlertCircle,
  FileText, Paperclip, Image as ImageIcon, Download, X, ExternalLink,
  Eye, Smile, LogIn, ArrowLeft, Columns, ChevronDown, Split, Search,
  Pin, Bookmark, Check, CornerUpLeft, MessageSquareQuote, Edit3,
  Copy, Trash2, Languages, Loader2
} from 'lucide-react';
import { useMessages } from '../../hooks/useMessages';
import { useAuth } from '../../hooks/useAuth';
import { getAvatarColor, getInitials } from '../../utils/avatarUtils';
import { getFileCategoryMeta } from '../../components/DocumentPreviewModal';
import EmojiPicker from '../../components/EmojiPicker';
import MessageReactionsBar, { getEmojiForReactionType, TEAMS_REACTIONS } from '../../components/MessageReactionsBar';
import { translateTeamsMessage } from '../../utils/translationUtils';
import { fetchFileBlob } from '../../services/fileService';

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

// Rich Image Attachment Card for Teams Chat
function ChatImageAttachment({ attachment, chatOwner, onImageClick }) {
  const targetUrl = attachment.thumbnailUrl || attachment.contentUrl || attachment.previewUrl || attachment.dataUrl;
  const fileName = attachment.name || 'Image';
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    if (!targetUrl || targetUrl === '#') {
      setError(true);
      setLoading(false);
      return;
    }

    if (targetUrl.startsWith('data:') || targetUrl.startsWith('blob:')) {
      setBlobUrl(targetUrl);
      setLoading(false);
      return;
    }

    const cleanAcc = (chatOwner || '').toLowerCase().trim();
    fetchFileBlob(targetUrl, cleanAcc).then((src) => {
      if (active) {
        if (src) {
          setBlobUrl(src);
          setError(false);
        } else {
          setBlobUrl(targetUrl);
        }
        setLoading(false);
      }
    }).catch(() => {
      if (active) {
        setBlobUrl(targetUrl);
        setLoading(false);
      }
    });

    return () => { active = false; };
  }, [targetUrl, chatOwner]);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onImageClick(blobUrl || targetUrl);
      }}
      style={{
        maxWidth: '380px',
        maxHeight: '280px',
        borderRadius: '8px',
        overflow: 'hidden',
        cursor: 'pointer',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        marginTop: '6px',
        display: 'inline-block',
        backgroundColor: 'rgba(0,0,0,0.25)',
        position: 'relative',
        boxShadow: '0 2px 12px rgba(0,0,0,0.2)'
      }}
      title={`Click to expand ${fileName}`}
    >
      {loading ? (
        <div style={{ width: '220px', height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          <Loader2 size={22} className="spinner" />
        </div>
      ) : (
        <img
          src={blobUrl || targetUrl}
          alt={fileName}
          style={{
            maxWidth: '100%',
            maxHeight: '280px',
            objectFit: 'contain',
            display: 'block',
            borderRadius: '7px'
          }}
          onError={() => setError(true)}
        />
      )}
    </div>
  );
}

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
  const [replyingToMessage, setReplyingToMessage] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [savedMessageIds, setSavedMessageIds] = useState(() => {
    try {
      const saved = localStorage.getItem('teamshub_saved_messages');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [toastNotification, setToastNotification] = useState(null);
  const [activeContextMenu, setActiveContextMenu] = useState(null); // { msg, msgId, x, y, isOutgoing, rawReactions }
  const [translatedMessages, setTranslatedMessages] = useState({}); // { [msgId]: translatedText }

  const showToast = (text) => {
    setToastNotification(text);
    setTimeout(() => setToastNotification(null), 2400);
  };

  const handleToggleTranslate = async (msg) => {
    if (!msg) return;
    const msgId = msg.microsoftMessageId || msg._id || msg.id;
    if (translatedMessages[msgId]) {
      setTranslatedMessages((prev) => {
        const next = { ...prev };
        delete next[msgId];
        return next;
      });
      return;
    }
    showToast('Translating to Gujarati...');
    const originalText = (msg.content || '').replace(/<[^>]*>/g, '');
    const translated = await translateTeamsMessage(originalText, 'gu');
    setTranslatedMessages((prev) => ({
      ...prev,
      [msgId]: translated
    }));
    showToast('Translated to Gujarati');
  };

  const chatInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesThreadContainerRef = useRef(null);
  const switchSearchInputRef = useRef(null);

  // Close context menu on outside click or scroll
  useEffect(() => {
    const handleCloseMenu = () => setActiveContextMenu(null);
    if (activeContextMenu) {
      window.addEventListener('click', handleCloseMenu);
      window.addEventListener('contextmenu', handleCloseMenu);
    }
    return () => {
      window.removeEventListener('click', handleCloseMenu);
      window.removeEventListener('contextmenu', handleCloseMenu);
    };
  }, [activeContextMenu]);

  // Keyboard shortcut listener: Alt+1 and Alt+2 to focus composers, Escape to cancel edit/reply
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
        setReplyingToMessage(null);
        setActiveContextMenu(null);
        if (editingMessage) {
          setEditingMessage(null);
          setDraftMessage('');
        }
        setLightboxImage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [paneIndex, editingMessage]);

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

  const { messages, loading: messagesLoading, error: messagesError, sendMessage, toggleReaction, deleteMessage, editMessage } = useMessages(chatId, chatOwner, chat);
  const rawMessages = Array.isArray(messages) ? messages : [];
  const activeEmail = (localStorage.getItem('teamshub_active_email') || '').toLowerCase().trim();

  const getSenderString = (s) => {
    if (!s) return '';
    if (typeof s === 'string') return s;
    if (typeof s === 'object') return s.name || s.displayName || s.user?.displayName || s.email || '';
    return String(s);
  };

  const safeMessages = useMemo(() => {
    const delIds = (() => {
      try {
        return JSON.parse(localStorage.getItem('teamshub_deleted_ids') || '[]');
      } catch {
        return [];
      }
    })();

    const valid = [...rawMessages].filter((m) => {
      if (!m || m.isDeleted || m.deletedDateTime) return false;
      const mId = String(m.microsoftMessageId || m._id || m.id || '').replace(/^msg-/, '').trim();
      if (delIds.some(d => String(d).replace(/^msg-/, '').trim() === mId)) return false;
      const clean = (m.content || '').replace(/<[^>]*>/g, '').trim();
      if (clean === 'This message was deleted.' || clean === 'This message has been deleted') return false;
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

    const ownerEmail = (matchedAccount?.email || chat?.accountEmail || chat?.connectedAccountId || '').toLowerCase().trim();
    const ownerName = (matchedAccount?.displayName || matchedAccount?.name || '').toLowerCase().replace(/[`'"\\]/g, '').trim();
    const ownerUser = ownerEmail ? ownerEmail.split('@')[0] : '';
    const pName = (chat?.participant || '').toLowerCase().replace(/[`'"\\]/g, '').trim();

    return sorted.map((m) => {
      const rawSender = m.senderName || m.sender;
      const senderStr = getSenderString(rawSender);
      const cleanSender = senderStr.toLowerCase().replace(/[`'"\\]/g, '').trim();
      const senderEmail = (m.senderEmail || m.email || m.from?.user?.email || m.from?.user?.userPrincipalName || '').toLowerCase().trim();
      const senderUser = senderEmail ? senderEmail.split('@')[0] : '';

      let isOutgoing = false;

      // 1. If sender is explicitly the participant (the other chatter), it's INCOMING (Left side)
      if (pName && (cleanSender === pName || (pName.length > 3 && cleanSender.includes(pName)))) {
        isOutgoing = false;
      // 2. If sender email matches this chat pane's owner email, it's OUTGOING (Right side)
      } else if (ownerEmail && senderEmail && (senderEmail === ownerEmail || (ownerUser && senderUser === ownerUser))) {
        isOutgoing = true;
      // 3. If sender name matches this chat pane's owner name, it's OUTGOING (Right side)
      } else if (ownerName && (cleanSender === ownerName || (ownerName.length > 3 && cleanSender.includes(ownerName)))) {
        isOutgoing = true;
      // 4. If explicit flag isFromMe is present
      } else if (m.isFromMe !== undefined) {
        isOutgoing = !!m.isFromMe;
      // 5. Fallback to m.isOutgoing if already set
      } else if (m.isOutgoing !== undefined) {
        isOutgoing = !!m.isOutgoing;
      }

      let resolvedSenderName = isOutgoing
        ? (ownerName ? (ownerName.charAt(0).toUpperCase() + ownerName.slice(1)) : 'You')
        : (senderStr || pName || 'Teams User');

      return {
        ...m,
        isOutgoing,
        senderName: resolvedSenderName
      };
    });
  }, [rawMessages, chat, connectedAccounts]);

  const isAtBottomRef = useRef(true);
  const prevChatIdRef = useRef(chatId);

  const handleScroll = (e) => {
    const el = e.currentTarget;
    if (el) {
      isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    }
  };

  // Auto scroll to bottom only when user is already at bottom or switches chat
  useEffect(() => {
    if (!messagesThreadContainerRef.current) return;
    const isChatChanged = prevChatIdRef.current !== chatId;
    prevChatIdRef.current = chatId;

    if (isChatChanged) {
      isAtBottomRef.current = true;
      messagesThreadContainerRef.current.scrollTop = messagesThreadContainerRef.current.scrollHeight;
    } else if (isAtBottomRef.current) {
      messagesThreadContainerRef.current.scrollTop = messagesThreadContainerRef.current.scrollHeight;
    }
  }, [safeMessages, chatId]);

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    let textToSend = draftMessage.trim();
    const imageToSend = selectedImage;
    const attachmentsToSend = [...selectedAttachments];

    if (!textToSend && !imageToSend && attachmentsToSend.length === 0) return;

    // Attach Teams-style quote block if replying
    if (replyingToMessage) {
      const quoteSender = replyingToMessage.senderName || 'User';
      const cleanQuote = (replyingToMessage.content || '').replace(/<[^>]*>/g, '').trim();
      const snippet = cleanQuote.length > 140 ? cleanQuote.slice(0, 140) + '...' : cleanQuote;
      textToSend = `<blockquote><strong>${quoteSender}</strong>: ${snippet}</blockquote>${textToSend}`;
      setReplyingToMessage(null);
    }

    if (editingMessage) {
      const editMsgId = editingMessage.microsoftMessageId || editingMessage._id || editingMessage.id;
      setEditingMessage(null);
      setDraftMessage('');
      await editMessage(editMsgId, textToSend);
      showToast('Message updated');
      chatInputRef.current?.focus();
      return;
    }

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
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              minWidth: 0
            }}>
              <span style={{ fontWeight: '800', fontSize: '0.94rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                {chat.participant}
              </span>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                backgroundColor: 'rgba(16, 185, 129, 0.14)', color: '#10b981',
                padding: '1px 6px', borderRadius: '10px', fontSize: '0.62rem', fontWeight: '800',
                flexShrink: 0
              }}>
                <div style={{ width: '4px', height: '4px', backgroundColor: '#10b981', borderRadius: '50%' }} />
                LIVE
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              marginTop: '1px'
            }}>
              {/* Split Mode Pane Tag */}
              {isSplit && (
                <span style={{
                  padding: '1px 6px',
                  borderRadius: '4px',
                  background: paneTheme.headerBadgeBg,
                  color: paneTheme.headerBadgeText,
                  fontSize: '0.62rem',
                  fontWeight: '800',
                  letterSpacing: '0.02em',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                  flexShrink: 0
                }}>
                  {paneTheme.pillText}
                </span>
              )}
              <strong style={{ color: paneTheme.accentColor, fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {chat.company || chat.accountBadge || 'Teams'}
              </strong>
              {chat.accountEmail && (
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.85 }}>
                  • {chat.accountEmail}
                </span>
              )}
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

      {/* Pinned Messages Banner */}
      {pinnedMessages.length > 0 && (
        <div className="pinned-message-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
            <Pin size={13} style={{ color: 'var(--accent-primary)', transform: 'rotate(45deg)', flexShrink: 0 }} />
            <span style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '0.74rem' }}>Pinned:</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.76rem' }}>
              <strong>{pinnedMessages[pinnedMessages.length - 1].senderName}:</strong> {(pinnedMessages[pinnedMessages.length - 1].content || '').replace(/<[^>]*>/g, '')}
            </span>
          </div>
          <button
            onClick={() => setPinnedMessages([])}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex' }}
            title="Unpin"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Messages Thread Container */}
      <div
        ref={messagesThreadContainerRef}
        key={chatId}
        onScroll={handleScroll}
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
                          message={msg}
                          isTranslated={!!translatedMessages[msgId]}
                          onReply={(m) => {
                            setReplyingToMessage(m);
                            setEditingMessage(null);
                            chatInputRef.current?.focus();
                          }}
                          onEdit={(m) => {
                            setEditingMessage(m);
                            setReplyingToMessage(null);
                            setDraftMessage((m.content || '').replace(/<[^>]*>/g, ''));
                            chatInputRef.current?.focus();
                          }}
                          onTranslate={() => handleToggleTranslate(msg)}
                          onCopyText={(m) => {
                            const text = (translatedMessages[msgId] || m.content || '').replace(/<[^>]*>/g, '');
                            if (navigator.clipboard) navigator.clipboard.writeText(text);
                            showToast('Message copied to clipboard');
                          }}
                          onDelete={async (m) => {
                            const id = m.microsoftMessageId || m._id || m.id || msgId;
                            await deleteMessage(id);
                            showToast('Message deleted');
                          }}
                          onPin={(m) => {
                            const id = m.microsoftMessageId || m._id || m.id || msgId;
                            setPinnedMessages((prev) => {
                              const exists = prev.some((x) => (x.microsoftMessageId || x._id || x.id || msgId) === id);
                              const next = exists ? prev.filter((x) => (x.microsoftMessageId || x._id || x.id || msgId) !== id) : [...prev, m];
                              showToast(exists ? 'Message unpinned' : 'Message pinned for everyone');
                              return next;
                            });
                          }}
                        />
                      )}

                      <div
                        className={msg.isOutgoing ? 'outgoing-bubble' : 'incoming-bubble'}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setActiveContextMenu({
                            msg,
                            msgId,
                            x: e.clientX,
                            y: e.clientY,
                            isOutgoing: msg.isOutgoing,
                            rawReactions
                          });
                        }}
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
                        {translatedMessages[msgId] ? (
                          <div style={{ margin: 0, fontWeight: '500' }}>
                            {translatedMessages[msgId]}
                          </div>
                        ) : (msg.contentType === 'html' || (msg.content && (msg.content.includes('<img') || msg.content.includes('<p>') || msg.content.includes('<div') || msg.content.includes('hostedContents')))) ? (
                          <div
                            className="message-html-content"
                            dangerouslySetInnerHTML={{
                              __html: (() => {
                                if (!msg.content) return '';
                                const apiBase = (import.meta.env.VITE_API_BASE_URL && import.meta.env.VITE_API_BASE_URL.trim())
                                  ? import.meta.env.VITE_API_BASE_URL.trim().replace(/\/$/, '')
                                  : (typeof window !== 'undefined' ? window.location.origin : '');

                                const cleanAcc = (chatOwner || '').toLowerCase().trim();
                                const token = localStorage.getItem(`teamshub_token_${cleanAcc}`) ||
                                              localStorage.getItem('teamshub_last_access_token') || '';

                                let processed = msg.content;

                                // 1. Proxy Microsoft Graph hostedContents image URLs to authenticated backend endpoint
                                processed = processed.replace(
                                  /src=["']https:\/\/graph\.microsoft\.com\/v1\.0\/chats\/([^\/]+)\/messages\/([^\/]+)\/hostedContents\/([^\/]+)\/\$value["']/gi,
                                  (match, cId, mId, hId) => {
                                    return `src="${apiBase}/api/chats/${encodeURIComponent(cId)}/messages/${encodeURIComponent(mId)}/hostedContents/${encodeURIComponent(hId)}/$value?token=${encodeURIComponent(token)}&email=${encodeURIComponent(cleanAcc)}"`;
                                  }
                                );

                                // 2. Proxy relative /api/chats paths with token and email
                                processed = processed.replace(
                                  /src=["'](?:\/api\/chats\/)([^"']+)["']/gi,
                                  (match, path) => {
                                    return `src="${apiBase}/api/chats/${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}&email=${encodeURIComponent(cleanAcc)}"`;
                                  }
                                );

                                return processed;
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

                        {/* Attachments - Rich image thumbnails and document cards */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div style={{ marginTop: (msg.content && msg.content !== '.' && msg.content !== ' ') ? '8px' : '0', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {msg.attachments.map((att) => {
                              const isImg = (att.contentType && att.contentType.startsWith('image/')) ||
                                            (att.name && /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(att.name)) ||
                                            att.thumbnailUrl ||
                                            (att.contentUrl && /\.(png|jpe?g|gif|webp|bmp)$/i.test(att.contentUrl.split('?')[0]));

                              if (isImg) {
                                return (
                                  <ChatImageAttachment
                                    key={att.id || att.name}
                                    attachment={att}
                                    chatOwner={chatOwner}
                                    onImageClick={(src) => setLightboxImage(src)}
                                  />
                                );
                              }

                              return (
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
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Translated Indicator */}
                      {translatedMessages[msgId] && (
                        <div style={{
                          fontSize: '0.72rem',
                          color: 'var(--text-muted)',
                          marginTop: '3px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <Languages size={12} color="var(--accent-primary)" />
                          <span>Translated to Gujarati • </span>
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleTranslate(msg);
                            }}
                            style={{ color: 'var(--accent-primary)', cursor: 'pointer', textDecoration: 'underline', fontWeight: '600' }}
                          >
                            See original
                          </span>
                        </div>
                      )}

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

        {/* Reply Quote Preview */}
        {replyingToMessage && (
          <div className="reply-quote-preview">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
              <MessageSquareQuote size={15} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: '700', color: 'var(--accent-primary)', marginRight: '6px' }}>
                  Replying to {replyingToMessage.senderName || 'User'}:
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {(replyingToMessage.content || '').replace(/<[^>]*>/g, '')}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReplyingToMessage(null)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex' }}
              title="Cancel reply"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Editing Message Banner */}
        {editingMessage && (
          <div className="reply-quote-preview" style={{ borderLeftColor: '#f59e0b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
              <Edit3 size={15} style={{ color: '#f59e0b', flexShrink: 0 }} />
              <span style={{ fontWeight: '700', color: '#f59e0b' }}>Editing message</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>(Press Esc to cancel)</span>
            </div>
            <button
              type="button"
              onClick={() => { setEditingMessage(null); setDraftMessage(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex' }}
              title="Cancel edit"
            >
              <X size={14} />
            </button>
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

      {/* Toast Notification Banner */}
      {toastNotification && (
        <div
          style={{
            position: 'absolute',
            bottom: '76px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(15, 23, 42, 0.94)',
            color: '#ffffff',
            padding: '7px 16px',
            borderRadius: '20px',
            fontSize: '0.8rem',
            fontWeight: '600',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.28)',
            backdropFilter: 'blur(10px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'fadeInScale 0.15s ease'
          }}
        >
          <Check size={14} color="#10b981" />
          <span>{toastNotification}</span>
        </div>
      )}

      {/* Floating Right-Click Context Menu */}
      {activeContextMenu && (
        <div
          className="teams-context-menu"
          style={{
            position: 'fixed',
            top: Math.max(10, Math.min(activeContextMenu.y, window.innerHeight - 260)),
            left: Math.max(10, Math.min(activeContextMenu.x, window.innerWidth - 200)),
            zIndex: 99999,
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.28)',
            width: '185px',
            padding: '4px 0',
            fontSize: '0.82rem',
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeInScale 0.12s ease-out'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Reply with quote */}
          <button
            className="teams-menu-item"
            onClick={(e) => {
              e.stopPropagation();
              setReplyingToMessage(activeContextMenu.msg);
              setEditingMessage(null);
              setActiveContextMenu(null);
              chatInputRef.current?.focus();
            }}
          >
            <MessageSquareQuote size={15} className="menu-icon" />
            <span className="menu-label">Reply with quote</span>
          </button>

          {/* Edit (if outgoing) */}
          {activeContextMenu.isOutgoing && (
            <button
              className="teams-menu-item"
              onClick={(e) => {
                e.stopPropagation();
                setEditingMessage(activeContextMenu.msg);
                setReplyingToMessage(null);
                setDraftMessage((activeContextMenu.msg.content || '').replace(/<[^>]*>/g, ''));
                setActiveContextMenu(null);
                chatInputRef.current?.focus();
              }}
            >
              <Edit3 size={15} className="menu-icon" />
              <span className="menu-label">Edit</span>
              <span className="menu-badge">E</span>
            </button>
          )}

          {/* Real Live Translation */}
          <button
            className="teams-menu-item"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleTranslate(activeContextMenu.msg);
              setActiveContextMenu(null);
            }}
          >
            <Languages size={15} className="menu-icon" style={{ color: translatedMessages[activeContextMenu.msgId] ? 'var(--accent-primary)' : 'inherit' }} />
            <span className="menu-label">{translatedMessages[activeContextMenu.msgId] ? 'See original' : 'Translate'}</span>
          </button>

          {/* Copy text */}
          <button
            className="teams-menu-item"
            onClick={(e) => {
              e.stopPropagation();
              const text = (translatedMessages[activeContextMenu.msgId] || activeContextMenu.msg.content || '').replace(/<[^>]*>/g, '');
              if (navigator.clipboard) navigator.clipboard.writeText(text);
              showToast('Message copied to clipboard');
              setActiveContextMenu(null);
            }}
          >
            <Copy size={15} className="menu-icon" />
            <span className="menu-label">Copy text</span>
          </button>

          {/* Pin */}
          <button
            className="teams-menu-item"
            onClick={(e) => {
              e.stopPropagation();
              const id = activeContextMenu.msg.microsoftMessageId || activeContextMenu.msg._id || activeContextMenu.msg.id || activeContextMenu.msgId;
              setPinnedMessages((prev) => {
                const exists = prev.some((x) => (x.microsoftMessageId || x._id || x.id || activeContextMenu.msgId) === id);
                const next = exists ? prev.filter((x) => (x.microsoftMessageId || x._id || x.id || activeContextMenu.msgId) !== id) : [...prev, activeContextMenu.msg];
                showToast(exists ? 'Message unpinned' : 'Message pinned for everyone');
                return next;
              });
              setActiveContextMenu(null);
            }}
          >
            <Pin size={15} className="menu-icon" />
            <span className="menu-label">Pin</span>
          </button>

          {/* Real Delete (if outgoing) */}
          {activeContextMenu.isOutgoing && (
            <>
              <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '3px 0' }} />
              <button
                className="teams-menu-item danger"
                onClick={async (e) => {
                  e.stopPropagation();
                  await deleteMessage(activeContextMenu.msgId);
                  showToast('Message deleted');
                  setActiveContextMenu(null);
                }}
              >
                <Trash2 size={15} className="menu-icon" />
                <span className="menu-label">Delete</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
