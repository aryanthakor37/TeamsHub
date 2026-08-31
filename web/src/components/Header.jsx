import React, { useEffect, useState } from 'react';
import { Sun, Moon, Search, Bell, CheckCircle2, AlertCircle, Plus, LogOut, User as UserIcon } from 'lucide-react';
import { checkHealth } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useChats } from '../hooks/useChats';
import AccountSwitcher from './AccountSwitcher';
import { getInitials, getAvatarColor } from '../utils/avatarUtils';

export default function Header({ activeTab, setActiveTab, onOpenMicrosoftModal, theme, toggleTheme }) {
  const [healthStatus, setHealthStatus] = useState({ loading: true, online: false });
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const [imgError, setImgError] = useState(false);
  const { user, logout, connectedAccounts } = useAuth();
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

  const titles = {
    welcome: 'Welcome to TeamsHub',
    dashboard: 'Home Dashboard',
    chats: 'Chats & Conversations',
    files: 'File Manager',
    search: 'Global Search',
    accounts: 'Connected Accounts',
    settings: 'Settings'
  };

  return (
    <header style={{
      height: '66px',
      backgroundColor: 'var(--bg-glass)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 28px',
      zIndex: 10,
      position: 'relative',
      boxShadow: 'var(--shadow-sm)'
    }}>
      {/* Title & Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.02em' }}>
          {titles[activeTab] || 'Dashboard'}
        </h1>

        {/* API Health Pill */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 11px',
          borderRadius: 'var(--radius-full)',
          fontSize: '0.75rem',
          fontWeight: '700',
          backgroundColor: healthStatus.online ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
          color: healthStatus.online ? '#10b981' : '#ef4444',
          border: `1px solid ${healthStatus.online ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
          boxShadow: healthStatus.online ? '0 0 12px rgba(16, 185, 129, 0.2)' : 'none'
        }}>
          <div style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            backgroundColor: healthStatus.online ? '#10b981' : '#ef4444',
            boxShadow: healthStatus.online ? '0 0 8px #10b981' : 'none'
          }} className={healthStatus.online ? 'pulse-online' : ''} />
          <span>{healthStatus.loading ? 'Checking API...' : healthStatus.online ? 'API Live' : 'API Standby'}</span>
        </div>
      </div>

      {/* Action Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Global Workspace Account Switcher */}
        <AccountSwitcher onOpenMicrosoftModal={onOpenMicrosoftModal} />

        {/* Quick Search Shortcut */}
        <button
          onClick={() => setActiveTab('search')}
          className="tab-pill-3d"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-full)',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
            fontWeight: '500',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <Search size={15} style={{ color: 'var(--accent-primary)' }} />
          <span>Search workspace...</span>
        </button>

        {/* Connect Account CTA */}
        <button
          className="btn btn-primary"
          onClick={onOpenMicrosoftModal}
          style={{ padding: '9px 18px', fontSize: '0.85rem', fontWeight: '700' }}
        >
          <Plus size={16} />
          <span>Connect Account</span>
        </button>

        {/* Dark / Light Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="tab-pill-3d"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* User Profile Avatar Dropdown */}
        {user ? (
          <div style={{ position: 'relative' }}>
            {user.avatar && !imgError ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="avatar-3d"
                onError={() => setImgError(true)}
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  cursor: 'pointer'
                }}
              />
            ) : (
              <div
                className="avatar-3d"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: getAvatarColor(user.name),
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                {getInitials(user.name)}
              </div>
            )}

            {showProfileMenu && (
              <div style={{
                position: 'absolute',
                top: '48px',
                right: 0,
                width: '230px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-3d-highlight)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                padding: '14px',
                zIndex: 100,
                animation: 'slideUp3D 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}>
                <div style={{ paddingBottom: '10px', marginBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ fontWeight: '700', fontSize: '0.92rem' }}>{user.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
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
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontWeight: '500'
                  }}
                >
                  <UserIcon size={16} />
                  <span>My Connected Accounts</span>
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
                    borderRadius: 'var(--radius-sm)',
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
          <button className="btn btn-secondary" onClick={onOpenMicrosoftModal} style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
            Sign In
          </button>
        )}
      </div>
    </header>
  );
}
