import React, { useState, useRef, useEffect } from 'react';
import {
  Smile, MoreHorizontal, MessageSquareQuote, Edit3,
  Copy, Trash2, Pin, Languages
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
  isTranslated = false,
  onReply = null,
  onEdit = null,
  onCopyText = null,
  onDelete = null,
  onPin = null,
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
        top: '-20px',
        right: isOutgoing ? '8px' : 'auto',
        left: isOutgoing ? 'auto' : '8px',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '24px',
        padding: '2px 6px',
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.18)',
        backdropFilter: 'blur(16px)',
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
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
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
      <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--border-color)', margin: '0 2px' }} />

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

        {/* Clean Essential Context Menu (No double reactions) */}
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
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.22)',
              width: '185px',
              padding: '4px 0',
              zIndex: 1000,
              fontSize: '0.82rem',
              display: 'flex',
              flexDirection: 'column',
              animation: 'fadeInScale 0.12s ease-out'
            }}
          >
            {/* Reply with quote */}
            {onReply && (
              <button
                className="teams-menu-item"
                onClick={(e) => handleAction(onReply, e)}
              >
                <MessageSquareQuote size={15} className="menu-icon" />
                <span className="menu-label">Reply with quote</span>
              </button>
            )}

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

            {/* Real Live Translation */}
            {onTranslate && (
              <button
                className="teams-menu-item"
                onClick={(e) => handleAction(onTranslate, e)}
              >
                <Languages size={15} className="menu-icon" style={{ color: isTranslated ? 'var(--accent-primary)' : 'inherit' }} />
                <span className="menu-label">{isTranslated ? 'See original' : 'Translate'}</span>
              </button>
            )}

            {/* Copy text */}
            {onCopyText && (
              <button
                className="teams-menu-item"
                onClick={(e) => handleAction(onCopyText, e)}
              >
                <Copy size={15} className="menu-icon" />
                <span className="menu-label">Copy text</span>
              </button>
            )}

            {/* Pin for everyone */}
            {onPin && (
              <button
                className="teams-menu-item"
                onClick={(e) => handleAction(onPin, e)}
              >
                <Pin size={15} className="menu-icon" />
                <span className="menu-label">Pin</span>
              </button>
            )}

            {/* Delete (if outgoing or allowed) */}
            {onDelete && (
              <>
                <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '3px 0' }} />
                <button
                  className="teams-menu-item danger"
                  onClick={(e) => handleAction(onDelete, e)}
                >
                  <Trash2 size={15} className="menu-icon" />
                  <span className="menu-label">Delete</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
