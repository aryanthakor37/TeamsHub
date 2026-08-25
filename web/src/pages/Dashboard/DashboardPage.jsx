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
  ExternalLink
} from 'lucide-react';
import { mockDashboardStats } from '../../services/mockDataService';
import { useAuth } from '../../hooks/useAuth';
import { useChats } from '../../hooks/useChats';
import { fetchFilesFromBackend } from '../../services/fileService';
const sortFilesByDate = (list = []) => {
  return [...list].sort((a, b) => {
    const timeA = new Date(a.lastModifiedDateTime || a.createdDateTime || a.timestamp || a.date || a.createdAt || 0).getTime();
    const timeB = new Date(b.lastModifiedDateTime || b.createdDateTime || b.timestamp || b.date || b.createdAt || 0).getTime();
    return timeB - timeA;
  });
};

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
          } catch (e) {}
        }
      }).catch(() => {}).finally(() => {
        if (active) setLoadingFiles(false);
      });
    } else {
      setRecentFiles([]);
    }
    return () => { active = false; };
  }, [connectedAccounts?.length]);

  const getChatOwnerEmail = (c) => {
    if (!c) return '';
    const email = (c.accountEmail || '').toLowerCase().trim();
    if (email && email.includes('@')) return email;
    const badge = (c.company || c.accountBadge || '').toLowerCase().trim();
    if (badge.includes('aryan') || badge.includes('kumrecha')) return 'aryankumar.kumrecha@estatic-infotech.com';
    if (badge.includes('keval') || badge.includes('trivedi')) return 'keval.trivedi@estatic-infotech.com';
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
      if (accEmail && chatOwnerEmail === accEmail) return true;
      if (accName && chat.company && chat.company.toLowerCase().includes(accName)) return true;
      if (accEmail.includes('aryan') && chatOwnerEmail.includes('aryan')) return true;
      if (accEmail.includes('keval') && chatOwnerEmail.includes('keval')) return true;
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
      if (accEmail && fileOwnerEmail === accEmail) return true;
      if (accName && file.account && file.account.toLowerCase().includes(accName)) return true;
      if (accEmail.includes('aryan') && fileOwnerEmail.includes('aryan')) return true;
      if (accEmail.includes('keval') && fileOwnerEmail.includes('keval')) return true;
      return false;
    });
  });

  const realUnreadCount = visibleChats ? visibleChats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0) : 0;
  const isConnected = connectedCount > 0;
  
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
      {/* Header Banner */}
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.85rem', fontWeight: '800', marginBottom: '6px', letterSpacing: '-0.02em' }}>
            {isConnected ? `Good morning, ${user?.name || activeAccount?.displayName || 'User'} 👋` : 'Welcome to TeamsHub 👋'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Active Workspace: <strong style={{ color: isConnected ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: '700' }}>{activeAccName}</strong>
            <span style={{ opacity: 0.4 }}>•</span>
            <span className={isConnected ? "badge badge-company-a" : "badge"} style={{ backgroundColor: isConnected ? undefined : 'var(--bg-tertiary)', color: isConnected ? undefined : 'var(--text-muted)' }}>
              {connectedCount} connected account{connectedCount !== 1 ? 's' : ''}
            </span>
          </p>
        </div>
      </div>

      {/* 4 Elevated 3D Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '22px',
        marginBottom: '36px'
      }}>
        <div className="glass-card glass-card-interactive" style={{ padding: '22px', display: 'flex', alignItems: 'center', gap: '18px' }}>
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
            <div style={{ fontSize: '1.75rem', fontWeight: '800', lineHeight: 1.2 }}>{isConnected ? realUnreadCount : 0}</div>
          </div>
        </div>

        <div className="glass-card glass-card-interactive" style={{ padding: '22px', display: 'flex', alignItems: 'center', gap: '18px' }}>
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
            <div style={{ fontSize: '1.75rem', fontWeight: '800', lineHeight: 1.2 }}>{isConnected ? visibleFiles.length : 0}</div>
          </div>
        </div>

        <div className="glass-card glass-card-interactive" style={{ padding: '22px', display: 'flex', alignItems: 'center', gap: '18px' }}>
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
            <div style={{ fontSize: '1.75rem', fontWeight: '800', lineHeight: 1.2 }}>{connectedCount}</div>
          </div>
        </div>

        <div className="glass-card glass-card-interactive" style={{ padding: '22px', display: 'flex', alignItems: 'center', gap: '18px' }}>
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
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Follow-ups</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '800', lineHeight: 1.2 }}>0</div>
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
        {/* Recent Conversations */}
        <div className="glass-card" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>Recent Conversations</h3>
            <button
              onClick={() => setActiveTab('chats')}
              style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              View all <ArrowUpRight size={15} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {isConnected && visibleChats && visibleChats.length > 0 ? (
              visibleChats.slice(0, 4).map((chat) => (
                <div
                  key={chat._id || chat.id}
                  onClick={() => {
                    if (onSelectChat) {
                      onSelectChat(chat._id || chat.id, chat.participant);
                    } else {
                      setActiveTab('chats');
                    }
                  }}
                  className="glass-card-interactive"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow-sm)',
                    cursor: 'pointer',
                    transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)'
                  }}
                >
                  <div className="avatar-3d" style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    backgroundColor: getAvatarColor(chat.participant),
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    fontSize: '0.92rem'
                  }}>
                    {getInitials(chat.participant)}
                  </div>
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ fontWeight: '700', fontSize: '0.92rem', color: 'var(--text-primary)' }}>{chat.participant}</span>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                        {chat.lastMessageTimestamp ? new Date(chat.lastMessageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {chat.lastMessagePreview}
                    </div>
                  </div>
                  <span className={`badge ${chat.accountBadge || 'badge-company-a'}`}>
                    {chat.company}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                <MessageSquare size={32} style={{ marginBottom: '10px', opacity: 0.4 }} />
                <div>No active conversations.</div>
                <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>Click "+ Connect Account" above to connect your Microsoft Teams workspace.</div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Shared Files */}
        <div className="glass-card" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>Recent Shared Files</h3>
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
                      if (onSelectFile) {
                        onSelectFile(file);
                      } else {
                        setActiveTab('files');
                      }
                    }}
                    className="glass-card-interactive"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      boxShadow: 'var(--shadow-sm)',
                      cursor: 'pointer',
                      transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)'
                    }}
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
                        {meta.label} • {file.size || 'Shared File'} • {file.sender || file.account}
                      </div>
                    </div>

                    <span className="badge" style={{
                      backgroundColor: 'var(--bg-tertiary)',
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
                      <span>{file.account}</span>
                    </span>
                  </div>
                );
              })
            ) : isConnected && loadingFiles ? (
              <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                <Folder size={32} style={{ marginBottom: '10px', opacity: 0.4 }} className="spin" />
                <div>Fetching latest shared files from Microsoft Graph...</div>
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
      <div className="glass-card" style={{ padding: '28px' }}>
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
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>Microsoft Graph Connected • Active</div>
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
                  <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>Synced {chats ? chats.length : 0} Teams conversations</div>
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
    </div>
  );
}
