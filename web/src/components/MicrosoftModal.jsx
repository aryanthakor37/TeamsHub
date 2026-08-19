import React, { useState } from 'react';
import { ShieldCheck, Info, X, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function MicrosoftModal({ isOpen, onClose }) {
  const { loginWithMicrosoft, authState, authError } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConnect = async () => {
    setIsSubmitting(true);
    const res = await loginWithMicrosoft();
    setIsSubmitting(false);
    if (res && res.success) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)'
            }}>
              <ShieldCheck size={22} />
            </div>
            <h3 style={{ fontSize: '1.25rem' }}>Connect Microsoft Account</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.92rem', lineHeight: '1.6' }}>
          Connect your official <strong>Microsoft Teams / Entra ID</strong> work or school account to TeamsHub.
        </p>

        {authError && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem',
            color: '#ef4444'
          }}>
            <AlertCircle size={16} />
            <span>{authError}</span>
          </div>
        )}

        <div style={{
          backgroundColor: 'var(--bg-tertiary)',
          padding: '14px',
          borderRadius: 'var(--radius-sm)',
          borderLeft: '4px solid var(--accent-primary)',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
          marginBottom: '20px'
        }}>
          <strong>Phase 2 Security Directives:</strong>
          <ul style={{ paddingLeft: '16px', marginTop: '6px', margin: 0 }}>
            <li>OAuth 2.0 PKCE secure authentication flow.</li>
            <li>No passwords are ever requested or stored by TeamsHub.</li>
            <li>Multi-tenant ready for enterprise work & school accounts.</li>
          </ul>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleConnect} disabled={isSubmitting}>
            <LogIn size={16} />
            <span>{isSubmitting || authState === 'SIGNING_IN' ? 'Authenticating...' : 'Sign in with Microsoft'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
