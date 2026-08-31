import React, { useState } from 'react';
import { ShieldCheck, Info, X, LogIn, AlertCircle, CheckCircle2, Sparkles, Building2, Globe } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function MicrosoftModal({ isOpen, onClose }) {
  const { loginWithMicrosoft, authState, authError } = useAuth();
  const [connectMode, setConnectMode] = useState('home'); // 'home' | 'guest'
  const [guestOrgName, setGuestOrgName] = useState('');
  const [guestTenantDomain, setGuestTenantDomain] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConnect = async () => {
    setIsSubmitting(true);
    let options = {};
    if (connectMode === 'guest') {
      const cleanDomain = guestTenantDomain.trim() || guestOrgName.trim().toLowerCase().replace(/\s+/g, '') + '.com';
      options = {
        guestTenantId: cleanDomain,
        guestOrgName: guestOrgName.trim() || 'Guest Organization'
      };
    }
    const res = await loginWithMicrosoft(options);
    setIsSubmitting(false);
    if (res && res.success) {
      onClose();
    }
  };

  const handlePresetSelect = (name, domain) => {
    setConnectMode('guest');
    setGuestOrgName(name);
    setGuestTenantDomain(domain);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="modal-content glass-card-3d" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', padding: '26px' }}>
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
                Connect Microsoft Teams
              </h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>
                Multi-Account & Client Guest Workspaces
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

        {/* Mode Selector Tabs */}
        <div style={{
          display: 'flex',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '8px',
          padding: '4px',
          marginBottom: '16px',
          border: '1px solid var(--border-color)'
        }}>
          <button
            onClick={() => setConnectMode('home')}
            style={{
              flex: 1,
              padding: '7px 10px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: connectMode === 'home' ? 'var(--accent-primary)' : 'transparent',
              color: connectMode === 'home' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: '700',
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <Building2 size={14} />
            <span>Primary Work Account</span>
          </button>
          <button
            onClick={() => setConnectMode('guest')}
            style={{
              flex: 1,
              padding: '7px 10px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: connectMode === 'guest' ? 'var(--accent-primary)' : 'transparent',
              color: connectMode === 'guest' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: '700',
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <Globe size={14} />
            <span>Guest Client Tenant</span>
          </button>
        </div>

        {connectMode === 'home' ? (
          <div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.86rem', lineHeight: '1.5' }}>
              Connect your primary Microsoft Teams work or personal email to sync all direct messages, channels, and team groups.
            </p>

            {/* Feature Highlights */}
            <div style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              marginBottom: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                <CheckCircle2 size={15} color="#10b981" style={{ flexShrink: 0 }} />
                <span><strong>Instant Sync:</strong> Direct connection to Microsoft Graph API.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                <CheckCircle2 size={15} color="#10b981" style={{ flexShrink: 0 }} />
                <span><strong>Multi-Account:</strong> Connect unlimited accounts simultaneously.</span>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '0.84rem', lineHeight: '1.4' }}>
              Connect an external client organization where you are added as a <strong>Guest User</strong> (e.g. DR SCHAER AG, BayWa).
            </p>

            {/* Quick Presets */}
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Quick Presets:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => handlePresetSelect('DR SCHAER AG', 'drschaer.com')}
                  className="tab-pill-3d"
                  style={{
                    padding: '3px 9px',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    fontWeight: '700',
                    border: '1px solid var(--accent-primary)',
                    backgroundColor: guestOrgName === 'DR SCHAER AG' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                    color: guestOrgName === 'DR SCHAER AG' ? '#ffffff' : 'var(--text-primary)',
                    cursor: 'pointer'
                  }}
                >
                  🏢 DR SCHAER AG
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetSelect('BayWa r.e.', 'baywa-re.com')}
                  className="tab-pill-3d"
                  style={{
                    padding: '3px 9px',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    fontWeight: '700',
                    border: '1px solid var(--border-color)',
                    backgroundColor: guestOrgName === 'BayWa r.e.' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                    color: guestOrgName === 'BayWa r.e.' ? '#ffffff' : 'var(--text-primary)',
                    cursor: 'pointer'
                  }}
                >
                  🏢 BayWa r.e.
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetSelect('ADNOC', 'adnoc.ae')}
                  className="tab-pill-3d"
                  style={{
                    padding: '3px 9px',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    fontWeight: '700',
                    border: '1px solid var(--border-color)',
                    backgroundColor: guestOrgName === 'ADNOC' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                    color: guestOrgName === 'ADNOC' ? '#ffffff' : 'var(--text-primary)',
                    cursor: 'pointer'
                  }}
                >
                  🏢 ADNOC
                </button>
              </div>
            </div>

            {/* Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Guest Organization Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. DR SCHAER AG"
                  value={guestOrgName}
                  onChange={(e) => setGuestOrgName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.84rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Client Domain or Tenant ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. drschaer.com or drschaer.onmicrosoft.com"
                  value={guestTenantDomain}
                  onChange={(e) => setGuestTenantDomain(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.84rem'
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={isSubmitting} style={{ padding: '9px 18px' }}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConnect}
            disabled={isSubmitting || (connectMode === 'guest' && !guestOrgName.trim() && !guestTenantDomain.trim())}
            style={{ padding: '9px 22px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <LogIn size={16} />
            <span>
              {isSubmitting || authState === 'SIGNING_IN'
                ? 'Connecting...'
                : connectMode === 'guest'
                  ? `Connect ${guestOrgName || 'Guest Workspace'}`
                  : 'Sign in with Microsoft'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
