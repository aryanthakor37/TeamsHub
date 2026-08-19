import React, { useEffect, useState } from 'react';
import { Sun, Moon, Search, Bell, CheckCircle2, AlertCircle, Plus, LogOut, User as UserIcon } from 'lucide-react';
import { checkHealth } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import AccountSwitcher from './AccountSwitcher';
import { getInitials, getAvatarColor } from '../utils/avatarUtils';

export default function Header({ activeTab, setActiveTab, onOpenMicrosoftModal, theme, toggleTheme }) {
  const [healthStatus, setHealthStatus] = useState({ loading: true, online: false });
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [imgError, setImgError] = useState(false);
  const { user, logout } = useAuth();

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
    const interval = setInterval(verifyHealth, 5000);
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
      height: '64px',
      backgroundColor: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 28px',
      zIndex: 10,
      position: 'relative'
    }}>
      {/* Title & Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: '700' }}>
          {titles[activeTab] || 'Dashboard'}
        </h1>

        {/* API Health Pill */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '3px 10px',
          borderRadius: 'var(--radius-full)',
          fontSize: '0.75rem',
          fontWeight: '600',
          backgroundColor: healthStatus.online ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          color: healthStatus.online ? '#10b981' : '#ef4444',
          border: `1px solid ${healthStatus.online ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
        }}>
          {healthStatus.online ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
          <span>{healthStatus.loading ? 'Checking API...' : healthStatus.online ? 'API Online' : 'API Standby'}</span>
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
            padding: '8px 16px',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-full)',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
            cursor: 'pointer'
          }}
        >
          <Search size={15} />
          <span>Search workspace...</span>
        </button>

        {/* Connect Account CTA */}
        <button
          className="btn btn-primary"
          onClick={onOpenMicrosoftModal}
          style={{ padding: '8px 16px', fontSize: '0.85rem', fontWeight: '700' }}
        >
          <Plus size={16} />
          <span>Connect Account</span>
        </button>

        {/* Notifications Icon */}
        <button 
          className="tab-pill-3d"
          style={{
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-secondary)'
          }}
        >
          <Bell size={18} />
        </button>

        {/* Theme Switcher */}
        <button
          className="tab-pill-3d"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          style={{
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--accent-primary)'
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
