import React from 'react';
import { Layers, ShieldCheck, Zap, Globe, ArrowRight } from 'lucide-react';

export default function WelcomePage({ onOpenMicrosoftModal, onGoToDashboard }) {
  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '40px 24px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Hero Pill */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--accent-light)',
          color: 'var(--accent-primary)',
          fontSize: '0.85rem',
          fontWeight: '600',
          marginBottom: '24px'
        }}>
          <Layers size={16} />
          <span>TeamsHub Phase 1 Workspace Companion</span>
        </div>

        {/* Hero Title */}
        <h1 style={{
          fontSize: '3rem',
          fontWeight: '800',
          lineHeight: '1.15',
          marginBottom: '20px',
          background: 'linear-gradient(135deg, var(--text-primary) 30%, var(--accent-primary) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          All your Microsoft Teams accounts, chats and files in one workspace.
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: '1.2rem',
          color: 'var(--text-secondary)',
          lineHeight: '1.6',
          maxWidth: '680px',
          margin: '0 auto 36px'
        }}>
          Connect your Microsoft Teams workspaces and manage your conversations and shared files without constantly switching accounts.
        </p>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={onOpenMicrosoftModal}
            style={{ padding: '13px 26px', fontSize: '0.98rem' }}
          >
            <span>Connect Microsoft Account</span>
            <ArrowRight size={18} />
          </button>

          <a
            href="https://github.com/aryanthakor37/TeamsHub/releases/download/v1.0.0-stable-checkpoint/TeamsHub-Windows-v1.0.0.zip"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{
              padding: '13px 24px',
              fontSize: '0.98rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              textDecoration: 'none',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              borderColor: 'var(--accent-primary)',
              color: 'var(--text-primary)'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.401H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
            </svg>
            <span>Download for Windows (.exe)</span>
          </a>

          <button
            className="btn btn-secondary"
            onClick={onGoToDashboard}
            style={{ padding: '13px 22px', fontSize: '0.98rem' }}
          >
            Explore Demo Workspace
          </button>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '16px' }}>
          * Multi-tenant guest workspaces available with native Windows Desktop companion.
        </p>

        {/* Feature Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '20px',
          marginTop: '60px',
          textAlign: 'left'
        }}>
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              color: '#6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <Globe size={24} />
            </div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Unified Accounts</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Switch between work, client, and freelance accounts effortlessly in a single UI.
            </p>
          </div>

          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(14, 165, 233, 0.12)',
              color: '#0ea5e9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <Zap size={24} />
            </div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Centralized Inbox</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              View unread chats and urgent follow-ups across all organizations without logging out.
            </p>
          </div>

          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <ShieldCheck size={24} />
            </div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Enterprise Security</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Built with zero password scraping and strict OAuth MSAL standards.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
