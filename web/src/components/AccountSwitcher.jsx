import React, { useState } from 'react';
import { ChevronDown, Check, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { sanitizeDisplayName } from '../utils/textUtils';

export default function AccountSwitcher({ onOpenMicrosoftModal }) {
  const { connectedAccounts, activeAccount, setActiveAccount, disconnectAccount } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const activeAcc = activeAccount || (connectedAccounts && connectedAccounts.length > 0 ? connectedAccounts[0] : null);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '6px 12px',
          backgroundColor: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          fontSize: '0.85rem'
        }}
      >
        <div style={{
          width: '24px',
          height: '24px',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'rgba(99, 102, 241, 0.15)',
          color: 'var(--accent-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.75rem',
          fontWeight: '700'
        }}>
          <ShieldCheck size={14} />
        </div>
        <div style={{ textAlign: 'left', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <div style={{ fontWeight: '600', fontSize: '0.82rem' }}>
            {activeAcc ? sanitizeDisplayName(activeAcc.displayName || activeAcc.email) : 'No Account'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {activeAcc ? activeAcc.email : 'Select workspace'}
          </div>
        </div>
        <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '42px',
          left: 0,
          width: '280px',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          padding: '8px',
          zIndex: 100
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', padding: '6px 10px', textTransform: 'uppercase' }}>
            Switch Connected Workspace
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '240px', overflowY: 'auto' }}>
            {connectedAccounts.map((acc) => {
              const isSelected = activeAcc && (activeAcc._id === acc._id || activeAcc.email === acc.email);
              const accIdToDisconnect = acc._id || acc.accountId || acc.id || acc.email;
              return (
                <div
                  key={acc._id || acc.id || acc.email}
                  onClick={() => {
                    setActiveAccount(acc);
                    setIsOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: isSelected ? 'var(--accent-light)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background-color var(--transition-fast)'
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '0.85rem', color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                      {sanitizeDisplayName(acc.displayName || acc.company)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {acc.email}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isSelected && <Check size={16} style={{ color: 'var(--accent-primary)' }} />}
                    <button
                      title="Remove/Disconnect Account"
                      onClick={(e) => {
                        e.stopPropagation();
                        disconnectAccount(accIdToDisconnect);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.7,
                        transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '8px', paddingTop: '6px' }}>
            <button
              onClick={() => {
                setIsOpen(false);
                if (onOpenMicrosoftModal) onOpenMicrosoftModal();
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                backgroundColor: 'transparent',
                border: 'none',
                color: 'var(--accent-primary)',
                fontSize: '0.82rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <Plus size={15} />
              <span>Connect Another Account</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
