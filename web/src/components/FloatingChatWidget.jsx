import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare, X, Minimize2, Maximize2, Send, ChevronDown, CheckCircle2,
  Sparkles, Paperclip, Smile, Bell
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
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'notifications'
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
      const { chatId, tab } = e.detail || {};
      if (chatId) {
        setActiveMiniChatId(chatId);
      }
      if (tab) {
        setActiveTab(tab);
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
      {/* Expanded Mini Window (Supports Quick Chat & Live Notifications) */}
      {isOpen && !isMinimized && (
        <div style={{
          width: '370px',
          height: '490px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '16px',
          boxShadow: '0 16px 40px -6px rgba(0, 0, 0, 0.3), 0 0 0 1px var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          marginBottom: '12px',
          animation: 'slideUp3D 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          backdropFilter: 'blur(20px)'
        }}>
          {/* Top Bar with Hub Tabs & Window Controls */}
          <div style={{
            padding: '10px 12px',
            backgroundColor: 'var(--bg-tertiary)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px'
          }}>
            {/* Segmented Tab Controls */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: '8px',
              padding: '2px',
              gap: '2px'
            }}>
              <button
                onClick={() => setActiveTab('chat')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: activeTab === 'chat' ? 'var(--accent-primary)' : 'transparent',
                  color: activeTab === 'chat' ? '#ffffff' : 'var(--text-secondary)',
                  fontSize: '0.74rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <MessageSquare size={13} />
                <span>Chat</span>
              </button>

              <button
                onClick={() => setActiveTab('notifications')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: activeTab === 'notifications' ? 'var(--accent-primary)' : 'transparent',
                  color: activeTab === 'notifications' ? '#ffffff' : 'var(--text-secondary)',
                  fontSize: '0.74rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  position: 'relative'
                }}
              >
                <Bell size={13} />
                <span>Alerts</span>
                {totalUnread > 0 && (
                  <span style={{
                    backgroundColor: activeTab === 'notifications' ? '#ffffff' : '#ef4444',
                    color: activeTab === 'notifications' ? '#ef4444' : '#ffffff',
                    fontSize: '0.62rem',
                    fontWeight: '800',
                    borderRadius: '10px',
                    padding: '0 5px',
                    height: '15px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {totalUnread}
                  </span>
                )}
              </button>
            </div>

            {/* Window Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <button
                onClick={() => {
                  setIsOpen(false);
                  if (onOpenFullChat) onOpenFullChat(targetChatId);
                  window.dispatchEvent(new CustomEvent('teamshub:open-chat', { detail: { chatId: targetChatId } }));
                }}
                className="tab-pill-3d"
                title="Expand to Full Chat Page"
                style={{ width: '26px', height: '26px', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}
              >
                <Maximize2 size={13} />
              </button>
              <button
                onClick={() => setIsMinimized(true)}
                className="tab-pill-3d"
                title="Minimize"
                style={{ width: '26px', height: '26px', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}
              >
                <Minimize2 size={13} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="tab-pill-3d"
                title="Close"
                style={{ width: '26px', height: '26px', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* TAB 1: NOTIFICATIONS STREAM */}
          {activeTab === 'notifications' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: 'var(--bg-primary)' }}>
              <div style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-secondary)'
              }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  Unread Notifications ({totalUnread})
                </span>
                {totalUnread > 0 && (
                  <button
                    onClick={() => {
                      unreadChats.forEach(c => markChatAsRead(c._id || c.id || c.microsoftChatId, c.connectedAccountId));
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-primary)',
                      fontSize: '0.74rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      padding: '2px 6px'
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {unreadChats.length === 0 ? (
                  <div style={{
                    padding: '36px 16px',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '0.84rem'
                  }}>
                    <CheckCircle2 size={28} color="#10b981" style={{ marginBottom: '8px', opacity: 0.8 }} />
                    <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>All caught up!</div>
                    <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>No unread messages across your accounts</div>
                  </div>
                ) : (
                  unreadChats.map((chat) => {
                    const chatId = chat._id || chat.id || chat.microsoftChatId;
                    const participant = chat.participant || 'Teams User';
                    const preview = (chat.lastMessagePreview || '')
                      .replace(/<[^>]*>/g, '')
                      .replace(/&nbsp;/gi, ' ')
                      .replace(/&amp;/gi, '&')
                      .replace(/&lt;/gi, '<')
                      .replace(/&gt;/gi, '>')
                      .replace(/&quot;/gi, '"')
                      .replace(/&#39;/gi, "'")
                      .replace(/\s+/g, ' ')
                      .trim() || 'Sent you a new message';
                    const badge = chat.company || chat.accountBadge || 'Teams';

                    return (
                      <div
                        key={chatId}
                        onClick={() => {
                          markChatAsRead(chatId, chat.connectedAccountId);
                          setActiveMiniChatId(chatId);
                          setActiveTab('chat');
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '9px 10px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--bg-secondary)',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                          border: '1px solid var(--border-color)',
                          boxShadow: 'var(--shadow-sm)'
                        }}
                      >
                        <div style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '50%',
                          backgroundColor: getAvatarColor(participant),
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '700',
                          fontSize: '0.78rem',
                          flexShrink: 0
                        }}>
                          {getInitials(participant)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {participant}
                            </span>
                            <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                              {badge}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
                            {preview}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: QUICK CHAT CONVERSATION */}
          {activeTab === 'chat' && activeChat && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Participant Bar + Switcher */}
              <div
                onClick={() => setShowAccountMenu(!showAccountMenu)}
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}
                title="Click to switch conversation"
              >
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: getAvatarColor(activeChat.participant),
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '0.76rem',
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
                    fontSize: '0.82rem',
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    <span>{activeChat.participant}</span>
                    <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <div style={{
                    fontSize: '0.68rem',
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
        </div>
      )}

      {/* Floating Circular Action Bubble (Chat & Notifications Hub) */}
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
        title="TeamsHub Quick Hub (Chat & Notifications)"
      >
        {isOpen && !isMinimized ? (
          <X size={24} />
        ) : totalUnread > 0 ? (
          <Bell size={24} />
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
