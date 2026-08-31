import React, { useState, useRef, useEffect } from 'react';
import {
  Smile, MoreHorizontal, MessageSquareQuote, Edit3, Forward,
  Link, Bookmark, Trash2, Pin, EyeOff, Mail, Languages, ChevronRight
} from 'lucide-react';
import EmojiPicker from './EmojiPicker';

export const TEAMS_REACTIONS = [
  { emoji: '👍', type: 'like', name: 'Like' },
  { emoji: '❤️', type: 'heart', name: 'Heart' },
  { emoji: '😂', type: 'laugh', name: 'Laugh' },
  { emoji: '😮', type: 'surprised', name: 'Surprised' },
  { emoji: '😢', type: 'sad', name: 'Sad' },
  { emoji: '👏', type: 'applause', name: 'Applause' }
];

export const getEmojiForReactionType = (type) => {
  if (!type) return '👍';
  const match = TEAMS_REACTIONS.find((r) => r.type === type.toLowerCase() || r.emoji === type);
  return match ? match.emoji : type;
};

export const getReactionTypeForEmoji = (emoji) => {
  if (!emoji) return 'like';
  const match = TEAMS_REACTIONS.find((r) => r.emoji === emoji || r.type === emoji.toLowerCase());
  return match ? match.type : emoji;
};

