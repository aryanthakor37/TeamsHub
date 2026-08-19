import React from 'react';
import { Plus, CheckCircle2, RefreshCw, Mail, Trash2, ShieldCheck, Star, Radio, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function AccountsPage({ onOpenMicrosoftModal }) {
  const {
    connectedAccounts,
    activeAccount,
    defaultAccountId,
    setActiveAccount,
    setDefaultAccount,
    reconnectAccount,
    disconnectAccount
  } = useAuth();

  const activeAccId = activeAccount ? (activeAccount._id || activeAccount.accountId || activeAccount.id) : null;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>My Connected Microsoft Accounts</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Manage, isolate, switch, and re-authenticate your Microsoft Teams work, school, and tenant accounts.
          </p>
        </div>

        <button className="btn btn-primary" onClick={onOpenMicrosoftModal}>
          <Plus size={18} />
          <span>Connect Microsoft Account</span>
        </button>
      </div>

      {/* Multi-Account Accounts Summary Banner */}
      <div style={{
        backgroundColor: 'var(--bg-tertiary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '16px 20px',
        marginBottom: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            backgroundColor: 'rgba(99, 102, 241, 0.15)',
            color: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>
              {connectedAccounts.length} Connected Microsoft Account{connectedAccounts.length !== 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Active Workspace: <strong>{activeAccount ? activeAccount.displayName || activeAccount.email : 'None'}</strong>
            </div>
          </div>
        </div>

        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Multi-Tenant Isolated Authentication • OAuth 2.0 PKCE
        </div>
      </div>

      {/* Accounts Grid */}
      {connectedAccounts.length === 0 ? (
        <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            color: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <ShieldCheck size={32} />
          </div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>No Connected Microsoft Accounts</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto 24px' }}>
            Click below to sign in with your official Microsoft Teams work, school, or personal account.
          </p>
          <button className="btn btn-primary" onClick={onOpenMicrosoftModal}>
            <Plus size={18} />
            <span>Connect Microsoft Account</span>
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '24px'
        }}>
        {connectedAccounts.map((acc) => {
          const accId = acc._id || acc.accountId || acc.id;
          const isActive = activeAccId === accId || (activeAccount && activeAccount.email === acc.email);
          const isDefault = defaultAccountId === accId || acc.isDefault;
          const isConnected = acc.status === 'connected' || acc.status === 'Connected' || !acc.status;

          return (
            <div
              key={accId || acc.email}
              className="glass-card"
              style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justify: 'space-between',
                border: isActive ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                boxShadow: isActive ? '0 0 16px rgba(99, 102, 241, 0.2)' : 'none'
              }}
            >
              <div>
                {/* Header: Company, Badges & Options */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isConnected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: isConnected ? 'var(--accent-primary)' : '#ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <ShieldCheck size={24} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>{acc.displayName || acc.company}</h3>
                        {isActive && (
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: 'var(--accent-primary)',
                            color: '#fff',
                            fontSize: '0.7rem',
                            fontWeight: '700'
                          }}>
                            ACTIVE
                          </span>
                        )}
                        {isDefault && (
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: 'rgba(245, 158, 11, 0.2)',
                            color: '#f59e0b',
                            fontSize: '0.7rem',
                            fontWeight: '700'
                          }}>
                            DEFAULT
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{acc.accountType || acc.type || 'Microsoft Work Account'}</span>
                    </div>
                  </div>
                </div>

                {/* Email & Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <Mail size={16} />
                    <span>{acc.email}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <RefreshCw size={16} />
                    <span>Tenant: {acc.tenantId ? `${acc.tenantId.substring(0, 18)}...` : 'common'}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                  {!isActive && isConnected && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => setActiveAccount(acc)}
                      style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                    >
                      <Radio size={14} />
                      <span>Switch Active</span>
                    </button>
                  )}

                  {!isDefault && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => setDefaultAccount(accId)}
                      style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                    >
                      <Star size={14} />
                      <span>Set Default</span>
                    </button>
                  )}

                  {!isConnected && (
                    <button
                      className="btn btn-primary"
                      onClick={() => reconnectAccount(accId)}
                      style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                    >
                      <RefreshCw size={14} />
                      <span>Reconnect</span>
                    </button>
                  )}

                  {isConnected && (
                    <button
                      onClick={() => disconnectAccount(accId)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.78rem',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Trash2 size={14} />
                      <span>Disconnect</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Card Footer */}
              <div style={{
                borderTop: '1px solid var(--border-color)',
                paddingTop: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: isConnected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  color: isConnected ? '#10b981' : '#ef4444',
                  fontSize: '0.78rem',
                  fontWeight: '600'
                }}>
                  {isConnected ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                  <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
                </div>

                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  MSAL OAuth 2.0
                </span>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
