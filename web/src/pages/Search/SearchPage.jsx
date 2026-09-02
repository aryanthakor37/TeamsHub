import React, { useState, useEffect } from 'react';
import { Search, MessageSquare, FileText, User, ShieldCheck, Loader2 } from 'lucide-react';
import { mockChats, mockMessages, mockFiles } from '../../services/mockDataService';
import { useAuth } from '../../hooks/useAuth';
import { useChats } from '../../hooks/useChats';
import { getInitials, getAvatarColor } from '../../utils/avatarUtils';
import { cleanHtmlText, sanitizeDisplayName } from '../../utils/textUtils';
import DocumentPreviewModal from '../../components/DocumentPreviewModal';

export default function SearchPage({ setActiveTab, onSelectChat, onSelectFile }) {
  const { connectedAccounts } = useAuth();
  const isConnected = connectedAccounts && connectedAccounts.length > 0;
  const { chats: realChats } = useChats('all');
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState({
    chats: [],
    messages: [],
    files: [],
    accounts: []
  });
  const [previewDocModal, setPreviewDocModal] = useState(null);

  const handleJumpToChat = (chatId, participant, messageId, keyword) => {
    const kw = keyword || query;
    if (onSelectChat) {
      onSelectChat(chatId, participant, messageId, kw);
    } else {
      window.dispatchEvent(new CustomEvent('teamshub:open-chat', {
        detail: { chatId, participant, messageId, keyword: kw }
      }));
      if (setActiveTab) {
        setActiveTab('chats');
      }
    }
  };

  const filters = ['All', 'Messages', 'Files', 'People', 'Accounts'];

  // Debounced real API search + instant fallback logic
  useEffect(() => {
    if (!query.trim() || !isConnected) {
      setSearchResults({ chats: [], messages: [], files: [], accounts: [] });
      return;
    }

    const qLower = query.toLowerCase().trim();
    const qClean = qLower.replace(/_/g, ' ');

    const chatsToSearch = realChats && realChats.length > 0 ? realChats : [];
    const matchedChats = chatsToSearch.filter(
      (c) => c.participant?.toLowerCase().includes(qLower) ||
             (c.lastMessagePreview && c.lastMessagePreview.toLowerCase().includes(qLower)) ||
             (c.lastMessage && c.lastMessage.toLowerCase().includes(qLower)) ||
             (c.company && c.company.toLowerCase().includes(qLower))
    );

    const isPhotoQuery = ['photo', 'photos', 'image', 'images', 'pic', 'picture', 'jpg', 'png', 'jpeg', 'img'].some(term => qLower.includes(term));

    const matchedFiles = mockFiles.filter(
      (f) => f.name.toLowerCase().includes(qLower) ||
             f.name.toLowerCase().replace(/_/g, ' ').includes(qClean) ||
             qClean.includes(f.name.toLowerCase().split('.')[0]) ||
             (f.sender && f.sender.toLowerCase().includes(qLower)) ||
             (f.category && f.category.toLowerCase().includes(qLower)) ||
             (isPhotoQuery && (f.category === 'Images' || f.name.toLowerCase().includes('photo') || f.name.toLowerCase().includes('image') || f.name.toLowerCase().endsWith('.jpg') || f.name.toLowerCase().endsWith('.png')))
    );

    const matchedAccounts = (connectedAccounts || []).filter(
      (a) => (a.displayName && a.displayName.toLowerCase().includes(qLower)) ||
             (a.name && a.name.toLowerCase().includes(qLower)) ||
             (a.email && a.email.toLowerCase().includes(qLower)) ||
             (a.company && a.company.toLowerCase().includes(qLower))
    );

    const matchedMessages = [];
    Object.entries(mockMessages).forEach(([chatIdOrName, msgs]) => {
      msgs.forEach((m) => {
        if (m.text && m.text.toLowerCase().includes(qLower)) {
          matchedMessages.push({
            id: m.id,
            chatId: chatIdOrName,
            participant: chatIdOrName,
            senderName: m.sender || chatIdOrName,
            createdDateTime: m.timestamp || 'Today',
            content: m.text
          });
        }
      });
    });

    // Render client search results instantly so screen is NEVER blank
    setSearchResults({
      chats: matchedChats,
      messages: matchedMessages,
      files: matchedFiles,
      accounts: matchedAccounts
    });

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const apiBase = (import.meta.env.VITE_API_BASE_URL && import.meta.env.VITE_API_BASE_URL.trim())
          ? `${import.meta.env.VITE_API_BASE_URL.trim().replace(/\/$/, '')}/api`
          : '/api';
        const activeEmail = localStorage.getItem('teamshub_active_email') || '';
        const res = await fetch(`${apiBase}/search?q=${encodeURIComponent(query)}`, {
          headers: {
            'x-user-email': activeEmail
          }
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            const apiChats = json.data.chats && json.data.chats.length > 0 ? json.data.chats : matchedChats;
            const apiMessages = json.data.messages && json.data.messages.length > 0 ? json.data.messages : matchedMessages;
            const apiFiles = json.data.files && json.data.files.length > 0 ? json.data.files : matchedFiles;
            const apiAccounts = json.data.accounts && json.data.accounts.length > 0 ? json.data.accounts : matchedAccounts;

            setSearchResults({
              chats: apiChats,
              messages: apiMessages,
              files: apiFiles,
              accounts: apiAccounts
            });
          }
        }
      } catch (err) {
        console.warn('Backend search notice:', err.message);
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  const { chats, messages, files, accounts } = searchResults;

  const totalResults = chats.length + messages.length + files.length + accounts.length;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 28px' }}>
      <div style={{ maxWidth: '880px', margin: '0 auto' }}>

        {/* Header Title */}
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            Cross-Tenant Global Search
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Search messages, teammates, documents and connected accounts across all Microsoft organizations.
          </p>
        </div>

        {/* Large Prominent Search Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          padding: '16px 20px',
          backgroundColor: 'rgba(16, 22, 38, 0.45)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(0, 242, 254, 0.35)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
          marginBottom: '24px'
        }}>
          {loading ? (
            <Loader2 size={24} className="spin" color="var(--accent-primary)" />
          ) : (
            <Search size={24} color="#00f2fe" />
          )}
          <input
            type="text"
            placeholder="Search messages, files, teammates or company accounts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: '1.1rem',
              fontWeight: '500',
              color: 'var(--text-primary)',
              width: '100%'
            }}
            autoFocus
          />
        </div>

        {/* Filter Chips */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '28px' }}>
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              style={{
                padding: '8px 18px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                backgroundColor: activeFilter === f ? 'var(--accent-primary)' : 'rgba(16, 22, 38, 0.42)',
                color: activeFilter === f ? '#ffffff' : 'var(--text-secondary)',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Empty State */}
        {!query.trim() && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <Search size={48} style={{ opacity: 0.4, marginBottom: '12px' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: '600' }}>Start typing to search across all workspaces</h3>
            <p style={{ fontSize: '0.85rem', marginTop: '6px' }}>Try searching for a teammate name, chat message, or shared PDF/Word file.</p>
          </div>
        )}

        {query.trim() && !loading && totalResults === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <Search size={48} style={{ opacity: 0.4, marginBottom: '12px' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: '600' }}>No results found for "{query}"</h3>
            <p style={{ fontSize: '0.85rem', marginTop: '6px' }}>Try searching with a different keyword or check your connected accounts.</p>
          </div>
        )}

        {/* Search Results Display */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

          {/* Chats & Conversations */}
          {(activeFilter === 'All' || activeFilter === 'Messages' || activeFilter === 'People') && chats.length > 0 && (
            <div>
              <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '14px', letterSpacing: '0.05em', fontWeight: '700' }}>
                Conversations & Teammates ({chats.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {chats.map((chat) => (
                  <div
                    key={chat._id || chat.id}
                    className="card-3d-interactive"
                    onClick={() => handleJumpToChat(chat._id || chat.id || chat.microsoftChatId, chat.participant, null, query)}
                    style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', borderRadius: '16px', cursor: 'pointer' }}
                  >
                    <div style={{
                      width: '42px', height: '42px', borderRadius: '50%',
                      backgroundColor: getAvatarColor(chat.participant), color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700'
                    }}>
                      {getInitials(chat.participant)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>{sanitizeDisplayName(chat.participant)}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={`badge ${chat.accountBadge || 'badge-company-a'}`}>{sanitizeDisplayName(chat.company || 'Microsoft Teams')}</span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: '600' }}>Open Chat →</span>
                        </div>
                      </div>
                      <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{cleanHtmlText(chat.lastMessagePreview || chat.lastMessage)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages content */}
          {(activeFilter === 'All' || activeFilter === 'Messages') && messages.length > 0 && (
            <div>
              <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '14px', letterSpacing: '0.05em', fontWeight: '700' }}>
                Message Content Matches ({messages.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {messages.map((msg) => (
                  <div
                    key={msg._id || msg.id}
                    className="card-3d-interactive"
                    onClick={() => handleJumpToChat(msg.chatId || msg.threadId || msg._id || msg.id, msg.senderName, msg._id || msg.id || msg.microsoftMessageId, query)}
                    style={{ padding: '16px', display: 'flex', alignItems: 'flex-start', gap: '14px', borderRadius: '16px', cursor: 'pointer' }}
                  >
                    <MessageSquare size={20} color="var(--accent-primary)" style={{ marginTop: '2px' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{sanitizeDisplayName(msg.senderName)}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {new Date(msg.createdDateTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: '600' }}>Jump to Message →</span>
                        </div>
                      </div>
                      <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0 }}>{cleanHtmlText(msg.content)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Files & Documents */}
          {(activeFilter === 'All' || activeFilter === 'Files') && files.length > 0 && (
            <div>
              <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '14px', letterSpacing: '0.05em', fontWeight: '700' }}>
                Files & Shared Attachments ({files.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {files.map((file, idx) => (
                  <div
                    key={file.id || idx}
                    className="card-3d-interactive"
                    onClick={() => {
                      if (onSelectFile) {
                        onSelectFile(file);
                      } else {
                        setPreviewDocModal(file);
                      }
                    }}
                    style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', borderRadius: '16px', cursor: 'pointer' }}
                  >
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(99, 102, 241, 0.12)',
                      color: 'var(--accent-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <FileText size={20} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>{file.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {file.contentType || file.category || 'Document'} • Shared by {file.sender || 'Teammate'}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: '600' }}>Preview →</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Connected Accounts */}
          {((activeFilter === 'All' && accounts.length > 0) || activeFilter === 'Accounts') && (
            <div>
              <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '14px', letterSpacing: '0.05em', fontWeight: '700' }}>
                Connected Accounts & Workspaces ({(query.trim() ? accounts : (connectedAccounts || [])).length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(query.trim() ? accounts : (connectedAccounts || [])).map((acc) => (
                  <div key={acc._id || acc.id || acc.email} className="card-3d-interactive" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', borderRadius: '16px' }}>
                    <ShieldCheck size={24} color="var(--accent-primary)" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>{acc.displayName || acc.name || 'Microsoft Account'}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{acc.email} • Microsoft Teams</div>
                    </div>
                    <span style={{ fontSize: '0.74rem', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', fontWeight: '700' }}>
                      Active
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Document Preview Modal */}
      {previewDocModal && (
        <DocumentPreviewModal
          file={previewDocModal}
          onClose={() => setPreviewDocModal(null)}
        />
      )}
    </div>
  );
}
