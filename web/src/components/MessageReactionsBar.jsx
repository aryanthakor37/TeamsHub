import React, { useState } from 'react';
import { Smile } from 'lucide-react';
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
  isOutgoing = false
}) {
  const [showFullPicker, setShowFullPicker] = useState(false);

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
        padding: '3px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.16)',
        backdropFilter: 'blur(12px)',
        zIndex: 50,
        userSelect: 'none',
        animation: 'fadeInScale 0.15s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {TEAMS_REACTIONS.map((item) => {
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
              width: '28px',
              height: '28px',
              fontSize: '1.05rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'transform 0.15s ease, background-color 0.15s ease',
              padding: 0
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.3)';
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
            setShowFullPicker((prev) => !prev);
          }}
          title="More reactions"
          style={{
            background: 'transparent',
            border: 'none',
            borderRadius: '50%',
            width: '26px',
            height: '26px',
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
            e.currentTarget.style.transform = 'scale(1.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <Smile size={16} />
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
    </div>
  );
}
