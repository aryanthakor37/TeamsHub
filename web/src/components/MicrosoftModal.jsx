import React, { useState } from 'react';
import { ShieldCheck, X, LogIn, AlertCircle, CheckCircle2, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function MicrosoftModal({ isOpen, onClose }) {
  const { loginWithMicrosoft, authState, authError } = useAuth();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [guestTenantDomain, setGuestTenantDomain] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConnect = async () => {
    setIsSubmitting(true);
    let options = {};
    if (showAdvanced && guestTenantDomain.trim()) {
      let cleanDomain = guestTenantDomain.trim();
      // Sanitize input if user pasted a URL or trailing slash
      cleanDomain = cleanDomain.replace(/^https?:\/\//i, '').replace(/login\.microsoftonline\.com\//i, '').replace(/\/.*$/, '').trim();
      const orgName = cleanDomain.includes('.') ? cleanDomain.split('.')[0].toUpperCase() : cleanDomain.substring(0, 12).toUpperCase();
      options = {
        guestTenantId: cleanDomain,
        guestOrgName: orgName
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
      <div className="modal-content glass-card-3d" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px', padding: '26px' }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
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
              <h3 style={{ fontSize: '1.18rem', fontWeight: '800', letterSpacing: '-0.02em', margin: 0 }}>
                Connect Microsoft Account
              </h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>
                Instant Multi-Account & Workspace Sync
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

        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.88rem', lineHeight: '1.5' }}>
          Sign in with any Microsoft 365 work, school, or personal account. All your direct chats, groups, and files will sync automatically.
        </p>

        {/* Feature Highlights */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '14px',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
            <CheckCircle2 size={15} color="#10b981" style={{ flexShrink: 0 }} />
            <span><strong>Multi-Account:</strong> Connect multiple work or guest accounts.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
            <CheckCircle2 size={15} color="#10b981" style={{ flexShrink: 0 }} />
            <span><strong>Zero Setup:</strong> Direct Microsoft Graph API live stream.</span>
          </div>
        </div>

        {/* Advanced Tenant / Guest Organization Option */}
        <div style={{ marginBottom: '16px' }}>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--accent-primary)',
              fontSize: '0.8rem',
              fontWeight: '700',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Globe size={14} />
            <span>{showAdvanced ? 'Hide Guest Organization / Tenant' : 'Connect Client Guest Organization / Tenant (Optional)'}</span>
            {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showAdvanced && (
            <div style={{ marginTop: '12px', padding: '12px', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
                Client Organization Name, Domain, or Tenant ID
              </label>
              <input
                type="text"
                placeholder="Enter client company name, domain, or tenant ID"
                value={guestTenantDomain}
                onChange={(e) => setGuestTenantDomain(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.84rem'
                }}
              />
            </div>
          )}
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
          <button
            className="btn btn-primary"
            onClick={handleConnect}
            disabled={isSubmitting}
            style={{ padding: '9px 22px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <LogIn size={16} />
            <span>{isSubmitting || authState === 'SIGNING_IN' ? 'Connecting...' : 'Sign in with Microsoft'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
