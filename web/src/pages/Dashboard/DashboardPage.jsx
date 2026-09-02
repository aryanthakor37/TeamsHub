import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Folder,
  Users,
  Clock,
  ArrowUpRight,
  FileText,
  ImageIcon,
  Video,
  FileSpreadsheet,
  Archive,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Send,
  Loader2,
  Calendar,
  X,
  Eye,
  Download,
  Zap,
  Check
} from 'lucide-react';
import { mockDashboardStats } from '../../services/mockDataService';
import { useAuth } from '../../hooks/useAuth';
import { useChats } from '../../hooks/useChats';
import { fetchFilesFromBackend, fetchFileBlob } from '../../services/fileService';
import { sendMessageToBackend, fetchTodayCalendarMeetings } from '../../services/chatService';
import { getInitials, getAvatarColor } from '../../utils/avatarUtils';
import { cleanHtmlText, sanitizeDisplayName } from '../../utils/textUtils';
import DocumentPreviewModal from '../../components/DocumentPreviewModal';

/**
 * Helper to sort files descending by date
 */
const sortFilesByDate = (list = []) => {
  return [...list].sort((a, b) => {
    const timeA = new Date(a.lastModifiedDateTime || a.createdDateTime || a.timestamp || a.date || a.createdAt || 0).getTime();
    const timeB = new Date(b.lastModifiedDateTime || b.createdDateTime || b.timestamp || b.date || b.createdAt || 0).getTime();
    return timeB - timeA;
  });
};

/**
 * In-Memory & Fast Local Cache Hydration for Instant 0ms Paint
 */
const getStoredCachedFiles = () => {
  try {
    const raw = localStorage.getItem('teamshub_cached_files');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? sortFilesByDate(parsed) : [];
  } catch (e) {
    return [];
  }
};

