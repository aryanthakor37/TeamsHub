import React, { useState } from 'react';
import { ShieldCheck, Info, X, LogIn, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
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
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="modal-content glass-card-3d" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px', padding: '28px' }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
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
                Connect Microsoft Account
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>
                Instant Multi-Tenant & Guest Auto-Sync
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

        <p style={{ color: 'var(--text-secondary)', marginBottom: '18px', fontSize: '0.9rem', lineHeight: '1.5' }}>
          Connect your Microsoft Teams work account to automatically sync all chats, files, and guest workspaces in 1-click.
        </p>

        {/* Feature Highlights */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          marginBottom: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.84rem', color: 'var(--text-primary)' }}>
            <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />
            <span><strong>All-in-One:</strong> Auto-detects all your connected guest client tenants.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.84rem', color: 'var(--text-primary)' }}>
            <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />
            <span><strong>Live Graph Stream:</strong> Real-time messages with zero server storage.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.84rem', color: 'var(--text-primary)' }}>
            <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />
            <span><strong>Secure PKCE Flow:</strong> Standard Microsoft 365 token authorization.</span>
          </div>
        </div>

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
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={isSubmitting} style={{ padding: '9px 18px' }}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleConnect} disabled={isSubmitting} style={{ padding: '9px 22px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <LogIn size={16} />
            <span>{isSubmitting || authState === 'SIGNING_IN' ? 'Connecting...' : 'Sign in with Microsoft'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
