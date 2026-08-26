import React, { useState } from 'react';
import { ShieldCheck, Info, X, LogIn, AlertCircle, Building2, Globe, Sparkles, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function MicrosoftModal({ isOpen, onClose }) {
  const { loginWithMicrosoft, authState, authError } = useAuth();
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'guest'
  const [selectedGuestPreset, setSelectedGuestPreset] = useState('BayWa r.e.');
  const [customTenantInput, setCustomTenantInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const guestPresets = [
    {
      name: 'BayWa r.e.',
      domain: 'baywa-re.com',
      tenantId: 'baywa-re.com',
      badge: 'Client Tenant'
    },
    {
      name: 'DR SCHAER AG',
      domain: 'drschaer.com',
      tenantId: 'drschaer.com',
      badge: 'Client Tenant'
    },
    {
      name: 'Kerry Dines Ltd',
      domain: 'kerrydines.com',
      tenantId: 'kerrydines.com',
      badge: 'Client Tenant'
    }
  ];

  const handleConnect = async () => {
    setIsSubmitting(true);
    let options = {};

    if (activeTab === 'guest') {
      if (selectedGuestPreset === 'custom') {
        const cleanInput = (customTenantInput || '').trim();
        options = {
          guestTenantId: cleanInput || 'organizations',
          guestOrgName: cleanInput.split('.')[0] || 'Guest Organization'
        };
      } else {
        const preset = guestPresets.find(p => p.name === selectedGuestPreset) || guestPresets[0];
        options = {
          guestTenantId: preset.tenantId || preset.domain,
          guestOrgName: preset.name
        };
      }
    }

    const res = await loginWithMicrosoft(options);
    setIsSubmitting(false);
    if (res && res.success) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="modal-content glass-card-3d" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', padding: '28px' }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
              boxShadow: '0 0 16px rgba(99, 102, 241, 0.25)'
            }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '800', letterSpacing: '-0.02em', margin: 0 }}>
                Connect Microsoft Teams
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>
                Multi-Tenant & Guest Organization Integration
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

        {/* Mode Tabs: Home Account vs Guest Organization */}
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
              Connect your primary <strong>ESTATIC INFOTECH</strong> or standard company Microsoft 365 work account.
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
                justifyContent: 'center'
              }}>
                <CheckCircle2 size={20} />
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)', display: 'block' }}>Direct Live Graph Sync</strong>
                Reads chats, files, and colleague presence directly from your main tenant.
              </div>
            </div>
          </div>
        ) : (
          /* Guest Organization Tab Content */
          <div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '0.88rem', lineHeight: '1.5' }}>
              Select your <strong>External Client / Guest Organization</strong> to authorize cross-tenant chats & files:
            </p>

            {/* Quick Guest Presets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {guestPresets.map((preset) => {
                const isSelected = selectedGuestPreset === preset.name;
                return (
                  <div
                    key={preset.name}
                    onClick={() => setSelectedGuestPreset(preset.name)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isSelected ? 'var(--accent-light)' : 'var(--bg-secondary)',
                      border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: '#22c55e',
                        boxShadow: '0 0 6px rgba(34, 197, 94, 0.6)'
                      }} />
                      <div>
                        <div style={{ fontWeight: isSelected ? '700' : '600', fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                          {preset.name}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          Tenant: {preset.domain}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <div style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: 'var(--accent-primary)',
                        color: '#fff',
                        fontSize: '0.72rem',
                        fontWeight: '700'
                      }}>
                        Selected
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Custom Tenant Option */}
              <div
                onClick={() => setSelectedGuestPreset('custom')}
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: selectedGuestPreset === 'custom' ? 'var(--accent-light)' : 'var(--bg-secondary)',
                  border: selectedGuestPreset === 'custom' ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease'
                }}
              >
                <div style={{ fontWeight: selectedGuestPreset === 'custom' ? '700' : '600', fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: selectedGuestPreset === 'custom' ? '8px' : '0' }}>
                  + Other Client Organization (Custom Domain / Tenant ID)
                </div>
                {selectedGuestPreset === 'custom' && (
                  <input
                    type="text"
                    placeholder="e.g. clientcorp.com or Tenant GUID"
                    value={customTenantInput}
                    onChange={(e) => setCustomTenantInput(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.84rem',
                      outline: 'none'
                    }}
                  />
                )}
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

        {/* Security & Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={isSubmitting} style={{ padding: '9px 18px' }}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleConnect} disabled={isSubmitting} style={{ padding: '9px 20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <LogIn size={16} />
            <span>
              {isSubmitting || authState === 'SIGNING_IN' 
                ? 'Authenticating...' 
                : activeTab === 'guest'
                  ? `Connect ${selectedGuestPreset === 'custom' ? 'Guest Tenant' : selectedGuestPreset}`
                  : 'Sign in with Microsoft'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
