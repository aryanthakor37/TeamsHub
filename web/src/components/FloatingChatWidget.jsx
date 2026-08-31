import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare, X, Minimize2, Maximize2, Send, ChevronDown, CheckCircle2,
  Sparkles, Paperclip, Smile
} from 'lucide-react';
import { useChats } from '../hooks/useChats';
import { useMessages } from '../hooks/useMessages';
import { useAuth } from '../hooks/useAuth';
import { getAvatarColor, getInitials } from '../utils/avatarUtils';
import EmojiPicker from './EmojiPicker';

export default function FloatingChatWidget({ onOpenFullChat }) {
  const { connectedAccounts } = useAuth();
  const { chats, markChatAsRead, bumpChatToTop } = useChats('all');
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeMiniChatId, setActiveMiniChatId] = useState(null);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [hasNewPulse, setHasNewPulse] = useState(false);

  // Default to first chat if none selected
  useEffect(() => {
    if (!activeMiniChatId && chats && chats.length > 0) {
      setActiveMiniChatId(chats[0]._id || chats[0].microsoftChatId || chats[0].id);
    }
  }, [chats, activeMiniChatId]);

  // Listen for global open mini chat trigger
  useEffect(() => {
    const handleOpenMini = (e) => {
      const { chatId } = e.detail || {};
      if (chatId) {
        setActiveMiniChatId(chatId);
      }
      setIsOpen(true);
      setIsMinimized(false);
      setHasNewPulse(false);
    };

    const handleToast = (e) => {
      const chat = e.detail?.chat;
      if (chat && !isOpen) {
        const id = chat._id || chat.id || chat.microsoftChatId;
        setActiveMiniChatId(id);
        setHasNewPulse(true);
      }
    };

    window.addEventListener('teamshub:open-mini-chat', handleOpenMini);
    window.addEventListener('teamshub:new-toast-notification', handleToast);
    return () => {
      window.removeEventListener('teamshub:open-mini-chat', handleOpenMini);
      window.removeEventListener('teamshub:new-toast-notification', handleToast);
    };
  }, [isOpen]);

  const activeChat = useMemo(() => {
    if (!chats || chats.length === 0) return null;
    return chats.find(c => (c._id === activeMiniChatId || c.microsoftChatId === activeMiniChatId || c.id === activeMiniChatId)) || chats[0];
  }, [chats, activeMiniChatId]);

  const chatOwner = activeChat?.accountEmail || activeChat?.connectedAccountId;
  const targetChatId = activeChat?._id || activeChat?.microsoftChatId || activeChat?.id;
  const { messages, loading, sendMessage } = useMessages(targetChatId, chatOwner);
  const rawMessages = Array.isArray(messages) ? messages : [];

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized]);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    const text = draftMessage.trim();
    if (!text || !targetChatId) return;

    setDraftMessage('');
    setShowEmoji(false);
    bumpChatToTop(targetChatId, text);
    try {
      await sendMessage(text, [], null);
    } catch (err) {
      console.warn('Mini send error:', err);
    }
  };

  if (!connectedAccounts || connectedAccounts.length === 0 || !chats || chats.length === 0) {
    return null;
  }

  const unreadChats = chats.filter(c => (c.unreadCount || 0) > 0 && !c.isLastMessageOutgoing && !c.isOutgoing && !c.isSelfChat);
  const totalUnread = unreadChats.length;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      fontFamily: 'inherit'
    }}>
      {/* Expanded Mini Chat Window */}
      {isOpen && !isMinimized && activeChat && (
        <div style={{
          width: '360px',
          height: '480px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '16px',
          boxShadow: '0 12px 36px -4px rgba(0, 0, 0, 0.25), 0 0 0 1px var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          marginBottom: '12px',
          animation: 'slideUp3D 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          backdropFilter: 'blur(20px)'
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 14px',
            backgroundColor: 'var(--bg-tertiary)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px'
          }}>
            {/* Active Participant Info + Dropdown Toggle */}
            <div
              onClick={() => setShowAccountMenu(!showAccountMenu)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                flex: 1,
                minWidth: 0
              }}
              title="Click to switch conversation"
            >
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: getAvatarColor(activeChat.participant),
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '700',
                fontSize: '0.82rem',
                flexShrink: 0
              }}>
                {getInitials(activeChat.participant)}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  <span>{activeChat.participant}</span>
                  <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
                </div>
                <div style={{
                  fontSize: '0.7rem',
                  color: 'var(--accent-primary)',
                  fontWeight: '600',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {activeChat.company || activeChat.accountBadge || 'Microsoft Teams'}
                </div>
              </div>
            </div>

            {/* Window Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => {
                  setIsOpen(false);
                  if (onOpenFullChat) onOpenFullChat(targetChatId);
                  window.dispatchEvent(new CustomEvent('teamshub:open-chat', { detail: { chatId: targetChatId } }));
                }}
                className="tab-pill-3d"
                title="Expand to Full Chat Page"
                style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}
              >
                <Maximize2 size={14} />
              </button>
              <button
                onClick={() => setIsMinimized(true)}
                className="tab-pill-3d"
                title="Minimize"
                style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}
              >
                <Minimize2 size={14} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="tab-pill-3d"
                title="Close"
                style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Quick Chat Switcher Dropdown */}
          {showAccountMenu && (
            <div style={{
              maxHeight: '180px',
              overflowY: 'auto',
              backgroundColor: 'var(--bg-secondary)',
              borderBottom: '1px solid var(--border-color)',
              padding: '6px'
            }}>
              {chats.slice(0, 8).map((c) => {
                const cId = c._id || c.microsoftChatId || c.id;
                const isSelected = cId === targetChatId;
                return (
                  <div
                    key={cId}
                    onClick={() => {
                      setActiveMiniChatId(cId);
                      setShowAccountMenu(false);
                      markChatAsRead(cId, c.connectedAccountId);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      backgroundColor: isSelected ? 'var(--accent-light)' : 'transparent',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: isSelected ? '700' : '500',
                      color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)'
                    }}
                  >
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: getAvatarColor(c.participant),
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.68rem',
                      fontWeight: '700'
                    }}>
                      {getInitials(c.participant)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.participant}
                    </div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      {c.company || 'Teams'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Messages Stream */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            backgroundColor: 'var(--bg-primary)'
          }}>
            {loading && rawMessages.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Loading conversation...
              </div>
            ) : rawMessages.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>
                <MessageSquare size={28} style={{ opacity: 0.4, marginBottom: '6px' }} />
                <div style={{ fontSize: '0.82rem', fontWeight: '600' }}>No messages yet</div>
                <div style={{ fontSize: '0.72rem' }}>Type below to send a quick message</div>
              </div>
            ) : (
              rawMessages.map((msg, idx) => {
                const isMe = !!msg.isOutgoing;
                const body = (msg.content || '').replace(/<[^>]*>/g, '').trim();
                if (!body) return null;

                return (
                  <div
                    key={msg.microsoftMessageId || msg._id || idx}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isMe ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      alignSelf: isMe ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <div style={{
                      padding: '8px 12px',
                      borderRadius: isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                      backgroundColor: isMe ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                      color: isMe ? '#ffffff' : 'var(--text-primary)',
                      fontSize: '0.82rem',
                      lineHeight: '1.4',
                      wordBreak: 'break-word',
                      boxShadow: isMe ? '0 2px 6px rgba(79, 70, 229, 0.3)' : '0 1px 3px rgba(0, 0, 0, 0.05)',
                      border: isMe ? 'none' : '1px solid var(--border-color)'
                    }}>
                      {body}
                    </div>
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '2px', padding: '0 4px' }}>
                      {msg.createdDateTime ? new Date(msg.createdDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer Input Bar */}
          <form
            onSubmit={handleSend}
            style={{
              padding: '8px 10px',
              backgroundColor: 'var(--bg-secondary)',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              position: 'relative'
            }}
          >
            {showEmoji && (
              <div style={{ position: 'absolute', bottom: '50px', left: '10px', zIndex: 100 }}>
                <EmojiPicker onSelect={(emoji) => {
                  setDraftMessage(prev => prev + emoji);
                  setShowEmoji(false);
                  inputRef.current?.focus();
                }} />
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowEmoji(!showEmoji)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
            >
              <Smile size={18} />
            </button>

            <input
              ref={inputRef}
              type="text"
              placeholder={`Reply as ${activeChat.company || 'Teams'}...`}
              value={draftMessage}
              onChange={(e) => setDraftMessage(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '20px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                outline: 'none'
              }}
            />

            <button
              type="submit"
              disabled={!draftMessage.trim()}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: draftMessage.trim() ? 'var(--accent-primary)' : 'var(--border-color)',
                color: '#ffffff',
                cursor: draftMessage.trim() ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}

      {/* Floating Circular Action Bubble (Chat Head) */}
      <div
        onClick={() => {
          if (isOpen && isMinimized) {
            setIsMinimized(false);
          } else {
            setIsOpen(!isOpen);
            setIsMinimized(false);
          }
          setHasNewPulse(false);
        }}
        className="tab-pill-3d"
        style={{
          width: '54px',
          height: '54px',
          borderRadius: '50%',
          backgroundColor: 'var(--accent-primary)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 6px 20px rgba(79, 70, 229, 0.45), 0 0 0 2px var(--bg-primary)',
          cursor: 'pointer',
          position: 'relative',
          transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          animation: hasNewPulse ? 'pulseOnline 1.5s infinite' : 'none'
        }}
        title="TeamsHub Quick-Reply Widget"
      >
        {isOpen && !isMinimized ? (
          <X size={24} />
        ) : (
          <MessageSquare size={24} />
        )}

        {/* Live Unread Badge */}
        {totalUnread > 0 && (
          <span style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            backgroundColor: '#ef4444',
            color: '#ffffff',
            fontSize: '0.7rem',
            fontWeight: '800',
            borderRadius: '12px',
            minWidth: '20px',
            height: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            border: '2px solid var(--bg-primary)',
            boxShadow: '0 2px 6px rgba(239, 68, 68, 0.6)'
          }}>
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </div>
    </div>
  );
}
