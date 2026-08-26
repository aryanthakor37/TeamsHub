import React, { useState } from 'react';
import { Send, X, Check, Search, MessageSquare, Loader2, FileText, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useChats } from '../hooks/useChats';
import { sendMessageToBackend } from '../services/chatService';

export default function ShareFileModal({ file, onClose, onSuccess }) {
  const { chats, loading: chatsLoading } = useChats('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChat, setSelectedChat] = useState(null);
  const [customNote, setCustomNote] = useState(`Sharing ${file?.name || 'this file'} with you.`);
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [sendError, setSendError] = useState(null);

  if (!file) return null;

  const filteredChats = (chats || []).filter(c => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (c.participant && c.participant.toLowerCase().includes(q)) ||
      (c.lastMessage && c.lastMessage.toLowerCase().includes(q)) ||
      (c.company && c.company.toLowerCase().includes(q)) ||
      (c.account && c.account.toLowerCase().includes(q))
    );
  });

  const handleSend = async () => {
    if (!selectedChat) return;
    setSending(true);
    setSendError(null);

    try {
      const fileUrl = file.webUrl && file.webUrl !== '#' ? file.webUrl : file.previewUrl;
      const fileLinkHtml = fileUrl
        ? `<p>${customNote}</p><p>📎 <strong><a href="${fileUrl}" target="_blank" rel="noopener noreferrer">${file.name}</a></strong> (${file.size || 'File'})</p>`
        : `<p>${customNote}</p><p>📎 <strong>${file.name}</strong> (${file.size || 'File'})</p>`;

      const targetChatId = selectedChat.microsoftChatId || selectedChat._id || selectedChat.id || selectedChat.chatId;
      const accountId = selectedChat.connectedAccountId || selectedChat.accountEmail || selectedChat.account || 'all';

      if (!targetChatId) {
        throw new Error('Could not determine Teams conversation ID.');
      }

      await sendMessageToBackend(targetChatId, fileLinkHtml, accountId);

      setSentSuccess(true);
      setTimeout(() => {
        if (onSuccess) onSuccess(selectedChat, file);
        if (onClose) onClose();
      }, 1500);
    } catch (err) {
      console.error('[ShareFileModal] Send failed:', err);
      setSendError(err.message || 'Failed to send file to Teams chat.');
      setSending(false);
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div 
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-tertiary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'var(--accent-light)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Send size={16} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
                Share File to Teams Chat
              </h3>
              <p style={{ fontSize: '0.78rem', margin: 0, color: 'var(--text-muted)' }}>
                Direct 1-Click Send across all connected accounts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* File Card Preview */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              backgroundColor: 'var(--accent-light)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <FileText size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {file.name}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
                <span>{file.category || 'File'}</span>
                <span>•</span>
                <span>{file.size || 'Recent'}</span>
                {file.account && (
                  <>
                    <span>•</span>
                    <span style={{ color: 'var(--accent-primary)', fontWeight: '500' }}>{file.account}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Search Chat Recipient */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Select Microsoft Teams Chat:
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)'
            }}>
              <Search size={16} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Search contact, chat, or tenant..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  width: '100%',
                  color: 'var(--text-primary)',
                  fontSize: '0.88rem'
                }}
              />
            </div>
          </div>

          {/* Chat List Picker */}
          <div style={{
            maxHeight: '180px',
            overflowY: 'auto',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-primary)'
          }}>
            {chatsLoading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <Loader2 className="spinner" size={20} style={{ margin: '0 auto 8px auto' }} />
                Loading conversations...
              </div>
            ) : filteredChats.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No matching conversations found.
              </div>
            ) : (
              filteredChats.map((c) => {
                const isSelected = selectedChat?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedChat(c)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderBottom: '1px solid var(--border-subtle)',
                      backgroundColor: isSelected ? 'var(--accent-light)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: isSelected ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                        color: isSelected ? '#fff' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        flexShrink: 0
                      }}>
                        {(c.participant || 'C')[0]}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: isSelected ? '700' : '600', color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.participant}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.company || c.account || 'Direct Message'}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <Check size={16} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Optional Message Note */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Message Note (Optional):
            </label>
            <input
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="Add a message note..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '0.88rem',
                outline: 'none'
              }}
            />
          </div>

          {sendError && (
            <div style={{ color: '#ef4444', fontSize: '0.82rem', padding: '6px 10px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px' }}>
              {sendError}
            </div>
          )}

          {sentSuccess && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              padding: '10px',
              borderRadius: '8px',
              fontSize: '0.88rem',
              fontWeight: '600'
            }}>
              <CheckCircle2 size={18} />
              <span>File sent successfully to {selectedChat?.participant}!</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '10px',
          padding: '14px 20px',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-tertiary)'
        }}>
          <button
            className="btn"
            onClick={onClose}
            disabled={sending}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.88rem',
              fontWeight: '500'
            }}
          >
            Cancel
          </button>

          <button
            className="btn btn-primary"
            onClick={handleSend}
            disabled={!selectedChat || sending || sentSuccess}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-sm)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.88rem',
              fontWeight: '600',
              cursor: (!selectedChat || sending) ? 'not-allowed' : 'pointer',
              opacity: (!selectedChat || sending) ? 0.6 : 1
            }}
          >
            {sending ? (
              <>
                <Loader2 className="spinner" size={16} />
                <span>Sending...</span>
              </>
            ) : sentSuccess ? (
              <>
                <Check size={16} />
                <span>Sent!</span>
              </>
            ) : (
              <>
                <Send size={16} />
                <span>Send to Teams Chat</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
