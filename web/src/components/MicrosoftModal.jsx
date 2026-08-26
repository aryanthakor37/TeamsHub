import React, { useState } from 'react';
import { ShieldCheck, Info, X, LogIn, AlertCircle, Building2, Globe, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function MicrosoftModal({ isOpen, onClose }) {
  const { loginWithMicrosoft, authState, authError } = useAuth();
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'guest'
  const [guestOrgName, setGuestOrgName] = useState('');
  const [guestTenantDomain, setGuestTenantDomain] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConnect = async () => {
    setIsSubmitting(true);
    let options = {};

    if (activeTab === 'guest') {
      const cleanTenant = (guestTenantDomain || '').trim();
      const cleanOrg = (guestOrgName || '').trim();
      options = {
        guestTenantId: cleanTenant || 'organizations',
        guestOrgName: cleanOrg || (cleanTenant ? cleanTenant.split('.')[0] : 'Guest Workspace')
      };
    }

    const res = await loginWithMicrosoft(options);
    setIsSubmitting(false);
    if (res && res.success) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="modal-content glass-card-3d" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', padding: '28px' }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
              boxShadow: '0 0 16px rgba(99, 102, 241, 0.25)'
            }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '800', letterSpacing: '-0.02em', margin: 0 }}>
                Connect Microsoft Teams
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>
                Single & Multi-Tenant Integration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Mode Tabs: Home Account vs Guest Workspace */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          padding: '4px',
          backgroundColor: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            style={{
              padding: '9px 14px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: activeTab === 'home' ? 'var(--bg-primary)' : 'transparent',
              color: activeTab === 'home' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'home' ? '700' : '600',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: activeTab === 'home' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.18s ease'
            }}
          >
            <Building2 size={16} />
            <span>Home Organization</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('guest')}
            style={{
              padding: '9px 14px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: activeTab === 'guest' ? 'var(--bg-primary)' : 'transparent',
              color: activeTab === 'guest' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'guest' ? '700' : '600',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: activeTab === 'guest' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.18s ease'
            }}
          >
            <Globe size={16} />
            <span>Guest Workspace</span>
          </button>
        </div>

        {/* Home Account Tab Content */}
        {activeTab === 'home' ? (
          <div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.88rem', lineHeight: '1.5' }}>
              Connect your primary Microsoft 365 company or enterprise work account.
            </p>

            <div style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <CheckCircle2 size={20} />
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)', display: 'block' }}>Direct Live Graph Sync</strong>
                Reads chats, attachments, and colleague presence directly from your main tenant.
              </div>
            </div>
          </div>
        ) : (
          /* Guest Workspace Tab Content (Dynamic inputs without hardcoded names) */
          <div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '14px', fontSize: '0.88rem', lineHeight: '1.5' }}>
              Enter your external client organization details to authorize guest tenant access:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Workspace / Organization Label
                </label>
                <input
                  type="text"
                  placeholder="e.g. Client Company Name"
                  value={guestOrgName}
                  onChange={(e) => setGuestOrgName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.86rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Client Domain or Tenant ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. companydomain.com or Tenant ID (leave blank for auto)"
                  value={guestTenantDomain}
                  onChange={(e) => setGuestTenantDomain(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.86rem',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {authError && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.82rem',
            color: '#ef4444'
          }}>
            <AlertCircle size={16} />
            <span>{authError}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={isSubmitting} style={{ padding: '9px 18px' }}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleConnect} disabled={isSubmitting} style={{ padding: '9px 20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <LogIn size={16} />
            <span>
              {isSubmitting || authState === 'SIGNING_IN' 
                ? 'Authenticating...' 
                : activeTab === 'guest'
                  ? `Connect ${guestOrgName ? guestOrgName.trim() : 'Guest Workspace'}`
                  : 'Sign in with Microsoft'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
