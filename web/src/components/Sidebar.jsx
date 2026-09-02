import React from 'react';
import { Home, MessageSquare, Folder, Search, Users, Settings, Layers } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getInitials, getAvatarColor } from '../utils/avatarUtils';
import { sanitizeDisplayName } from '../utils/textUtils';

export default function Sidebar({ activeTab, setActiveTab, unreadChatCount = 0, isCollapsed = false, onToggleCollapse }) {
  const { connectedAccounts, activeAccount } = useAuth();

  const navItems = [
    { id: 'welcome', label: 'Welcome', icon: Layers },
    { id: 'dashboard', label: 'Home', icon: Home },
    { 
      id: 'chats', 
      label: 'Chats', 
      icon: MessageSquare, 
      badge: (connectedAccounts && connectedAccounts.length > 0 && unreadChatCount > 0) ? unreadChatCount : null,
      isAlertBadge: true
    },
    { id: 'files', label: 'Files', icon: Folder },
    { id: 'search', label: 'Search', icon: Search },
    { 
      id: 'accounts', 
      label: 'Accounts', 
      icon: Users, 
      badge: (connectedAccounts && connectedAccounts.length > 0) ? connectedAccounts.length : null 
    },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  const userName = sanitizeDisplayName(activeAccount?.displayName || activeAccount?.name || 'Teams User');
  const userInitials = getInitials(userName);
  const avatarBg = getAvatarColor(userName);
  const accountCount = connectedAccounts.length;

  return (
    <aside className="sidebar-container" style={{
      width: isCollapsed ? '64px' : '240px',
      transition: 'width 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
      backgroundColor: 'rgba(10, 14, 24, 0.55)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderRight: '1px solid rgba(255, 255, 255, 0.08)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      userSelect: 'none',
      flexShrink: 0,
      zIndex: 20
    }}>
      {/* Brand Header */}
      <div className="sidebar-brand-container" style={{
        padding: isCollapsed ? '16px 0' : '20px 22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        gap: '12px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        cursor: 'pointer'
      }}
      onClick={onToggleCollapse}
      title={isCollapsed ? 'Expand Navigation Sidebar' : 'Collapse Sidebar'}
      >
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#032030',
          fontWeight: '800',
          fontSize: '1.2rem',
          boxShadow: '0 4px 18px rgba(0, 242, 254, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.4)',
          flexShrink: 0
        }}>
          TH
        </div>
        {!isCollapsed && (
          <div className="sidebar-brand-text">
            <h2 style={{ fontSize: '1.15rem', fontWeight: '800', lineHeight: 1.2, letterSpacing: '-0.01em', color: '#ffffff' }}>TeamsHub</h2>
            <span style={{ fontSize: '0.68rem', color: '#00f2fe', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '700' }}>
              Enterprise Workspace
            </span>
          </div>
        )}
      </div>

      {/* Navigation List */}
      <nav className="sidebar-nav-list" style={{ padding: isCollapsed ? '16px 8px' : '16px 12px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`tab-pill-3d sidebar-item-btn ${isActive ? 'sidebar-active-glow' : ''}`}
              title={isCollapsed ? item.label : undefined}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: isCollapsed ? 'center' : 'space-between',
                padding: isCollapsed ? '10px 0' : '11px 16px',
                marginBottom: '6px',
                borderRadius: '12px',
                border: isActive ? '1px solid rgba(0, 242, 254, 0.45)' : '1px solid transparent',
                outline: 'none',
                background: isActive 
                  ? 'linear-gradient(135deg, rgba(0, 242, 254, 0.16) 0%, rgba(99, 102, 241, 0.12) 100%)' 
                  : 'transparent',
                color: isActive ? '#00f2fe' : 'var(--text-secondary)',
                fontWeight: isActive ? '700' : '500',
                cursor: 'pointer',
                boxShadow: isActive ? '0 0 20px rgba(0, 242, 254, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.25)' : 'none',
                transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                position: 'relative'
              }}
            >
              <div className="sidebar-item-inner" style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                <Icon size={isCollapsed ? 21 : 19} color={isActive ? '#00f2fe' : 'var(--text-secondary)'} />
                {!isCollapsed && <span className="sidebar-item-label" style={{ fontSize: '0.9rem' }}>{item.label}</span>}
              </div>

              {item.badge && !isCollapsed && (
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

              {item.badge && isCollapsed && (
                <span style={{
                  position: 'absolute',
                  top: '4px',
                  right: '6px',
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  backgroundColor: '#ef4444',
                  boxShadow: '0 0 8px #ef4444'
                }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Profile Info */}
      <div className="sidebar-profile-footer" style={{
        padding: isCollapsed ? '14px 0' : '16px 20px',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        gap: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.02)'
      }}>
        <div className="avatar-3d" style={{
          width: '36px',
          height: '36px',
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
        {!isCollapsed && (
          <div className="sidebar-profile-info" style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {userName}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: '500' }}>
              {accountCount} Account{accountCount === 1 ? '' : 's'} Active
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