export default function MessageReactionsBar({
  onSelectReaction,
  activeUserReactions = [],
  isOutgoing = false,
  message = null,
  onReply = null,
  onEdit = null,
  onForward = null,
  onCopyLink = null,
  onSaveMessage = null,
  onDelete = null,
  onPin = null,
  onMarkUnread = null,
  onShareOutlook = null,
  onTranslate = null
}) {
  const [showFullPicker, setShowFullPicker] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const menuRef = useRef(null);

  // Close context menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowContextMenu(false);
      }
    };
    if (showContextMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showContextMenu]);

  const handleAction = (callback, e) => {
    if (e) e.stopPropagation();
    setShowContextMenu(false);
    if (callback) callback(message);
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: '-18px',
        right: isOutgoing ? '12px' : 'auto',
        left: isOutgoing ? 'auto' : '12px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '24px',
        padding: '3px 6px',
        display: 'flex',
        alignItems: 'center',
        gap: '3px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.16)',
        backdropFilter: 'blur(12px)',
        zIndex: 60,
        userSelect: 'none',
        animation: 'fadeInScale 0.15s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Primary 4 Reaction Buttons */}
      {TEAMS_REACTIONS.slice(0, 4).map((item) => {
        const isSelected = activeUserReactions.includes(item.type) || activeUserReactions.includes(item.emoji);
        return (
          <button
            key={item.type}
            onClick={(e) => {
              e.stopPropagation();
              onSelectReaction(item.type, item.emoji);
            }}
            title={item.name}
            style={{
              background: isSelected ? 'var(--accent-light)' : 'transparent',
              border: isSelected ? '1px solid var(--accent-primary)' : '1px solid transparent',
              borderRadius: '50%',
              width: '26px',
              height: '26px',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'transform 0.15s ease, background-color 0.15s ease',
              padding: 0
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.25)';
              e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.backgroundColor = isSelected ? 'var(--accent-light)' : 'transparent';
            }}
          >
            {item.emoji}
          </button>
        );
      })}

      {/* Extra Emoji Picker Trigger */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowContextMenu(false);
            setShowFullPicker((prev) => !prev);
          }}
          title="More reactions"
          style={{
            background: 'transparent',
            border: 'none',
            borderRadius: '50%',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            transition: 'all 0.15s ease',
            padding: 0
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--accent-primary)';
            e.currentTarget.style.transform = 'scale(1.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <Smile size={15} />
        </button>

        {showFullPicker && (
          <EmojiPicker
            position="top"
            onSelectEmoji={(emoji) => {
              const type = getReactionTypeForEmoji(emoji);
              onSelectReaction(type, emoji);
              setShowFullPicker(false);
            }}
            onClose={() => setShowFullPicker(false)}
          />
        )}
      </div>

      {/* Divider */}
      <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-color)', margin: '0 2px' }} />

      {/* Teams 3-Dots Action Menu Trigger */}
      <div style={{ position: 'relative' }} ref={menuRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowFullPicker(false);
            setShowContextMenu((prev) => !prev);
          }}
          title="More options"
          style={{
            background: showContextMenu ? 'var(--accent-light)' : 'transparent',
            border: 'none',
            borderRadius: '50%',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: showContextMenu ? 'var(--accent-primary)' : 'var(--text-muted)',
            transition: 'all 0.15s ease',
            padding: 0
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--accent-primary)';
            e.currentTarget.style.transform = 'scale(1.15)';
          }}
          onMouseLeave={(e) => {
            if (!showContextMenu) {
              e.currentTarget.style.color = 'var(--text-muted)';
              e.currentTarget.style.transform = 'scale(1)';
            }
          }}
        >
          <MoreHorizontal size={15} />
        </button>

        {/* Authenticated Teams-Style Context Menu Dropdown */}
        {showContextMenu && (
          <div
            className="teams-context-menu"
            style={{
              position: 'absolute',
              top: '28px',
              right: isOutgoing ? '0' : 'auto',
              left: isOutgoing ? 'auto' : '0',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              boxShadow: '0 8px 28px rgba(0, 0, 0, 0.22)',
              width: '215px',
              padding: '6px 0',
              zIndex: 1000,
              fontSize: '0.82rem',
              display: 'flex',
              flexDirection: 'column',
              animation: 'fadeInScale 0.12s ease-out'
            }}
          >
            {/* Quick Reactions Header inside context menu */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 12px 8px 12px',
              borderBottom: '1px solid var(--border-color)',
              marginBottom: '4px'
            }}>
              {TEAMS_REACTIONS.slice(0, 5).map((item) => (
                <button
                  key={item.type}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectReaction(item.type, item.emoji);
                    setShowContextMenu(false);
                  }}
                  title={item.name}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '2px 4px',
                    fontSize: '1.05rem',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.3)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  {item.emoji}
                </button>
              ))}
            </div>

            {/* Reply with quote */}
            <button
              className="teams-menu-item"
              onClick={(e) => handleAction(onReply, e)}
            >
              <MessageSquareQuote size={15} className="menu-icon" />
              <span className="menu-label">Reply with quote</span>
            </button>

            {/* Edit (available for outgoing messages) */}
            {isOutgoing && onEdit && (
              <button
                className="teams-menu-item"
                onClick={(e) => handleAction(onEdit, e)}
              >
                <Edit3 size={15} className="menu-icon" />
                <span className="menu-label">Edit</span>
                <span className="menu-badge">E</span>
              </button>
            )}

            {/* Forward */}
            <button
              className="teams-menu-item"
              onClick={(e) => handleAction(onForward, e)}
            >
              <Forward size={15} className="menu-icon" />
              <span className="menu-label">Forward</span>
              <ChevronRight size={13} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
            </button>

            {/* Copy link / Copy text */}
            <button
              className="teams-menu-item"
              onClick={(e) => handleAction(onCopyLink, e)}
            >
              <Link size={15} className="menu-icon" />
              <span className="menu-label">Copy link</span>
            </button>

            {/* Save this message */}
            <button
              className="teams-menu-item"
              onClick={(e) => handleAction(onSaveMessage, e)}
            >
              <Bookmark size={15} className="menu-icon" />
              <span className="menu-label">Save this message</span>
            </button>

            {/* Delete (if outgoing or allowed) */}
            {onDelete && (
              <button
                className="teams-menu-item danger"
                onClick={(e) => handleAction(onDelete, e)}
              >
                <Trash2 size={15} className="menu-icon" />
                <span className="menu-label">Delete</span>
              </button>
            )}

            {/* Pin for everyone */}
            <button
              className="teams-menu-item"
              onClick={(e) => handleAction(onPin, e)}
            >
              <Pin size={15} className="menu-icon" />
              <span className="menu-label">Pin for everyone</span>
            </button>

            <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />

            {/* Mark as unread */}
            <button
              className="teams-menu-item"
              onClick={(e) => handleAction(onMarkUnread, e)}
            >
              <EyeOff size={15} className="menu-icon" />
              <span className="menu-label">Mark as unread</span>
            </button>

            {/* Share to Outlook */}
            <button
              className="teams-menu-item"
              onClick={(e) => handleAction(onShareOutlook, e)}
            >
              <Mail size={15} className="menu-icon" />
              <span className="menu-label">Share to Outlook</span>
            </button>

            {/* Translation */}
            <button
              className="teams-menu-item"
              onClick={(e) => handleAction(onTranslate, e)}
            >
              <Languages size={15} className="menu-icon" />
              <span className="menu-label">Translation</span>
              <ChevronRight size={13} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
