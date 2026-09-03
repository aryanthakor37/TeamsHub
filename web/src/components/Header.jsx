import React, { useEffect, useState } from 'react';
import { Search, Bell, CheckCircle2, AlertCircle, Plus, LogOut, User as UserIcon, Sun, Moon } from 'lucide-react';
import { checkHealth } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useChats } from '../hooks/useChats';
import AccountSwitcher from './AccountSwitcher';
import { getInitials, getAvatarColor } from '../utils/avatarUtils';
import { sanitizeDisplayName } from '../utils/textUtils';

export default function Header({ activeTab, setActiveTab, onOpenMicrosoftModal, isSidebarCollapsed, onToggleSidebar, layoutMode = 'single', onSetLayoutMode, theme = 'dark', toggleTheme }) {
  const [healthStatus, setHealthStatus] = useState({ loading: false, online: true });
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const [imgError, setImgError] = useState(false);
  const { user, logout, connectedAccounts, activeAccount } = useAuth();
  const { chats, unreadCount, markChatAsRead } = useChats('all');

  const unreadChats = (connectedAccounts && connectedAccounts.length > 0 && chats)
    ? chats.filter(c => (c.unreadCount || 0) > 0 && !c.isLastMessageOutgoing && !c.isOutgoing && !c.isSelfChat)
    : [];
  const unreadTotal = (connectedAccounts && connectedAccounts.length > 0) ? unreadChats.length : 0;

  useEffect(() => {
    let isMounted = true;

    const verifyHealth = () => {
      checkHealth().then((res) => {
        if (isMounted) {
          if (res && res.success) {
            setHealthStatus({ loading: false, online: true });
          } else {
            setHealthStatus({ loading: false, online: false });
          }
        }
      }).catch(() => {
        if (isMounted) setHealthStatus({ loading: false, online: false });
      });
    };

    verifyHealth();
    const interval = setInterval(verifyHealth, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleLayoutSelect = (mode) => {
    if (onSetLayoutMode) {
      onSetLayoutMode(mode);
    } else {
      window.dispatchEvent(new CustomEvent('teamshub:set-layout-mode', { detail: { mode } }));
    }
  };

  const hasAccount = !!(activeAccount?.displayName || user?.name || (connectedAccounts && connectedAccounts.length > 0));
  const rawDisplayName = activeAccount?.displayName || user?.name || connectedAccounts?.[0]?.displayName || '';
  const displayName = rawDisplayName ? sanitizeDisplayName(rawDisplayName) : '';

  return (
    <header style={{
      height: '54px',
      backgroundColor: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 18px',
      zIndex: 30,
      position: 'relative',
      gap: '16px',
      transition: 'background-color 0.2s ease, border-color 0.2s ease'
    }}>
      {/* Left: Hamburger & Brand Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
        <button
          onClick={onToggleSidebar}
          className="tab-pill-3d"
          title="Toggle Navigation Sidebar"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px',
            borderRadius: '6px'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setActiveTab('dashboard')}>
          <span style={{ fontSize: '1.15rem', fontWeight: '800', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            TeamsHub
          </span>
        </div>
      </div>

      {/* Center: Wide Rounded Search Capsule */}
      <div style={{ flex: 1, maxWidth: '440px', display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={() => setActiveTab('search')}
          style={{
            width: '100%',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '0 16px',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            color: 'var(--text-muted)',
            fontSize: '0.84rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <Search size={15} style={{ color: 'var(--text-muted)' }} />
          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            Search for chats, files or teammates...
          </span>
        </button>
      </div>

      {/* Right Controls: Layout Switcher, Bell, Live Pill, User Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {/* Segmented Layout Switcher (1, 2, 3, Quad) - Visible ONLY on Chats page */}
        {activeTab === 'chats' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '2px',
            gap: '2px'
          }}>
            {[
              { id: 'single', label: '1', title: 'Single Pane' },
              { id: 'dual', label: '2', title: '2-Split Parallel' },
              { id: 'triple', label: '3', title: '3-Split Triple' },
              { id: 'quad', label: '⊞', title: '4-Quad Grid' }
            ].map((mode) => {
              const isActive = layoutMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => {
                    handleLayoutSelect(mode.id);
                  }}
                  title={mode.title}
                  style={{
                    width: '26px',
                    height: '24px',
                    borderRadius: '5px',
                    border: isActive ? '1px solid var(--accent-primary)' : '1px solid transparent',
                    backgroundColor: isActive ? 'var(--accent-primary)' : 'transparent',
                    color: isActive ? '#ffffff' : 'var(--text-muted)',
                    fontSize: mode.label === '⊞' ? '0.9rem' : '0.78rem',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: isActive ? '0 1px 4px rgba(91, 95, 199, 0.4)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
        )}

        {/* 1-Click Dark/Light Mode Theme Switcher */}
        <button
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to Teams Dark Mode' : 'Switch to Teams Light Mode'}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {theme === 'light' ? <Moon size={16} color="var(--accent-primary)" /> : <Sun size={16} color="#f59e0b" />}
        </button>

        {/* User Profile Pill Capsule or Connect Account Button */}
        {hasAccount && displayName ? (
          <div style={{ position: 'relative' }}>
            <div 
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '3px 10px 3px 4px',
                borderRadius: '20px',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer'
              }}
            >
              <div style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                backgroundColor: getAvatarColor(displayName),
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '700',
                fontSize: '0.74rem'
              }}>
                {getInitials(displayName)}
              </div>
              <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                {displayName}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>

            {showProfileMenu && (
              <div style={{
                position: 'absolute',
                top: '40px',
                right: 0,
                width: '230px',
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                boxShadow: 'var(--shadow-lg)',
                padding: '12px',
                zIndex: 100
              }}>
                <div style={{ paddingBottom: '8px', marginBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ fontWeight: '700', fontSize: '0.88rem', color: 'var(--text-primary)' }}>{displayName}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {activeAccount?.email || user?.email || 'Active Workspace'}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    setActiveTab('accounts');
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontWeight: '500',
                    marginBottom: '4px'
                  }}
                >
                  <UserIcon size={16} color="var(--accent-primary)" />
                  <span>Connected Accounts</span>
                </button>

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    logout();
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ef4444',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontWeight: '600'
                  }}
                >
                  <LogOut size={16} />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => {
              if (onOpenMicrosoftModal) onOpenMicrosoftModal();
              else setActiveTab('accounts');
            }}
            className="tab-pill-3d"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '20px',
              backgroundColor: 'var(--accent-light)',
              border: '1px solid var(--accent-primary)',
              color: 'var(--accent-primary)',
              fontWeight: '700',
              fontSize: '0.80rem',
              cursor: 'pointer'
            }}
          >
            <Plus size={14} />
            <span>Connect Account</span>
          </button>
        )}
      </div>
    </header>
  );
}
