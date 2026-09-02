import React from 'react';
import { User, Bell, Shield, Database, Info, ChevronRight, Lock } from 'lucide-react';

export default function SettingsPage() {
  const sections = [
    {
      title: 'Account & Identity',
      icon: User,
      items: [
        { label: 'Profile Preferences', description: 'Manage display name, avatar, and global status' },
        { label: 'Connected Accounts', description: 'View active Microsoft workspace tokens' }
      ]
    },
    {
      title: 'Notifications',
      icon: Bell,
      items: [
        { label: 'Notification Preferences', description: 'Configure push, email, and desktop alerts' }
      ]
    },
    {
      title: 'Appearance',
      icon: Shield,
      items: [
        { label: 'Workspace Theme', description: 'Unified Dark Cyber Glassmorphic Theme (Always Active)', isPermanent: true }
      ]
    },
    {
      title: 'Security & Privacy',
      icon: Shield,
      items: [
        { label: 'Biometric & PIN Lock', description: 'Secure TeamsHub with device biometric authentication' },
        { label: 'Privacy & Token Storage', description: 'Zero password logging policy documentation' }
      ]
    },
    {
      title: 'Data & Storage',
      icon: Database,
      items: [
        { label: 'Cache & File Storage', description: 'Manage local cache and offline document storage' }
      ]
    },
    {
      title: 'About TeamsHub',
      icon: Info,
      items: [
        { label: 'Version & Build Specs', description: 'TeamsHub v1.0.0 (Phase 1 Foundation)' },
        { label: 'Terms of Service & License', description: 'MIT Open Source License' }
      ]
    }
  ];

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Settings & Preferences</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '32px' }}>
          Configure workspace behavior, notification alerts, and theme preferences.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {sections.map((section) => {
            const SectionIcon = section.icon;
            return (
              <div key={section.title} className="card-3d-interactive" style={{ padding: '22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <SectionIcon size={20} color="#00f2fe" />
                  <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#ffffff' }}>{section.title}</h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {section.items.map((item) => (
                    <div
                      key={item.label}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 16px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.04)'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)' }}>{item.label}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.description}</div>
                      </div>

                      {item.isPermanent ? (
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(0, 242, 254, 0.12)',
                          color: '#00f2fe',
                          border: '1px solid rgba(0, 242, 254, 0.3)'
                        }}>
                          Permanent Dark
                        </span>
                      ) : (
                        <ChevronRight size={18} color="var(--text-muted)" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
