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
      width: isCollapsed ? '64px' : '220px',
      transition: 'width 0.2s ease',
      backgroundColor: 'var(--bg-rail)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      userSelect: 'none',
      flexShrink: 0,
      zIndex: 20
    }}>
      {/* Brand Header */}
      <div className="sidebar-brand-container" style={{
        padding: isCollapsed ? '14px 0' : '16px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        gap: '12px',
        borderBottom: '1px solid var(--border-color)',
        cursor: 'pointer'
      }}
      onClick={onToggleCollapse}
      title={isCollapsed ? 'Expand Navigation Sidebar' : 'Collapse Sidebar'}
      >
        <div style={{
          width: '34px',
          height: '34px',
          borderRadius: '8px',
          background: 'var(--accent-gradient)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontWeight: '800',
          fontSize: '1rem',
          boxShadow: '0 2px 8px rgba(91, 95, 199, 0.35)',
          flexShrink: 0
        }}>
          TH
        </div>
        {!isCollapsed && (
          <div className="sidebar-brand-text">
            <h2 style={{ fontSize: '1.05rem', fontWeight: '700', lineHeight: 1.2, color: 'var(--text-primary)' }}>TeamsHub</h2>
            <span style={{ fontSize: '0.65rem', color: 'var(--accent-text)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '700' }}>
              Enterprise Workspace
            </span>
          </div>
        )}
      </div>

      {/* Navigation List */}
      <nav className="sidebar-nav-list" style={{ padding: isCollapsed ? '12px 6px' : '12px 8px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="sidebar-item-btn"
              title={isCollapsed ? item.label : undefined}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: isCollapsed ? 'center' : 'space-between',
                padding: isCollapsed ? '10px 0' : '9px 12px',
                marginBottom: '4px',
                borderRadius: '6px',
                border: 'none',
                outline: 'none',
                background: isActive ? 'var(--bg-active)' : 'transparent',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? '600' : '500',
                fontSize: '0.88rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                position: 'relative'
              }}
            >
              {/* Teams Active Left Indicator Pill */}
              {isActive && (
                <span style={{
                  position: 'absolute',
                  left: isCollapsed ? '2px' : '0px',
                  top: '6px',
                  bottom: '6px',
                  width: '3.5px',
                  borderRadius: '3px',
                  backgroundColor: 'var(--accent-primary)'
                }} />
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: (!isCollapsed && isActive) ? '4px' : '0px' }}>
                <Icon size={19} style={{ color: isActive ? 'var(--accent-primary)' : 'currentColor' }} />
                {!isCollapsed && <span>{item.label}</span>}
              </div>

              {!isCollapsed && item.badge && (
                <span style={{
                  backgroundColor: item.isAlertBadge ? 'var(--status-busy)' : 'var(--accent-primary)',
                  color: '#ffffff',
                  fontSize: '0.7rem',
                  fontWeight: '700',
                  padding: '1px 7px',
                  borderRadius: '10px',
                  minWidth: '18px',
                  textAlign: 'center'
                }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Status Bar */}
      <div className="sidebar-user-footer" style={{
        padding: isCollapsed ? '14px 0' : '14px 16px',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        gap: '12px',
        backgroundColor: 'transparent'
      }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            backgroundColor: avatarBg,
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '700',
            fontSize: '0.85rem'
          }}>
            {userInitials}
          </div>
          {/* Microsoft Teams Live Presence Dot */}
          <span style={{
            position: 'absolute',
            bottom: '-1px',
            right: '-1px',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: 'var(--status-online)',
            border: '2px solid var(--bg-rail)'
          }} />
        </div>

        {!isCollapsed && (
          <div style={{ overflow: 'hidden' }}>
            <p style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userName}
            </p>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {accountCount > 0 ? `${accountCount} Account${accountCount > 1 ? 's' : ''} Active` : 'Online'}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
