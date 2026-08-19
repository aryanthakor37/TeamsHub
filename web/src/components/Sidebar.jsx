import React from 'react';
import { Home, MessageSquare, Folder, Search, Users, Settings, Layers } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getInitials, getAvatarColor } from '../utils/avatarUtils';

export default function Sidebar({ activeTab, setActiveTab, unreadChatCount = 0 }) {
  const { connectedAccounts, activeAccount } = useAuth();

  const navItems = [
    { id: 'welcome', label: 'Welcome', icon: Layers },
    { id: 'dashboard', label: 'Home', icon: Home },
    { 
      id: 'chats', 
      label: 'Chats', 
      icon: MessageSquare, 
      badge: unreadChatCount > 0 ? unreadChatCount : null,
      isAlertBadge: true
    },
    { id: 'files', label: 'Files', icon: Folder },
    { id: 'search', label: 'Search', icon: Search },
    { 
      id: 'accounts', 
      label: 'Accounts', 
      icon: Users, 
      badge: connectedAccounts.length > 0 ? connectedAccounts.length : null 
    },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  const userName = activeAccount?.displayName || activeAccount?.name || 'Teams User';
  const userInitials = getInitials(userName);
  const avatarBg = getAvatarColor(userName);
  const accountCount = connectedAccounts.length;

  return (
    <aside className="sidebar-container" style={{
      width: '240px',
      backgroundColor: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      userSelect: 'none'
    }}>
      {/* Brand Header */}
      <div className="sidebar-brand-container" style={{
        padding: '22px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontWeight: '800',
          fontSize: '1.25rem',
          boxShadow: '0 6px 16px -2px rgba(79, 70, 229, 0.45), inset 0 1px 0 0 rgba(255, 255, 255, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          flexShrink: 0
        }}>
          TH
        </div>
        <div className="sidebar-brand-text">
          <h2 style={{ fontSize: '1.2rem', fontWeight: '800', lineHeight: 1.2, letterSpacing: '-0.01em' }}>TeamsHub</h2>
          <span style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '700' }}>
            Enterprise Workspace
          </span>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="sidebar-nav-list" style={{ padding: '16px 12px', flex: 1 }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="tab-pill-3d sidebar-item-btn"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '11px 16px',
                marginBottom: '6px',
                borderRadius: 'var(--radius-md)',
                border: isActive ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                outline: 'none',
                background: isActive 
                  ? 'linear-gradient(135deg, rgba(79, 70, 229, 0.14) 0%, rgba(99, 102, 241, 0.06) 100%)' 
                  : 'transparent',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? '700' : '500',
                cursor: 'pointer',
                boxShadow: isActive ? '0 4px 12px rgba(79, 70, 229, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.5)' : 'none',
                transition: 'all var(--transition-fast)'
              }}
            >
              <div className="sidebar-item-inner" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Icon size={19} color={isActive ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
                <span className="sidebar-item-label" style={{ fontSize: '0.9rem' }}>{item.label}</span>
              </div>

              {item.badge && (
                <span className="badge sidebar-item-badge" style={{
                  backgroundColor: item.isAlertBadge ? '#ef4444' : '#6366f1',
                  color: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  padding: '2px 9px',
                  borderRadius: 'var(--radius-full)',
                  boxShadow: item.isAlertBadge ? '0 2px 6px rgba(239, 68, 68, 0.4)' : '0 2px 6px rgba(99, 102, 241, 0.3)',
                  minWidth: '20px',
                  textAlign: 'center'
                }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Profile Info */}
      <div className="sidebar-profile-footer" style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        backgroundColor: 'var(--bg-tertiary)'
      }}>
        <div className="avatar-3d" style={{
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          backgroundColor: avatarBg,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: '700',
          fontSize: '0.85rem',
          flexShrink: 0
        }}>
          {userInitials}
        </div>
        <div className="sidebar-profile-info" style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {userName}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: '500' }}>
            {accountCount} Account{accountCount === 1 ? '' : 's'} Active
          </div>
        </div>
      </div>
    </aside>
  );
}
