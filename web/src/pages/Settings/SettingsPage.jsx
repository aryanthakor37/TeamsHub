import React from 'react';
import { User, Bell, Palette, Shield, Database, Info, ChevronRight, Moon, Sun, Monitor } from 'lucide-react';

export default function SettingsPage() {
  const [currentTheme, setCurrentTheme] = React.useState(() => {
    return localStorage.getItem('teamshub_theme') || 'dark';
  });

  const handleSetTheme = (theme) => {
    setCurrentTheme(theme);
    localStorage.setItem('teamshub_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  };

  const sections = [
    {
      title: 'Account & Identity',
      icon: User,
      items: [
        { label: 'Profile Preferences', description: 'Manage display name, avatar, and global Microsoft presence' },
        { label: 'Connected Accounts', description: 'View and manage active Microsoft workspace tokens' }
      ]
    },
    {
      title: 'Notifications & Alerts',
      icon: Bell,
      items: [
        { label: 'Notification Preferences', description: 'Configure real-time incoming chat toast alerts and audio chimes' }
      ]
    },
    {
      title: 'Security & Token Storage',
      icon: Shield,
      items: [
        { label: 'Multi-Tenant OAuth Isolation', description: 'Tokens are encrypted and isolated per tenant' },
        { label: 'Zero-Storage Compliance', description: 'Messages stream live in-memory with zero database logging' }
      ]
    },
    {
      title: 'Data & Cache',
      icon: Database,
      items: [
        { label: 'File Cache & Storage', description: 'Manage local in-memory document previews and cache' }
      ]
    },
    {
      title: 'About TeamsHub',
      icon: Info,
      items: [
        { label: 'Version & Architecture', description: 'TeamsHub Enterprise v2.0 (Fluent 2 Design)' },
        { label: 'License', description: 'MIT Enterprise License' }
      ]
    }
  ];

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '6px', color: 'var(--text-primary)' }}>
          Settings & Preferences
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '28px' }}>
          Configure workspace theme, account security, and notification preferences.
        </p>

        {/* Dedicated Appearance & Theme Selector Card */}
        <div className="card-3d-interactive" style={{ padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Palette size={20} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              Appearance & Theme
            </h3>
          </div>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
            Choose how TeamsHub looks on your device.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            {/* Dark Theme Option */}
            <div
              onClick={() => handleSetTheme('dark')}
              style={{
                padding: '16px',
                borderRadius: '8px',
                border: currentTheme === 'dark' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                backgroundColor: '#1f1f1f',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: currentTheme === 'dark' ? '0 0 12px rgba(91, 95, 199, 0.35)' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Moon size={18} color="#a6adff" />
                  <span style={{ fontWeight: '700', fontSize: '0.9rem', color: '#ffffff' }}>Teams Dark</span>
                </div>
                {currentTheme === 'dark' && (
                  <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#ffffff', backgroundColor: 'var(--accent-primary)', padding: '2px 8px', borderRadius: '10px' }}>
                    Active
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.76rem', color: '#949494' }}>
                Classic Microsoft Teams charcoal dark canvas
              </div>
            </div>

            {/* Light Theme Option */}
            <div
              onClick={() => handleSetTheme('light')}
              style={{
                padding: '16px',
                borderRadius: '8px',
                border: currentTheme === 'light' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: currentTheme === 'light' ? '0 0 12px rgba(91, 95, 199, 0.35)' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sun size={18} color="#f59e0b" />
                  <span style={{ fontWeight: '700', fontSize: '0.9rem', color: '#242424' }}>Teams Light</span>
                </div>
                {currentTheme === 'light' && (
                  <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#ffffff', backgroundColor: 'var(--accent-primary)', padding: '2px 8px', borderRadius: '10px' }}>
                    Active
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.76rem', color: '#616161' }}>
                Clean crisp Microsoft Teams light mode
              </div>
            </div>
          </div>
        </div>

        {/* Other Settings Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {sections.map((section) => {
            const SectionIcon = section.icon;
            return (
              <div key={section.title} className="card-3d-interactive" style={{ padding: '22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <SectionIcon size={19} color="var(--accent-primary)" />
                  <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>{section.title}</h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {section.items.map((item) => (
                    <div
                      key={item.label}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '0.88rem', color: 'var(--text-primary)' }}>{item.label}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{item.description}</div>
                      </div>

                      <ChevronRight size={16} color="var(--text-muted)" />
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
