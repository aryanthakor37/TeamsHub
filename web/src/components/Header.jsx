import React, { useEffect, useState } from 'react';
import { Search, Bell, CheckCircle2, AlertCircle, Plus, LogOut, User as UserIcon } from 'lucide-react';
import { checkHealth } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useChats } from '../hooks/useChats';
import AccountSwitcher from './AccountSwitcher';
import { getInitials, getAvatarColor } from '../utils/avatarUtils';

export default function Header({ activeTab, setActiveTab, onOpenMicrosoftModal, isSidebarCollapsed, onToggleSidebar, layoutMode = 'triple', onSetLayoutMode }) {
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

  const displayName = activeAccount?.displayName || user?.name || 'Aryan Kumrecha';

  return (
    <header style={{
      height: '64px',
      backgroundColor: 'rgba(10, 14, 24, 0.65)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      zIndex: 30,
      position: 'relative',
      gap: '16px'
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
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px',
            borderRadius: '8px'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setActiveTab('dashboard')}>
          <span style={{ fontSize: '1.2rem', fontWeight: '800', letterSpacing: '-0.02em', color: '#ffffff' }}>
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
            height: '38px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '0 16px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
            color: 'var(--text-muted)',
            fontSize: '0.84rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)'
          }}
        >
          <Search size={15} style={{ color: '#00f2fe' }} />
          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            Search for chats, files or teammates...
          </span>
        </button>
      </div>

      {/* Right Controls: Layout Switcher, Bell, Live Pill, User Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        {/* Segmented Layout Switcher (1, 2, 3, Quad) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '10px',
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
                  if (activeTab !== 'chats') setActiveTab('chats');
                  handleLayoutSelect(mode.id);
                }}
                title={mode.title}
                style={{
                  width: '28px',
                  height: '26px',
                  borderRadius: '7px',
                  border: isActive ? '1px solid #00f2fe' : '1px solid transparent',
                  backgroundColor: isActive ? 'rgba(0, 242, 254, 0.18)' : 'transparent',
                  color: isActive ? '#00f2fe' : 'var(--text-muted)',
                  fontSize: mode.label === '⊞' ? '0.95rem' : '0.8rem',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 0 12px rgba(0, 242, 254, 0.35)' : 'none',
                  transition: 'all 0.18s ease'
                }}
              >
                {mode.label}
              </button>
            );
          })}
        </div>

        {/* Notification Bell with Badge */}
        <button
          onClick={() => setShowNotificationMenu(!showNotificationMenu)}
          style={{
            position: 'relative',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '6px',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Notifications"
        >
          <Bell size={18} />
          {unreadTotal > 0 && (
            <span style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              minWidth: '15px',
              height: '15px',
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              fontSize: '0.62rem',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 2px',
              boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)'
            }}>
              {unreadTotal}
            </span>
          )}
        </button>

        {/* Live Status Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          padding: '4px 8px',
          borderRadius: '20px',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.3)'
        }}
        title="Live Pass-Through Stream Connected"
        >
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#10b981',
            boxShadow: '0 0 8px #10b981'
          }} className="pulse-online" />
        </div>

        {/* User Profile Pill Capsule */}
        <div style={{ position: 'relative' }}>
          <div 
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '3px 10px 3px 4px',
              borderRadius: '20px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              cursor: 'pointer'
            }}
          >
            <div style={{
              width: '28px',
              height: '28px',
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
            <span style={{ fontSize: '0.82rem', fontWeight: '600', color: '#ffffff' }}>
              {displayName}
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>

          {showProfileMenu && (
            <div style={{
              position: 'absolute',
              top: '44px',
              right: 0,
              width: '230px',
              backgroundColor: 'rgba(16, 22, 38, 0.95)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '14px',
              boxShadow: '0 16px 36px rgba(0,0,0,0.5)',
              padding: '14px',
              zIndex: 100,
              animation: 'slideUp3D 0.2s ease'
            }}>
              <div style={{ paddingBottom: '10px', marginBottom: '10px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontWeight: '700', fontSize: '0.92rem', color: '#ffffff' }}>{displayName}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                <UserIcon size={16} color="#00f2fe" />
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
      </div>
    </header>
  );
}
