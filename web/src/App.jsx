import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import MicrosoftModal from './components/MicrosoftModal';
import { MicrosoftAuthProvider } from './components/auth/MicrosoftAuthProvider';

import WelcomePage from './pages/Welcome/WelcomePage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import ChatsPage from './pages/Chats/ChatsPage';
import FilesPage from './pages/Files/FilesPage';
import SearchPage from './pages/Search/SearchPage';
import AccountsPage from './pages/Accounts/AccountsPage';
import SettingsPage from './pages/Settings/SettingsPage';

import { useChats } from './hooks/useChats';
import { getAvatarColor, getInitials } from './utils/avatarUtils';
import { getSocket } from './services/socketService';
import { MessageSquare, X, ExternalLink } from 'lucide-react';

function MainLayout() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMicrosoftModalOpen, setIsMicrosoftModalOpen] = useState(false);
  const [theme, setTheme] = useState('light');
  const [activeToast, setActiveToast] = useState(null);

  // Global chats hook for real-time unread count and notifications
  const { unreadCount } = useChats('all');

  // Listen for Toast Notification, Socket events, and Open Chat events
  useEffect(() => {
    const handleToast = (e) => {
      const chat = e.detail?.chat;
      if (chat) {
        if (chat.isSelfChat || chat.participant?.includes('(You)')) return;
        setActiveToast(chat);
        setTimeout(() => {
          setActiveToast((curr) => ((curr?._id || curr?.id) === (chat._id || chat.id) ? null : curr));
        }, 6000);
      }
    };

    const handleOpenChat = () => {
      setActiveTab('chats');
    };

    // Socket.IO real-time toast listener
    const socket = getSocket();
    const handleSocketToast = (data) => {
      if (data?.chat) {
        window.dispatchEvent(new CustomEvent('teamshub:new-toast-notification', { detail: data }));
      }
    };

    socket.on('teamshub:new-toast-notification', handleSocketToast);
    window.addEventListener('teamshub:new-toast-notification', handleToast);
    window.addEventListener('teamshub:open-chat', handleOpenChat);

    return () => {
      socket.off('teamshub:new-toast-notification', handleSocketToast);
      window.removeEventListener('teamshub:new-toast-notification', handleToast);
      window.removeEventListener('teamshub:open-chat', handleOpenChat);
    };
  }, []);

  // Sync theme attribute to <html> element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const [selectedSearchChatId, setSelectedSearchChatId] = useState(null);
  const [selectedSearchParticipant, setSelectedSearchParticipant] = useState(null);
  const [selectedSearchMessageId, setSelectedSearchMessageId] = useState(null);
  const [selectedSearchKeyword, setSelectedSearchKeyword] = useState(null);
  const [selectedSearchFile, setSelectedSearchFile] = useState(null);

  const renderActivePage = () => {
    switch (activeTab) {
      case 'welcome':
        return (
          <WelcomePage
            onOpenMicrosoftModal={() => setIsMicrosoftModalOpen(true)}
            onGoToDashboard={() => setActiveTab('dashboard')}
          />
        );
      case 'dashboard':
        return (
          <DashboardPage
            setActiveTab={setActiveTab}
            onSelectChat={(chatId, participant, messageId, keyword) => {
              setSelectedSearchChatId(chatId);
              setSelectedSearchParticipant(participant);
              setSelectedSearchMessageId(messageId);
              setSelectedSearchKeyword(keyword);
              setActiveTab('chats');
            }}
            onSelectFile={(file) => {
              setSelectedSearchFile(file);
              setActiveTab('files');
            }}
          />
        );
      case 'chats':
        return (
          <ChatsPage
            onOpenMicrosoftModal={() => setIsMicrosoftModalOpen(true)}
            initialChatId={selectedSearchChatId}
            initialParticipant={selectedSearchParticipant}
            initialMessageId={selectedSearchMessageId}
            initialKeyword={selectedSearchKeyword}
          />
        );
      case 'files':
        return (
          <FilesPage
            initialFile={selectedSearchFile}
            onClearInitialFile={() => setSelectedSearchFile(null)}
          />
        );
      case 'search':
        return (
          <SearchPage
            setActiveTab={setActiveTab}
            onSelectChat={(chatId, participant, messageId, keyword) => {
              setSelectedSearchChatId(chatId);
              setSelectedSearchParticipant(participant);
              setSelectedSearchMessageId(messageId);
              setSelectedSearchKeyword(keyword);
              setActiveTab('chats');
            }}
            onSelectFile={(file) => {
              setSelectedSearchFile(file);
              setActiveTab('files');
            }}
          />
        );
      case 'accounts':
        return <AccountsPage onOpenMicrosoftModal={() => setIsMicrosoftModalOpen(true)} />;
      case 'settings':
        return <SettingsPage theme={theme} toggleTheme={toggleTheme} />;
      default:
        return <DashboardPage setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="app-container" style={{ position: 'relative' }}>
      {/* Vertical Workspace Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} unreadChatCount={unreadCount} />

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenMicrosoftModal={() => setIsMicrosoftModalOpen(true)}
          theme={theme}
          toggleTheme={toggleTheme}
        />

        <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {renderActivePage()}
        </main>
      </div>

      {/* Teams In-App Toast Notification Banner */}
      {activeToast && (
        <div 
          onClick={() => {
            setActiveTab('chats');
            window.dispatchEvent(new CustomEvent('teamshub:open-chat', { detail: { chatId: activeToast._id || activeToast.id } }));
            setActiveToast(null);
          }}
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 99999,
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderLeft: '4px solid var(--accent-primary)',
            borderRadius: '12px',
            padding: '14px 18px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            maxWidth: '380px',
            cursor: 'pointer',
            animation: 'slideInRight 0.3s ease-out',
            backdropFilter: 'blur(10px)'
          }}
        >
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            backgroundColor: getAvatarColor(activeToast.participant),
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '700',
            fontSize: '1rem',
            flexShrink: 0
          }}>
            {getInitials(activeToast.participant)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span style={{ fontWeight: '700', fontSize: '0.88rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeToast.participant}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: '600' }}>Teams</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeToast.lastMessagePreview || 'Sent you a new message'}
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveToast(null);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Microsoft Integration Dialog & Login Trigger */}
      <MicrosoftModal
        isOpen={isMicrosoftModalOpen}
        onClose={() => setIsMicrosoftModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <MicrosoftAuthProvider>
      <MainLayout />
    </MicrosoftAuthProvider>
  );
}