export default function DashboardPage({ setActiveTab, onSelectChat, onSelectFile }) {
  const { connectedAccounts, activeAccount, user } = useAuth();
  const { chats } = useChats('all');
  const [recentFiles, setRecentFiles] = useState(() => getStoredCachedFiles());
  const [loadingFiles, setLoadingFiles] = useState(() => getStoredCachedFiles().length === 0);
  const connectedCount = connectedAccounts ? connectedAccounts.length : 0;
  const activeAccName = activeAccount ? (activeAccount.displayName || activeAccount.email) : 'No Active Account';

  // =========================================================================
  // FEATURE 1: Direct Memory-to-Memory Document Preview (Zero Disk Footprint)
  // =========================================================================
  const [previewDocModal, setPreviewDocModal] = useState(null);

  // =========================================================================
  // FEATURE 2: Direct Graph Pass-Through Quick Reply (No DB Write)
  // =========================================================================
  const [quickReplyChat, setQuickReplyChat] = useState(null);
  const [quickReplyText, setQuickReplyText] = useState('');
  const [quickReplySending, setQuickReplySending] = useState(false);
  const [quickReplyStatus, setQuickReplyStatus] = useState(null); // 'success' | 'error' | null
  const [localMessageOverrides, setLocalMessageOverrides] = useState({});

  // =========================================================================
  // FEATURE 3: Live "Today's Agenda / Meetings" (Direct Graph Query)
  // =========================================================================
  const [todayMeetings, setTodayMeetings] = useState([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [showMeetingsModal, setShowMeetingsModal] = useState(false);

  // 1. Fetch Shared Files (Pass-Through Stream)
  useEffect(() => {
    let active = true;
    if (connectedAccounts && connectedAccounts.length > 0) {
      if (recentFiles.length === 0) {
        setLoadingFiles(true);
      }
      fetchFilesFromBackend('all').then((data) => {
        if (active && Array.isArray(data) && data.length > 0) {
          const sorted = sortFilesByDate(data);
          setRecentFiles(sorted);
          try {
            localStorage.setItem('teamshub_cached_files', JSON.stringify(sorted));
          } catch (e) { }
        }
      }).catch(() => { }).finally(() => {
        if (active) setLoadingFiles(false);
      });
    } else {
      setRecentFiles([]);
    }
    return () => { active = false; };
  }, [connectedAccounts?.length]);

  // 2. Fetch Today's Meetings (Direct Graph /me/calendarView Query)
  useEffect(() => {
    let active = true;
    if (connectedAccounts && connectedAccounts.length > 0) {
      setLoadingMeetings(true);
      fetchTodayCalendarMeetings(activeAccount?.accountId || 'all')
        .then((meetings) => {
          if (active && Array.isArray(meetings)) {
            setTodayMeetings(meetings);
          }
        })
        .catch(() => { })
        .finally(() => {
          if (active) setLoadingMeetings(false);
        });
    } else {
      setTodayMeetings([]);
    }
    return () => { active = false; };
  }, [connectedAccounts?.length, activeAccount?.accountId]);

  const getChatOwnerEmail = (c) => {
    if (!c) return '';
    const email = (c.accountEmail || '').toLowerCase().trim();
    if (email && email.includes('@')) return email;

    const accId = (c.connectedAccountId || '').toLowerCase().trim();
    const foundByAccId = (connectedAccounts || []).find(a => {
      const id = (a._id || a.accountId || a.id || '').toString().toLowerCase().trim();
      return id && (id === accId || accId.includes(id));
    });
    if (foundByAccId && foundByAccId.email) return foundByAccId.email.toLowerCase().trim();

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

  const getFileCategoryMeta = (fileName = '', rawCategory = '') => {
    const name = (fileName || '').toLowerCase().trim();
    const ext = name.includes('.') ? name.split('.').pop() : '';
    if (ext === 'pdf' || name.endsWith('.pdf') || rawCategory === 'PDF') {
      return { label: 'PDF', icon: FileText, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' };
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].includes(ext) || name.startsWith('photo from') || name.startsWith('image') || rawCategory === 'Images') {
      return { label: 'Image', icon: ImageIcon, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' };
    }
    if (['xls', 'xlsx', 'csv', 'tsv', 'ods'].includes(ext) || rawCategory === 'Excel') {
      return { label: 'Excel', icon: FileSpreadsheet, color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' };
    }
    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext) || rawCategory === 'Videos') {
      return { label: 'Video', icon: Video, color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)' };
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || rawCategory === 'ZIP') {
      return { label: 'Archive', icon: Archive, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' };
    }
    return { label: 'Document', icon: FileText, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' };
  };

  const visibleChats = (chats || []).filter(chat => {
    if (!connectedAccounts || connectedAccounts.length === 0) return false;
    const chatOwnerEmail = getChatOwnerEmail(chat).toLowerCase().trim();
    if (!chatOwnerEmail) return true;
    return connectedAccounts.some(acc => {
      const accEmail = (acc.email || '').toLowerCase().trim();
      const accName = (acc.displayName || acc.name || '').toLowerCase().trim();
      const accUser = accEmail.split('@')[0];
      if (accEmail && (chatOwnerEmail === accEmail || chatOwnerEmail.includes(accEmail) || accEmail.includes(chatOwnerEmail))) return true;
      if (accName && chat.company && (chat.company.toLowerCase().includes(accName) || accName.includes(chat.company.toLowerCase()))) return true;
      if (accUser && (chatOwnerEmail.includes(accUser) || (chat.company && chat.company.toLowerCase().includes(accUser)))) return true;
      return false;
    });
  });

  const visibleFiles = (recentFiles || []).filter(file => {
    if (!connectedAccounts || connectedAccounts.length === 0) return false;
    const fileOwnerEmail = (file.accountEmail || '').toLowerCase().trim();
    if (!fileOwnerEmail) return true;
    return connectedAccounts.some(acc => {
      const accEmail = (acc.email || '').toLowerCase().trim();
      const accName = (acc.displayName || acc.name || '').toLowerCase().trim();
      const accUser = accEmail.split('@')[0];
      if (accEmail && (fileOwnerEmail === accEmail || fileOwnerEmail.includes(accEmail) || accEmail.includes(fileOwnerEmail))) return true;
      if (accName && file.account && (file.account.toLowerCase().includes(accName) || accName.includes(file.account.toLowerCase()))) return true;
      if (accUser && (fileOwnerEmail.includes(accUser) || (file.account && file.account.toLowerCase().includes(accUser)))) return true;
      return false;
    });
  });

  const realUnreadCount = visibleChats ? visibleChats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0) : 0;
  const isConnected = connectedCount > 0;

  // Handle Direct Graph Pass-Through Quick Reply Send
  const handleSendQuickReply = async (e) => {
    if (e) e.preventDefault();
    if (!quickReplyChat || !quickReplyText.trim() || quickReplySending) return;

    const chatId = quickReplyChat._id || quickReplyChat.id || quickReplyChat.microsoftChatId;
    const textToSend = quickReplyText.trim();
    setQuickReplySending(true);
    setQuickReplyStatus(null);

    try {
      // Direct pass-through dispatch — zero DB write
      await sendMessageToBackend(chatId, textToSend, quickReplyChat.connectedAccountId);
      
      // Update in-memory override for instant UI reflection
      setLocalMessageOverrides(prev => ({
        ...prev,
        [chatId]: {
          preview: `You: ${textToSend}`,
          timestamp: new Date().toISOString()
        }
      }));

      setQuickReplyStatus('success');
      setQuickReplyText('');
      setTimeout(() => {
        setQuickReplyChat(null);
        setQuickReplyStatus(null);
      }, 1800);
    } catch (err) {
      console.warn('[Quick Reply Error]:', err.message);
      setQuickReplyStatus('error');
    } finally {
      setQuickReplySending(false);
    }
  };

  // Next upcoming meeting for the card
  const nextMeeting = todayMeetings && todayMeetings.length > 0 ? todayMeetings[0] : null;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
      {/* Header Banner & Zero-Storage Compliance Badge */}
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.85rem', fontWeight: '800', marginBottom: '6px', letterSpacing: '-0.02em', color: '#ffffff' }}>
            {isConnected ? `Good morning, ${sanitizeDisplayName(user?.name || activeAccount?.displayName || 'User')} 👋` : 'Welcome to TeamsHub 👋'}
          </h2>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span>Active Workspace: <strong style={{ color: isConnected ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: '700' }}>{sanitizeDisplayName(activeAccName)}</strong></span>
            <span style={{ opacity: 0.4 }}>•</span>
            <span className={isConnected ? "badge badge-company-a" : "badge"} style={{ backgroundColor: isConnected ? undefined : 'var(--bg-tertiary)', color: isConnected ? undefined : 'var(--text-muted)' }}>
              {connectedCount} connected account{connectedCount !== 1 ? 's' : ''}
            </span>
            <span style={{ opacity: 0.4 }}>•</span>
            
            {/* Zero-Storage Direct Stream Guarantee Badge */}
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              fontWeight: '700',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.25)'
            }} title="Pure In-Memory Passthrough. No messages or files are stored in our database.">
              <ShieldCheck size={14} />
              <span>Zero-Storage Live Stream</span>
            </span>
          </div>
        </div>
      </div>

      {/* 4 Elevated 3D Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '22px',
        marginBottom: '36px'
      }}>
        {/* Card 1: Unread Messages */}
        <div className="card-3d-interactive" style={{ padding: '22px', display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(79, 70, 229, 0.1) 100%)',
            color: '#6366f1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.4)'
          }}>
            <MessageSquare size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Unread Messages</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '800', lineHeight: 1.2, color: '#ffffff' }}>{isConnected ? realUnreadCount : 0}</div>
          </div>
        </div>

        {/* Card 2: Shared Files */}
        <div className="card-3d-interactive" style={{ padding: '22px', display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.2) 0%, rgba(2, 132, 199, 0.1) 100%)',
            color: '#0ea5e9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(14, 165, 233, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.4)'
          }}>
            <Folder size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Shared Files</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '800', lineHeight: 1.2, color: '#ffffff' }}>{isConnected ? visibleFiles.length : 0}</div>
          </div>
        </div>

        {/* Card 3: Connected Accounts */}
        <div className="card-3d-interactive" style={{ padding: '22px', display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.1) 100%)',
            color: '#10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.4)'
          }}>
            <Users size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Connected Accounts</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '800', lineHeight: 1.2, color: '#ffffff' }}>{connectedCount}</div>
          </div>
        </div>

        {/* Card 4: FEATURE 3 - Today's Meetings */}
        <div 
          onClick={() => {
            if (todayMeetings && todayMeetings.length > 0) setShowMeetingsModal(true);
          }}
          className="card-3d-interactive" 
          style={{ 
            padding: '22px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '18px',
            cursor: todayMeetings.length > 0 ? 'pointer' : 'default'
          }}
          title={todayMeetings.length > 0 ? "Click to view today's meetings agenda" : "No meetings scheduled today"}
        >
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.1) 100%)',
            color: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.4)'
          }}>
            <Calendar size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Today's Meetings</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '800', lineHeight: 1.2, color: '#ffffff' }}>{isConnected ? todayMeetings.length : 0}</div>
            {nextMeeting && (
              <div style={{ 
                fontSize: '0.72rem', 
                color: 'var(--accent-primary)', 
                fontWeight: '600',
                marginTop: '2px', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap' 
              }}>
                Next: {nextMeeting.startTimeStr}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Recent Chats & Recent Files */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
        gap: '28px',
        marginBottom: '36px'
      }}>
        {/* Recent Conversations with FEATURE 2: Quick Reply */}
        <div className="card-3d-interactive" style={{ padding: '28px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#ffffff' }}>Recent Conversations</h3>
            <button
              onClick={() => setActiveTab('chats')}
              style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              View all <ArrowUpRight size={15} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {isConnected && visibleChats && visibleChats.length > 0 ? (
              visibleChats.slice(0, 4).map((chat) => {
                const chatId = chat._id || chat.id;
                const override = localMessageOverrides[chatId];
                const displayPreview = override ? override.preview : chat.lastMessagePreview;
                const displayTime = override 
                  ? new Date(override.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : (chat.lastMessageTimestamp ? new Date(chat.lastMessageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');

                const isQuickReplying = quickReplyChat && (quickReplyChat._id || quickReplyChat.id) === chatId;

                return (
                  <div
                    key={chatId}
                    className="glass-card-interactive"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      border: isQuickReplying ? '1px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'all var(--transition-fast)',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Chat Item Main Row */}
                    <div
                      onClick={() => {
                        if (onSelectChat) {
                          onSelectChat(chat._id || chat.id, chat.participant);
                        } else {
                          setActiveTab('chats');
                        }
                      }}
                      style={{
                        padding: '14px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        cursor: 'pointer'
                      }}
                    >
                      <div className="avatar-3d" style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        backgroundColor: getAvatarColor(chat.participant),
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                        fontSize: '0.95rem',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                        flexShrink: 0
                      }}>
                        {getInitials(chat.participant)}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                          <span style={{ fontWeight: '700', fontSize: '0.92rem', color: 'var(--text-primary)' }}>{sanitizeDisplayName(chat.participant)}</span>
                          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                            {displayTime}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {cleanHtmlText(displayPreview)}
                        </div>
                      </div>

                      {/* Quick Reply Trigger Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isQuickReplying) {
                            setQuickReplyChat(null);
                          } else {
                            setQuickReplyChat(chat);
                            setQuickReplyText('');
                            setQuickReplyStatus(null);
                          }
                        }}
                        className="tab-pill-3d"
                        style={{
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: isQuickReplying ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.06)',
                          color: isQuickReplying ? '#fff' : 'var(--text-secondary)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          flexShrink: 0
                        }}
                        title="Direct Graph Pass-Through Quick Reply"
                      >
                        <Zap size={13} />
                        <span>{isQuickReplying ? 'Close' : 'Quick Reply'}</span>
                      </button>

                      <span className={`badge ${chat.accountBadge || 'badge-company-a'}`} style={{ flexShrink: 0 }}>
                        {sanitizeDisplayName(chat.company)}
                      </span>
                    </div>

                    {/* FEATURE 2: Inline Quick Reply Input Box (Pass-Through Stream) */}
                    {isQuickReplying && (
                      <div style={{
                        padding: '10px 16px 14px 16px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        <form onSubmit={handleSendQuickReply} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            type="text"
                            value={quickReplyText}
                            onChange={(e) => setQuickReplyText(e.target.value)}
                            placeholder={`Reply directly to ${sanitizeDisplayName(chat.participant)}... (No DB store)`}
                            autoFocus
                            disabled={quickReplySending}
                            style={{
                              flex: 1,
                              padding: '8px 12px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'rgba(0, 0, 0, 0.3)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              color: 'var(--text-primary)',
                              fontSize: '0.85rem',
                              outline: 'none'
                            }}
                          />
                          <button
                            type="submit"
                            disabled={!quickReplyText.trim() || quickReplySending}
                            className="btn btn-primary"
                            style={{
                              padding: '8px 14px',
                              fontSize: '0.8rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            {quickReplySending ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                            <span>Send</span>
                          </button>
                        </form>

                        {/* Direct Stream Status Notice */}
                        {quickReplyStatus === 'success' && (
                          <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={13} /> Sent directly via Microsoft Graph!
                          </div>
                        )}
                        {quickReplyStatus === 'error' && (
                          <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: '600' }}>
                            Failed to send. Please check your connection.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                <MessageSquare size={32} style={{ marginBottom: '10px', opacity: 0.4 }} />
                <div>No active conversations.</div>
                <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>Click "+ Connect Account" above to connect your Microsoft Teams workspace.</div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Shared Files with FEATURE 1: Direct Memory-to-Memory Preview */}
        <div className="card-3d-interactive" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#ffffff' }}>Recent Shared Files</h3>
            <button
              onClick={() => setActiveTab('files')}
              style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              View all <ArrowUpRight size={15} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {isConnected && visibleFiles && visibleFiles.length > 0 ? (
              visibleFiles.slice(0, 4).map((file) => {
                const meta = getFileCategoryMeta(file.name, file.category);
                const Icon = meta.icon;
                return (
                  <div
                    key={file.id || file.name}
                    onClick={() => {
                      // Open Direct Memory-to-Memory Document Preview Modal
                      setPreviewDocModal(file);
                    }}
                    className="glass-card-interactive"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      boxShadow: 'var(--shadow-sm)',
                      cursor: 'pointer',
                      transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)'
                    }}
                    title={`Click to preview ${file.name} directly in memory`}
                  >
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      backgroundColor: meta.bg,
                      color: meta.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Icon size={20} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: '700',
                        fontSize: '0.9rem',
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginBottom: '2px'
                      }} title={file.name}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {meta.label} • {file.size || 'Shared File'} • {sanitizeDisplayName(file.sender || file.account)}
                      </div>
                    </div>

                    {/* In-Memory Instant Preview Icon */}
                    <div style={{
                      padding: '6px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      color: 'var(--accent-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Eye size={15} />
                    </div>

                    <span className="badge" style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.72rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      flexShrink: 0
                    }}>
                      <span style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: getAvatarColor(file.account),
                        color: '#fff',
                        fontSize: '0.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700'
                      }}>
                        {(file.account?.[0] || 'A').toUpperCase()}
                      </span>
                      <span>{sanitizeDisplayName(file.account)}</span>
                    </span>
                  </div>
                );
              })
            ) : isConnected && loadingFiles ? (
              <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                <Folder size={32} style={{ marginBottom: '10px', opacity: 0.4 }} className="spin" />
                <div>Loading shared files...</div>
              </div>
            ) : isConnected ? (
              <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                <Folder size={32} style={{ marginBottom: '10px', opacity: 0.4 }} />
                <div>No recent shared files found.</div>
              </div>
            ) : (
              <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                <Folder size={32} style={{ marginBottom: '10px', opacity: 0.4 }} />
                <div>No shared files found.</div>
                <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>Connect a Microsoft account to view your files.</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="card-3d-interactive" style={{ padding: '28px' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '20px' }}>Workspace Activity Stream</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {isConnected ? (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: 'var(--status-online)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: '1px'
                }}>
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>Connected Workspace: {activeAccName}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>Microsoft Graph Live Passthrough Active (Zero DB Footprint)</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(79, 70, 229, 0.15)',
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: '1px'
                }}>
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>Synced {chats ? chats.length : 0} Teams conversations in-memory</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>Real-time Socket.IO Sync Active</div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              No active workspace connected. Connect a Microsoft Teams account to start syncing.
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FEATURE 1 MODAL: Direct Memory-to-Memory Document Preview Modal           */}
      {/* ========================================================================= */}
      {previewDocModal && (
        <DocumentPreviewModal
          file={previewDocModal}
          accountId={previewDocModal.connectedAccountId || activeAccount?.accountId}
          onClose={() => setPreviewDocModal(null)}
        />
      )}

      {/* ========================================================================= */}
      {/* FEATURE 3 MODAL: Today's Meetings Schedule Popup                          */}
      {/* ========================================================================= */}
      {showMeetingsModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(8px)',
          padding: '20px'
        }}>
          <div className="glass-card" style={{
            width: '100%',
            maxWidth: '520px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            boxShadow: 'var(--shadow-xl)',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  color: '#f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Calendar size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Today's Teams Schedule</h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Direct Graph In-Memory Query</div>
                </div>
              </div>
              <button
                onClick={() => setShowMeetingsModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '380px', overflowY: 'auto' }}>
              {todayMeetings.map((evt) => (
                <div
                  key={evt.id}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '2px' }}>
                      {evt.subject}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      🕒 {evt.startTimeStr} {evt.endTimeStr ? `– ${evt.endTimeStr}` : ''} • By {evt.organizer}
                    </div>
                  </div>

                  {evt.joinUrl ? (
                    <a
                      href={evt.joinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary"
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.78rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        textDecoration: 'none',
                        flexShrink: 0
                      }}
                    >
                      <Video size={13} />
                      <span>Join Call</span>
                    </a>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Scheduled</span>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button
                onClick={() => setShowMeetingsModal(false)}
                className="btn btn-secondary"
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
