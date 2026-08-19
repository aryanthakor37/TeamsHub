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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={onOpenMicrosoftModal}
            style={{ padding: '14px 28px', fontSize: '1rem' }}
          >
            <span>Connect Microsoft Account</span>
            <ArrowRight size={18} />
          </button>

          <button
            className="btn btn-secondary"
            onClick={onGoToDashboard}
            style={{ padding: '14px 28px', fontSize: '1rem' }}
          >
            Explore Demo Workspace
          </button>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '16px' }}>
          * Microsoft account connection will be enabled in Phase 2.
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
