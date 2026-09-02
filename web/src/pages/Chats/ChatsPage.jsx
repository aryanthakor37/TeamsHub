import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, RefreshCw, MessageSquare, AlertCircle, Sparkles, LogIn,
  ArrowLeft, Columns, Split, ExternalLink, PanelLeftClose, PanelLeftOpen,
  LayoutGrid, Grid2X2, Square
} from 'lucide-react';
import { useChats } from '../../hooks/useChats';
import { useAuth } from '../../hooks/useAuth';
import { getInitials, getAvatarColor } from '../../utils/avatarUtils';
import { decodeHtmlEntities, cleanHtmlText, sanitizeDisplayName } from '../../utils/textUtils';
import DocumentPreviewModal from '../../components/DocumentPreviewModal';
import ChatConversationPane from './ChatConversationPane';

// Helper to decode HTML entities like &nbsp;, &amp;, etc. for clean preview display
export const formatChatPreview = (str) => cleanHtmlText(str);

export default function ChatsPage({
  onOpenMicrosoftModal,
  initialChatId,
  initialParticipant,
  initialMessageId,
  initialKeyword,
  layoutMode: externalLayoutMode = 'triple',
  onSetLayoutMode
}) {
  const { connectedAccounts } = useAuth();
  const [selectedFilterAccount, setSelectedFilterAccount] = useState('all');
  const { chats, loading: chatsLoading, refreshing, refresh, bumpChatToTop, markChatAsRead } = useChats();
  const [activeChatId, setActiveChatId] = useState(initialChatId || null);
  const [activeChatKey, setActiveChatKey] = useState(null);

  // Multi-Pane Workspace States: 'single' | 'dual' | 'triple' | 'quad'
  const [layoutMode, setLayoutMode] = useState(externalLayoutMode || 'triple');
  const [splitChatId, setSplitChatId] = useState(null);
  const [splitChatKey, setSplitChatKey] = useState(null);
  const [pane3ChatId, setPane3ChatId] = useState(null);
  const [pane3ChatKey, setPane3ChatKey] = useState(null);
  const [pane4ChatId, setPane4ChatId] = useState(null);
  const [pane4ChatKey, setPane4ChatKey] = useState(null);

  const isSplitActive = layoutMode !== 'single';
  const [searchQuery, setSearchQuery] = useState('');
  const [previewDocModal, setPreviewDocModal] = useState(null);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  // Sync external layout mode if changed
  useEffect(() => {
    if (externalLayoutMode && externalLayoutMode !== layoutMode) {
      setLayout(externalLayoutMode);
    }
  }, [externalLayoutMode]);

  useEffect(() => {
    const handleLayoutEvent = (e) => {
      if (e.detail?.mode) {
        setLayout(e.detail.mode);
      }
    };
    window.addEventListener('teamshub:set-layout-mode', handleLayoutEvent);
    return () => window.removeEventListener('teamshub:set-layout-mode', handleLayoutEvent);
  }, [chats, activeChatId]);

  // Helper for 100% unique identification across multiple accounts
  const getChatUniqueKey = (c) => {
    if (!c) return '';
    const id = c._id || c.microsoftChatId || c.id || '';
    const owner = (c.accountEmail || c.accountBadge || c.company || c.connectedAccountId || 'acc').toLowerCase().trim();
    return `${owner}___${id}`;
  };

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
          setActiveChatKey(getChatUniqueKey(found));
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
          setActiveChatKey(getChatUniqueKey(found));
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

  // Extract unique true guest organizations (exclude connected accounts' names & emails)
  const guestOrganizations = useMemo(() => {
    if (!isAccountConnected || uniqueConnectedAccounts.length === 0) return [];
    const orgs = new Set();
    const connectedEmails = uniqueConnectedAccounts.map(a => (a.email || a.username || '').toLowerCase().trim());
    const connectedUsers = connectedEmails.map(e => e.split('@')[0]);
    const connectedNames = uniqueConnectedAccounts.map(a => (a.displayName || a.name || '').toLowerCase().trim().replace(/[`'"]/g, ''));
    const homeDomains = uniqueConnectedAccounts.map(a => (a.email || '').split('@')[1]?.toLowerCase()).filter(Boolean);

    (chats || []).forEach(c => {
      const comp = (c.company || '').trim();
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
        !compLower.includes('teams') &&
        !compLower.includes('microsoft') &&
        !compLower.includes('direct message') &&
        !compLower.includes('estatic') &&
        !compLower.includes('@') &&
        !homeDomains.some(d => d && compLower.includes(d.split('.')[0]))
      ) {
        orgs.add(comp);
      }
    });
    return Array.from(orgs);
  }, [chats, uniqueConnectedAccounts, isAccountConnected]);

  // Enhanced Filter Logic
  const filteredChats = chats.filter((chat) => {
    const pName = (chat.participant || '').toLowerCase();
    const lMsg = (chat.lastMessagePreview || '').toLowerCase();
    const query = searchQuery.toLowerCase();

    if (query && !pName.includes(query) && !lMsg.includes(query)) {
      return false;
    }

    if (!selectedFilterAccount || selectedFilterAccount === 'all') return true;

    const filterKey = selectedFilterAccount.toLowerCase().trim();
    const chatOwnerEmail = getChatOwnerEmail(chat);
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

  // Set active chat: prioritize explicitly selected chat by unique key / ID, fallback to first chat
  const activeChat = useMemo(() => {
    if (!isAccountConnected || !chats || chats.length === 0) return null;
    if (activeChatKey) {
      const match = chats.find(c => getChatUniqueKey(c) === activeChatKey);
      if (match) return match;
    }
    if (activeChatId) {
      const match = chats.find(c => (c._id === activeChatId || c.microsoftChatId === activeChatId || c.id === activeChatId));
      if (match) return match;
    }
    return filteredChats.length > 0 ? filteredChats[0] : chats[0];
  }, [isAccountConnected, chats, activeChatKey, activeChatId, filteredChats]);

  const selectedChatId = activeChat ? (activeChat._id || activeChat.microsoftChatId || activeChat.id) : null;

  // Resolve split second chat (Pane 2)
  const splitChat = useMemo(() => {
    if (!isSplitActive || !chats || chats.length === 0) return null;
    if (splitChatKey) {
      const match = chats.find(c => getChatUniqueKey(c) === splitChatKey);
      if (match) return match;
    }
    if (splitChatId) {
      const found = chats.find(c => c._id === splitChatId || c.microsoftChatId === splitChatId || c.id === splitChatId);
      if (found) return found;
    }
    const activeKey = activeChat ? getChatUniqueKey(activeChat) : '';
    const other = chats.find(c => getChatUniqueKey(c) !== activeKey);
    return other || chats[0];
  }, [isSplitActive, splitChatKey, splitChatId, chats, activeChat]);

  // Resolve third chat (Pane 3)
  const pane3Chat = useMemo(() => {
    if ((layoutMode !== 'triple' && layoutMode !== 'quad') || !chats || chats.length === 0) return null;
    if (pane3ChatKey) {
      const match = chats.find(c => getChatUniqueKey(c) === pane3ChatKey);
      if (match) return match;
    }
    if (pane3ChatId) {
      const found = chats.find(c => c._id === pane3ChatId || c.microsoftChatId === pane3ChatId || c.id === pane3ChatId);
      if (found) return found;
    }
    const usedKeys = [activeChat ? getChatUniqueKey(activeChat) : '', splitChat ? getChatUniqueKey(splitChat) : ''];
    const other = chats.find(c => !usedKeys.includes(getChatUniqueKey(c)));
    return other || chats[2] || chats[0];
  }, [layoutMode, pane3ChatKey, pane3ChatId, chats, activeChat, splitChat]);

  // Resolve fourth chat (Pane 4)
  const pane4Chat = useMemo(() => {
    if (layoutMode !== 'quad' || !chats || chats.length === 0) return null;
    if (pane4ChatKey) {
      const match = chats.find(c => getChatUniqueKey(c) === pane4ChatKey);
      if (match) return match;
    }
    if (pane4ChatId) {
      const found = chats.find(c => c._id === pane4ChatId || c.microsoftChatId === pane4ChatId || c.id === pane4ChatId);
      if (found) return found;
    }
    const usedKeys = [
      activeChat ? getChatUniqueKey(activeChat) : '',
      splitChat ? getChatUniqueKey(splitChat) : '',
      pane3Chat ? getChatUniqueKey(pane3Chat) : ''
    ];
    const other = chats.find(c => !usedKeys.includes(getChatUniqueKey(c)));
    return other || chats[3] || chats[0];
  }, [layoutMode, pane4ChatKey, pane4ChatId, chats, activeChat, splitChat, pane3Chat]);

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

  // Layout mode switcher helper with smart auto-seeding of panes
  const setLayout = (mode) => {
    setLayoutMode(mode);
    if (mode === 'single') return;

    // Auto-collapse sidebar in 3 or 4-pane views for maximum workspace
    if (mode === 'triple' || mode === 'quad') {
      setIsSidebarCollapsed(true);
    }

    // Auto-seed Pane 2
    if (!splitChatId && chats.length > 1) {
      const activeKey = activeChat ? getChatUniqueKey(activeChat) : '';
      const other2 = chats.find(c => getChatUniqueKey(c) !== activeKey);
      if (other2) {
        setSplitChatId(other2._id || other2.microsoftChatId || other2.id);
        setSplitChatKey(getChatUniqueKey(other2));
      }
    }

    // Auto-seed Pane 3
    if ((mode === 'triple' || mode === 'quad') && !pane3ChatId && chats.length > 2) {
      const usedKeys = [activeChat ? getChatUniqueKey(activeChat) : '', splitChat ? getChatUniqueKey(splitChat) : ''];
      const other3 = chats.find(c => !usedKeys.includes(getChatUniqueKey(c)));
      if (other3) {
        setPane3ChatId(other3._id || other3.microsoftChatId || other3.id);
        setPane3ChatKey(getChatUniqueKey(other3));
      }
    }

    // Auto-seed Pane 4
    if (mode === 'quad' && !pane4ChatId && chats.length > 3) {
      const usedKeys = [
        activeChat ? getChatUniqueKey(activeChat) : '',
        splitChat ? getChatUniqueKey(splitChat) : '',
        pane3Chat ? getChatUniqueKey(pane3Chat) : ''
      ];
      const other4 = chats.find(c => !usedKeys.includes(getChatUniqueKey(c)));
      if (other4) {
        setPane4ChatId(other4._id || other4.microsoftChatId || other4.id);
        setPane4ChatKey(getChatUniqueKey(other4));
      }
    }
  };

  const handleOpenInSplit = (chatIdToSplit, chatObj = null) => {
    setSplitChatId(chatIdToSplit);
    if (chatObj) setSplitChatKey(getChatUniqueKey(chatObj));
    if (layoutMode === 'single') {
      setLayout('dual');
    }
    markChatAsRead(chatIdToSplit);
  };

  const handleToggleSplit = () => {
    if (layoutMode !== 'single') {
      setLayout('single');
    } else {
      setLayout('dual');
    }
  };

  // Global Keyboard shortcuts: Alt+1..4 (focus pane or set layout), Alt+S (dual), Alt+T (triple), Alt+G (quad)
  useEffect(() => {
    const handleGlobalKey = (e) => {
      if (e.altKey) {
        if (e.key === 's' || e.key === 'S') {
          e.preventDefault();
          handleToggleSplit();
        } else if (e.key === 't' || e.key === 'T') {
          e.preventDefault();
          setLayout(layoutMode === 'triple' ? 'single' : 'triple');
        } else if (e.key === 'g' || e.key === 'G') {
          e.preventDefault();
          setLayout(layoutMode === 'quad' ? 'single' : 'quad');
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [layoutMode, splitChatId, chats, selectedChatId, activeChat, splitChat, pane3Chat]);

  return (
    <div style={{ display: 'flex', width: '100%', height: 'calc(100vh - 66px)', overflow: 'hidden', backgroundColor: 'transparent' }}>
      {/* Left Chat List Column (Supports Full & Collapsed Compact Mode) */}
      <div
        className={`chats-sidebar-list ${activeChatId ? 'mobile-hidden' : ''}`}
        style={{
          width: isSidebarCollapsed ? '68px' : '310px',
          transition: 'width 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: 'rgba(12, 16, 28, 0.48)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          overflow: 'hidden'
        }}
      >
        {/* Header Title, Sync & Collapse Button */}
        {isSidebarCollapsed ? (
          <div style={{
            padding: '14px 0',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <button
              className="tab-pill-3d"
              onClick={() => setIsSidebarCollapsed(false)}
              title="Expand Sidebar"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--accent-primary)',
                padding: '7px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <PanelLeftOpen size={18} />
            </button>
          </div>
        ) : (
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span style={{ fontWeight: '800', fontSize: '1.02rem', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              Conversations
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                className="tab-pill-3d"
                onClick={refresh}
                disabled={refreshing}
                style={{
                  padding: '5px 9px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--accent-primary)',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  cursor: refreshing ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <RefreshCw size={11} className={refreshing ? 'spin-smooth' : ''} />
                <span>{refreshing ? 'Syncing...' : 'Sync'}</span>
              </button>
              <button
                className="tab-pill-3d"
                onClick={() => setIsSidebarCollapsed(true)}
                title="Collapse Sidebar for More Space"
                style={{
                  padding: '5px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <PanelLeftClose size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Filter Account & Organizations Pills (Visible when expanded) */}
        {!isSidebarCollapsed && (
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
              const displayName = sanitizeDisplayName(acc.displayName || acc.name || (email ? email.split('@')[0] : 'Account'));
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
        )}

        {/* Search Filter Input (Visible when expanded) */}
        {!isSidebarCollapsed && (
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
        )}

        {/* Chat List Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: isSidebarCollapsed ? '8px 6px' : '8px' }}>
          {!isAccountConnected ? (
            <div style={{ padding: '40px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px auto' }}>
                <LogIn size={20} color="var(--accent-primary)" />
              </div>
              {!isSidebarCollapsed && (
                <>
                  <div style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
                    No Account
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => onOpenMicrosoftModal && onOpenMicrosoftModal()}
                    style={{ fontSize: '0.76rem', padding: '6px 12px', margin: '10px auto 0 auto', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <LogIn size={13} />
                    <span>Connect</span>
                  </button>
                </>
              )}
            </div>
          ) : chatsLoading && chats.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: '32px', fontSize: '0.8rem' }}>
              Loading...
            </div>
          ) : filteredChats.length === 0 ? (
            <div style={{ padding: '32px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Search size={24} style={{ opacity: 0.4, margin: '0 auto 6px auto' }} />
              {!isSidebarCollapsed && <div style={{ fontSize: '0.8rem', fontWeight: '600' }}>No chats found</div>}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: isSidebarCollapsed ? '8px' : '4px' }}>
              {filteredChats.map((c) => {
                const chatId = c._id || c.microsoftChatId || c.id;
                const uniqueKey = getChatUniqueKey(c);
                const isPane1Selected = activeChat && getChatUniqueKey(activeChat) === uniqueKey;
                const isPane2Selected = isSplitActive && splitChat && getChatUniqueKey(splitChat) === uniqueKey;
                const isPane3Selected = (layoutMode === 'triple' || layoutMode === 'quad') && pane3Chat && getChatUniqueKey(pane3Chat) === uniqueKey;
                const isPane4Selected = layoutMode === 'quad' && pane4Chat && getChatUniqueKey(pane4Chat) === uniqueKey;

                let activeBorder = '1px solid transparent';
                let activeBg = 'transparent';
                let activeBorderLeft = '3.5px solid transparent';
                let paneBadge = null;

                if (isPane1Selected) {
                  activeBorder = '2px solid #6366f1';
                  activeBg = 'rgba(99, 102, 241, 0.18)';
                  activeBorderLeft = '3.5px solid #6366f1';
                  paneBadge = 'P1';
                } else if (isPane2Selected) {
                  activeBorder = '2px solid #00f2fe';
                  activeBg = 'rgba(0, 242, 254, 0.18)';
                  activeBorderLeft = '3.5px solid #00f2fe';
                  paneBadge = 'P2';
                } else if (isPane3Selected) {
                  activeBorder = '2px solid #ec4899';
                  activeBg = 'rgba(236, 72, 153, 0.18)';
                  activeBorderLeft = '3.5px solid #ec4899';
                  paneBadge = 'P3';
                } else if (isPane4Selected) {
                  activeBorder = '2px solid #f59e0b';
                  activeBg = 'rgba(245, 158, 11, 0.18)';
                  activeBorderLeft = '3.5px solid #f59e0b';
                  paneBadge = 'P4';
                }

                const isAnyPaneSelected = isPane1Selected || isPane2Selected || isPane3Selected || isPane4Selected;

                if (isSidebarCollapsed) {
                  return (
                    <div
                      key={uniqueKey}
                      onClick={() => {
                        setActiveChatId(chatId);
                        setActiveChatKey(uniqueKey);
                        markChatAsRead(chatId, c.connectedAccountId);
                      }}
                      title={`${c.participant} (${c.company || 'Teams'})`}
                      style={{
                        width: '46px',
                        height: '46px',
                        margin: '0 auto',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: activeBg,
                        border: activeBorder,
                        boxShadow: isAnyPaneSelected ? `0 0 14px ${isPane1Selected ? 'rgba(99,102,241,0.3)' : isPane2Selected ? 'rgba(0,242,254,0.3)' : isPane3Selected ? 'rgba(236,72,153,0.3)' : 'rgba(245,158,11,0.3)'}` : 'none',
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div className="avatar-3d" style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: getAvatarColor(c.participant),
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                        fontSize: '0.76rem'
                      }}>
                        {getInitials(c.participant)}
                      </div>
                      {c.unreadCount > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '-2px',
                          right: '-2px',
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          backgroundColor: '#ef4444',
                          color: '#fff',
                          fontSize: '0.55rem',
                          fontWeight: '800',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {c.unreadCount}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div
                    key={uniqueKey}
                    onClick={() => {
                      setActiveChatId(chatId);
                      setActiveChatKey(uniqueKey);
                      markChatAsRead(chatId, c.connectedAccountId);
                    }}
                    className={isAnyPaneSelected ? 'chat-item-3d active' : 'chat-item-3d'}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '9px 10px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: activeBg,
                      borderLeft: activeBorderLeft,
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Avatar with Live Indicator */}
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
                          {sanitizeDisplayName(c.participant)}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {c.lastMessageTimestamp ? new Date(c.lastMessageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <p style={{
                          margin: 0,
                          fontSize: '0.76rem',
                          color: c.unreadCount > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                          fontWeight: c.unreadCount > 0 ? '700' : '400',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1
                        }}>
                          {formatChatPreview(c.lastMessagePreview) || 'No messages yet'}
                        </p>
                        {c.unreadCount > 0 && (
                          <span style={{
                            backgroundColor: '#ef4444',
                            color: '#ffffff',
                            borderRadius: '10px',
                            padding: '1px 6px',
                            fontSize: '0.65rem',
                            fontWeight: '800',
                            marginLeft: '6px',
                            flexShrink: 0
                          }}>
                            {c.unreadCount}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                        <span style={{
                          fontSize: '0.66rem',
                          color: 'var(--accent-primary)',
                          fontWeight: '700',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {sanitizeDisplayName(c.company || c.accountBadge || 'Teams')}
                        </span>

                        {/* Hover Quick Split Button */}
                        <div
                          className="chat-hover-actions"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleOpenInSplit(chatId, c)}
                            className="tab-pill-3d"
                            title="Open in Dual Split View"
                            style={{
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontSize: '0.65rem',
                              fontWeight: '700',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-tertiary)',
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
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

      {/* Main Conversation Thread View Pane (Supports Single, Dual, Triple & 2x2 Quad Grid) */}
      <div
        className={`chats-active-pane ${!activeChatId ? 'mobile-hidden' : ''}`}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'transparent',
          overflow: 'hidden',
          height: '100%',
          position: 'relative'
        }}
      >
        {isAccountConnected && activeChat ? (
          <>
            {/* Dynamic Multi-Pane Grid / Flex Container with Glassmorphism & Neon Glow Pills (Full Height) */}
            <div style={{
              flex: 1,
              overflow: 'hidden',
              padding: '18px 16px 16px 16px',
              display: 'grid',
              gap: '16px',
              gridTemplateColumns: layoutMode === 'single'
                ? '1fr'
                : layoutMode === 'triple'
                  ? 'repeat(3, minmax(0, 1fr))'
                  : 'repeat(2, minmax(0, 1fr))',
              gridTemplateRows: layoutMode === 'quad'
                ? 'repeat(2, minmax(0, 1fr))'
                : '1fr',
              height: '100%'
            }}>
              {/* Primary Pane 1 (Cyan / Aqua Neon Pill) */}
              <div
                className="modern-floating-pane"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  minWidth: 0,
                  minHeight: 0,
                  height: '100%',
                  backgroundColor: 'rgba(16, 22, 38, 0.45)',
                  backdropFilter: 'blur(28px)',
                  WebkitBackdropFilter: 'blur(28px)',
                  borderRadius: '22px',
                  border: '1px solid rgba(255, 255, 255, 0.09)',
                  position: 'relative',
                  overflow: 'visible'
                }}
              >
                <div className="neon-floating-badge badge-pane-1">
                  ⚡ {isSplitActive ? `PANE 1 • ${sanitizeDisplayName(activeChat?.participant?.split(' ')[0] || 'PRIMARY')}` : `LIVE CHAT • ${sanitizeDisplayName(activeChat?.participant || 'ACTIVE')}`}
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, borderRadius: '22px', overflow: 'hidden' }}>
                  <ChatConversationPane
                    chat={activeChat}
                    allChats={chats}
                    onSelectChat={(id, chatObj) => {
                      setActiveChatId(id);
                      if (chatObj) setActiveChatKey(getChatUniqueKey(chatObj));
                    }}
                    isSplit={isSplitActive}
                    onToggleSplit={handleToggleSplit}
                    onOpenMicrosoftModal={onOpenMicrosoftModal}
                    onPreviewDoc={(doc) => setPreviewDocModal(doc)}
                    bumpChatToTop={bumpChatToTop}
                    onBack={() => setActiveChatId(null)}
                    paneTitle="Primary Chat"
                    paneIndex={1}
                  />
                </div>
              </div>

              {/* Secondary Pane 2 (Mint / Emerald Neon Pill) */}
              {isSplitActive && splitChat && (
                <div
                  className="modern-floating-pane"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 0,
                    minHeight: 0,
                    height: '100%',
                    backgroundColor: 'rgba(12, 17, 30, 0.68)',
                    backdropFilter: 'blur(30px)',
                    WebkitBackdropFilter: 'blur(30px)',
                    borderRadius: '20px',
                    border: '1px solid rgba(255, 255, 255, 0.09)',
                    position: 'relative',
                    overflow: 'visible'
                  }}
                >
                  <div className="neon-floating-badge badge-pane-2">
                    ⚡ PANE 2 • {sanitizeDisplayName(splitChat?.participant?.split(' ')[0] || 'CLIENT B')}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, borderRadius: '20px', overflow: 'hidden' }}>
                    <ChatConversationPane
                      chat={splitChat}
                      allChats={chats}
                      onSelectChat={(id, chatObj) => {
                        setSplitChatId(id);
                        if (chatObj) setSplitChatKey(getChatUniqueKey(chatObj));
                      }}
                      isSplit={true}
                      isSplitSecondPane={true}
                      onCloseSplit={() => {
                        if (layoutMode === 'quad') setLayoutMode('triple');
                        else if (layoutMode === 'triple') setLayoutMode('dual');
                        else setLayout('single');
                      }}
                      onOpenMicrosoftModal={onOpenMicrosoftModal}
                      onPreviewDoc={(doc) => setPreviewDocModal(doc)}
                      bumpChatToTop={bumpChatToTop}
                      paneTitle="Pane 2"
                      paneIndex={2}
                    />
                  </div>
                </div>
              )}

              {/* Third Pane 3 (Violet / Pink Neon Pill) */}
              {(layoutMode === 'triple' || layoutMode === 'quad') && pane3Chat && (
                <div
                  className="modern-floating-pane"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 0,
                    minHeight: 0,
                    height: '100%',
                    backgroundColor: 'rgba(12, 17, 30, 0.68)',
                    backdropFilter: 'blur(30px)',
                    WebkitBackdropFilter: 'blur(30px)',
                    borderRadius: '20px',
                    border: '1px solid rgba(255, 255, 255, 0.09)',
                    position: 'relative',
                    overflow: 'visible'
                  }}
                >
                  <div className="neon-floating-badge badge-pane-3">
                    ⚡ PANE 3 • {sanitizeDisplayName(pane3Chat?.participant?.split(' ')[0] || 'INTERNAL DEV')}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, borderRadius: '20px', overflow: 'hidden' }}>
                    <ChatConversationPane
                      chat={pane3Chat}
                      allChats={chats}
                      onSelectChat={(id, chatObj) => {
                        setPane3ChatId(id);
                        if (chatObj) setPane3ChatKey(getChatUniqueKey(chatObj));
                      }}
                      isSplit={true}
                      isSplitSecondPane={true}
                      onCloseSplit={() => {
                        if (layoutMode === 'quad') setLayoutMode('triple');
                        else setLayoutMode('dual');
                      }}
                      onOpenMicrosoftModal={onOpenMicrosoftModal}
                      onPreviewDoc={(doc) => setPreviewDocModal(doc)}
                      bumpChatToTop={bumpChatToTop}
                      paneTitle="Pane 3"
                      paneIndex={3}
                    />
                  </div>
                </div>
              )}

              {/* Fourth Pane 4 (Sunset Gold Neon Pill) */}
              {layoutMode === 'quad' && pane4Chat && (
                <div
                  className="modern-floating-pane"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 0,
                    minHeight: 0,
                    height: '100%',
                    backgroundColor: 'rgba(12, 17, 30, 0.68)',
                    backdropFilter: 'blur(30px)',
                    WebkitBackdropFilter: 'blur(30px)',
                    borderRadius: '20px',
                    border: '1px solid rgba(255, 255, 255, 0.09)',
                    position: 'relative',
                    overflow: 'visible'
                  }}
                >
                  <div className="neon-floating-badge badge-pane-4">
                    ⚡ PANE 4 • {sanitizeDisplayName(pane4Chat?.participant?.split(' ')[0] || 'MANAGEMENT')}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, borderRadius: '20px', overflow: 'hidden' }}>
                    <ChatConversationPane
                      chat={pane4Chat}
                      allChats={chats}
                      onSelectChat={(id, chatObj) => {
                        setPane4ChatId(id);
                        if (chatObj) setPane4ChatKey(getChatUniqueKey(chatObj));
                      }}
                      isSplit={true}
                      isSplitSecondPane={true}
                      onCloseSplit={() => setLayoutMode('triple')}
                      onOpenMicrosoftModal={onOpenMicrosoftModal}
                      onPreviewDoc={(doc) => setPreviewDocModal(doc)}
                      bumpChatToTop={bumpChatToTop}
                      paneTitle="Pane 4"
                      paneIndex={4}
                    />
                  </div>
                </div>
              )}
            </div>
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

      {/* Document & Image Lightbox Modal */}
      {previewDocModal && (
        <DocumentPreviewModal
          doc={previewDocModal}
          onClose={() => setPreviewDocModal(null)}
        />
      )}
    </div>
  );
}
