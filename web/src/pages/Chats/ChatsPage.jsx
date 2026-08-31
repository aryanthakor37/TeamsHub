import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, RefreshCw, MessageSquare, AlertCircle, Sparkles, LogIn,
  ArrowLeft, Columns, Split, ExternalLink
} from 'lucide-react';
import { useChats } from '../../hooks/useChats';
import { useAuth } from '../../hooks/useAuth';
import { getInitials, getAvatarColor } from '../../utils/avatarUtils';
import DocumentPreviewModal from '../../components/DocumentPreviewModal';
import ChatConversationPane from './ChatConversationPane';

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

export default function ChatsPage({
  onOpenMicrosoftModal,
  initialChatId,
  initialParticipant,
  initialMessageId,
  initialKeyword
}) {
  const { connectedAccounts } = useAuth();
  const [selectedFilterAccount, setSelectedFilterAccount] = useState('all');
  const { chats, loading: chatsLoading, refreshing, refresh, bumpChatToTop, markChatAsRead } = useChats();
  const [activeChatId, setActiveChatId] = useState(initialChatId || null);
  const [splitChatId, setSplitChatId] = useState(null);
  const [isSplitActive, setIsSplitActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewDocModal, setPreviewDocModal] = useState(null);

  // Track applied initial navigation key
  const appliedInitialChatRef = useRef(null);

  useEffect(() => {
    if (initialChatId || initialParticipant) {
      const key = `${initialChatId || ''}-${initialParticipant || ''}`;
      if (appliedInitialChatRef.current !== key) {
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
      const { chatId, participant } = e.detail || {};
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

    const accId = (c.connectedAccountId || '').toLowerCase().trim();
    if (accId && accId.includes('@')) return accId;

    const foundByAccId = (connectedAccounts || []).find(a => {
      const id = (a._id || a.accountId || a.id || '').toString().toLowerCase().trim();
      return id && (id === accId || accId.includes(id));
    });
    if (foundByAccId && foundByAccId.email) return foundByAccId.email.toLowerCase().trim();

    return email || accId;
  };

  // Strictly deduplicate connected accounts by primary email
  const uniqueConnectedAccounts = useMemo(() => {
    const map = new Map();
    (connectedAccounts || []).forEach(acc => {
      const email = (acc.email || acc.username || '').toLowerCase().trim();
      if (email && !map.has(email)) {
        map.set(email, acc);
      }
    });
    return Array.from(map.values());
  }, [connectedAccounts]);

  // Extract all unique verified Guest Workspaces / Organizations from actual chats
  const guestOrganizations = useMemo(() => {
    if (!isAccountConnected || uniqueConnectedAccounts.length === 0) return [];
    const orgs = new Set();
    const connectedEmails = uniqueConnectedAccounts.map(a => (a.email || a.username || '').toLowerCase().trim());
    const connectedUsers = connectedEmails.map(e => e.split('@')[0]);
    const connectedNames = uniqueConnectedAccounts.map(a => (a.displayName || a.name || '').toLowerCase().trim().replace(/[`'"]/g, ''));
    const homeDomains = uniqueConnectedAccounts.map(a => (a.email || '').split('@')[1]?.toLowerCase()).filter(Boolean);

    (chats || []).forEach(c => {
      const comp = (c.company || c.accountBadge || '').trim();
      const compLower = comp.toLowerCase().replace(/[`'"]/g, '');
      const isOwnerIdentity =
        connectedEmails.includes(compLower) ||
        connectedUsers.includes(compLower) ||
        connectedNames.includes(compLower) ||
        connectedUsers.some(u => u && (compLower === u || compLower.includes(u) || u.includes(compLower))) ||
        connectedNames.some(n => n && (compLower === n || compLower.includes(n) || n.includes(compLower)));

      if (
        comp &&
        !isOwnerIdentity &&
        !compLower.includes('microsoft account') &&
        !compLower.includes('teams chat') &&
        !compLower.includes('direct message') &&
        !compLower.includes('estatic') &&
        !homeDomains.some(d => d && compLower.includes(d.split('.')[0]))
      ) {
        orgs.add(comp);
      }
    });
    return Array.from(orgs);
  }, [chats, uniqueConnectedAccounts, isAccountConnected]);

  const filteredChats = !isAccountConnected ? [] : chats.filter((chat) => {
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
    const chatOwnerEmail = getChatOwnerEmail(chat).toLowerCase().trim();
    const chatAccId = (chat.connectedAccountId || '').toLowerCase().trim();

    if (chatOwnerEmail) {
      if (chatOwnerEmail === filterKey || chatOwnerEmail.includes(filterKey) || filterKey.includes(chatOwnerEmail)) return true;
      const ownerUser = chatOwnerEmail.split('@')[0];
      const filterUser = filterKey.includes('@') ? filterKey.split('@')[0] : filterKey;
      if (ownerUser && filterUser && (ownerUser === filterUser || ownerUser.includes(filterUser) || filterUser.includes(ownerUser))) return true;
    }
    if (chatAccId && (chatAccId === filterKey || chatAccId.includes(filterKey) || filterKey.includes(chatAccId))) return true;

    const isGuestOrg = guestOrganizations.some(org => org.toLowerCase() === filterKey);
    if (isGuestOrg) {
      const chatCompany = (chat.company || chat.accountBadge || '').toLowerCase().trim();
      return chatCompany === filterKey || chatCompany.includes(filterKey);
    }

    return false;
  });

  // Set active chat instantaneously based on current filtered view
  const isSelectedChatInFiltered = filteredChats.some(c => (c._id === activeChatId || c.microsoftChatId === activeChatId || c.id === activeChatId));
  const selectedChatId = isAccountConnected 
    ? (isSelectedChatInFiltered ? activeChatId : (filteredChats.length > 0 ? (filteredChats[0]._id || filteredChats[0].microsoftChatId || filteredChats[0].id) : null))
    : null;

  const activeChat = isAccountConnected 
    ? (filteredChats.find((c) => (c._id === selectedChatId || c.microsoftChatId === selectedChatId || c.id === selectedChatId)) ||
       chats.find((c) => (c._id === selectedChatId || c.microsoftChatId === selectedChatId || c.id === selectedChatId)))
    : null;

  // Resolve split second chat
  const splitChat = useMemo(() => {
    if (!isSplitActive || !chats || chats.length === 0) return null;
    if (splitChatId) {
      const found = chats.find(c => c._id === splitChatId || c.microsoftChatId === splitChatId || c.id === splitChatId);
      if (found) return found;
    }
    // Default to another conversation (different from activeChat)
    const other = chats.find(c => (c._id || c.microsoftChatId || c.id) !== selectedChatId);
    return other || chats[0];
  }, [isSplitActive, splitChatId, chats, selectedChatId]);

  // Synchronize active chat ID globally to suppress self-notifications on active view & auto-mark read
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__teamshub_active_chat_id = selectedChatId;
    }
    if (selectedChatId) {
      markChatAsRead(selectedChatId, activeChat?.connectedAccountId);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.__teamshub_active_chat_id = null;
      }
    };
  }, [selectedChatId, activeChat?.connectedAccountId, markChatAsRead]);

  const handleOpenInSplit = (chatIdToSplit) => {
    setSplitChatId(chatIdToSplit);
    setIsSplitActive(true);
    markChatAsRead(chatIdToSplit);
  };

  const handleToggleSplit = () => {
    if (isSplitActive) {
      setIsSplitActive(false);
    } else {
      setIsSplitActive(true);
      if (!splitChatId) {
        const other = chats.find(c => (c._id || c.microsoftChatId || c.id) !== selectedChatId);
        if (other) {
          setSplitChatId(other._id || other.microsoftChatId || other.id);
        }
      }
    }
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: 'calc(100vh - 66px)', overflow: 'hidden', backgroundColor: 'var(--bg-primary)' }}>
      {/* Left Chat List Column */}
      <div
        className={`chats-sidebar-list ${activeChatId ? 'mobile-hidden' : ''}`}
        style={{
          width: '320px',
          borderRight: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0
        }}
      >
        {/* Header Title & Sync Button */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span style={{ fontWeight: '800', fontSize: '1.02rem', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Teams Conversations
          </span>
          <button
            className="tab-pill-3d"
            onClick={refresh}
            disabled={refreshing}
            style={{
              padding: '5px 10px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--accent-primary)',
              fontSize: '0.75rem',
              fontWeight: '700',
              cursor: refreshing ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <RefreshCw size={12} className={refreshing ? 'spin-smooth' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Sync'}</span>
          </button>
        </div>

        {/* Filter Account & Organizations Pills (Flex Wrap to next line) */}
        <div
          style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            backgroundColor: 'var(--bg-tertiary)'
          }}
        >
          <button
            onClick={() => setSelectedFilterAccount('all')}
            style={{
              padding: '5px 12px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.74rem',
              fontWeight: '700',
              border: selectedFilterAccount === 'all' ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
              backgroundColor: selectedFilterAccount === 'all' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
              color: selectedFilterAccount === 'all' ? '#ffffff' : 'var(--text-secondary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <Sparkles size={12} />
            <span>All Accounts</span>
            <span style={{ opacity: 0.85, fontSize: '0.68rem', backgroundColor: selectedFilterAccount === 'all' ? 'rgba(255,255,255,0.25)' : 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: '10px' }}>
              {chats.length}
            </span>
          </button>

          {uniqueConnectedAccounts.map((acc) => {
            const email = (acc.email || acc.username || '').toLowerCase().trim();
            const displayName = acc.displayName || acc.name || (email ? email.split('@')[0] : 'Account');
            const isSelected = selectedFilterAccount === email;
            return (
              <button
                key={email}
                onClick={() => setSelectedFilterAccount(email)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.74rem',
                  fontWeight: '700',
                  border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                  backgroundColor: isSelected ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                  color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: getAvatarColor(displayName) }} />
                <span>{displayName}</span>
              </button>
            );
          })}

          {guestOrganizations.map((org) => {
            const isSelected = selectedFilterAccount === org.toLowerCase();
            return (
              <button
                key={org}
                onClick={() => setSelectedFilterAccount(org.toLowerCase())}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.74rem',
                  fontWeight: '700',
                  border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                  backgroundColor: isSelected ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                  color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <span>{org}</span>
              </button>
            );
          })}
        </div>

        {/* Search Filter Input */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by name, company, or message..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px 7px 30px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Chat List Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {!isAccountConnected ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
                <LogIn size={22} color="var(--accent-primary)" />
              </div>
              <div style={{ fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                No Account Connected
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.4' }}>
                Connect a Microsoft Teams account to sync and view conversations.
              </div>
              <button
                className="btn btn-primary"
                onClick={() => onOpenMicrosoftModal && onOpenMicrosoftModal()}
                style={{ fontSize: '0.8rem', padding: '8px 16px', margin: '0 auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <LogIn size={14} />
                <span>Connect Account</span>
              </button>
            </div>
          ) : chatsLoading && chats.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: '32px', fontSize: '0.84rem' }}>
              Loading conversations...
            </div>
          ) : filteredChats.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Search size={28} style={{ opacity: 0.4, margin: '0 auto 8px auto' }} />
              <div style={{ fontSize: '0.85rem', fontWeight: '600' }}>No chats found</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {filteredChats.map((c) => {
                const chatId = c._id || c.microsoftChatId || c.id;
                const isSelected = selectedChatId === chatId || (isSplitActive && splitChatId === chatId);

                return (
                  <div
                    key={`${c.accountEmail || 'acc'}_${chatId}`}
                    onClick={() => {
                      setActiveChatId(chatId);
                      markChatAsRead(chatId, c.connectedAccountId);
                    }}
                    className={isSelected ? 'chat-item-3d active' : 'chat-item-3d'}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '9px 10px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isSelected ? 'var(--accent-light)' : 'transparent',
                      borderLeft: isSelected ? '3.5px solid var(--accent-primary)' : '3.5px solid transparent',
                      cursor: 'pointer',
                      position: 'relative'
                    }}
                  >
                    {/* Avatar */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div className="avatar-3d" style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        backgroundColor: getAvatarColor(c.participant),
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                        fontSize: '0.88rem'
                      }}>
                        {getInitials(c.participant)}
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

                    {/* Chat Text Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontWeight: isSelected ? '700' : '600', fontSize: '0.85rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.participant}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {c.lastMessageTimestamp ? new Date(c.lastMessageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                          {c.unreadCount > 0 && (
                            <span style={{
                              backgroundColor: '#ef4444',
                              color: '#fff',
                              fontSize: '0.62rem',
                              fontWeight: '800',
                              padding: '1px 6px',
                              borderRadius: '10px'
                            }}>
                              {c.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '3px' }}>
                        {formatChatPreview(c.lastMessagePreview)}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className={`badge ${c.accountBadge || 'badge-company-a'}`} style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                          {c.company}
                        </span>

                        {/* Quick Split / Popout action buttons */}
                        <div
                          className="chat-hover-actions"
                          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleOpenInSplit(chatId)}
                            title="Open in Side-by-Side Split View"
                            style={{
                              background: 'var(--bg-tertiary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '4px',
                              padding: '2px 6px',
                              fontSize: '0.68rem',
                              fontWeight: '600',
                              color: 'var(--accent-primary)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px'
                            }}
                          >
                            <Split size={10} />
                            <span>Split</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Conversation Thread View Pane (Supports Single & Split View) */}
      <div className={`chats-active-pane ${!activeChatId ? 'mobile-hidden' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'row', backgroundColor: 'var(--bg-primary)', overflow: 'hidden' }}>
        {isAccountConnected && activeChat ? (
          <>
            {/* Primary Left Conversation Pane */}
            <ChatConversationPane
              chat={activeChat}
              allChats={chats}
              onSelectChat={(id) => setActiveChatId(id)}
              isSplit={isSplitActive}
              onToggleSplit={handleToggleSplit}
              onOpenMicrosoftModal={onOpenMicrosoftModal}
              onPreviewDoc={(doc) => setPreviewDocModal(doc)}
              bumpChatToTop={bumpChatToTop}
              onBack={() => setActiveChatId(null)}
              paneTitle="Primary Chat"
            />

            {/* Secondary Right Conversation Pane (Split View) */}
            {isSplitActive && splitChat && (
              <ChatConversationPane
                chat={splitChat}
                allChats={chats}
                onSelectChat={(id) => setSplitChatId(id)}
                isSplit={true}
                isSplitSecondPane={true}
                onCloseSplit={() => setIsSplitActive(false)}
                onOpenMicrosoftModal={onOpenMicrosoftModal}
                onPreviewDoc={(doc) => setPreviewDocModal(doc)}
                bumpChatToTop={bumpChatToTop}
                paneTitle="Split Chat"
              />
            )}
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto' }}>
              <LogIn size={26} color="var(--accent-primary)" />
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
              {!isAccountConnected ? 'No Microsoft Account Connected' : 'Select a conversation to start chatting'}
            </div>
            <div style={{ fontSize: '0.85rem', maxWidth: '420px', lineHeight: '1.5', marginBottom: !isAccountConnected ? '18px' : '0' }}>
              {!isAccountConnected
                ? 'Sign in with your work or personal Microsoft account to access all chats and messages in one unified workspace.'
                : 'All your Microsoft Teams chats from all accounts & guest organizations are synced in real-time.'}
            </div>
            {!isAccountConnected && (
              <button
                className="btn btn-primary"
                onClick={() => onOpenMicrosoftModal && onOpenMicrosoftModal()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontSize: '0.9rem' }}
              >
                <LogIn size={16} />
                <span>Connect Microsoft Account</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Document Preview Modal */}
      {previewDocModal && (
        <DocumentPreviewModal
          document={previewDocModal}
          onClose={() => setPreviewDocModal(null)}
        />
      )}
    </div>
  );
}
