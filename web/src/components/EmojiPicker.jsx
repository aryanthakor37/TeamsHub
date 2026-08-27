import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Clock, Smile, Hand, Heart, Briefcase, CheckCircle, X } from 'lucide-react';

const EMOJI_CATEGORIES = [
  {
    id: 'recent',
    name: 'Recent',
    icon: Clock,
    emojis: [] // Populated dynamically from localStorage
  },
  {
    id: 'smileys',
    name: 'Smileys & People',
    icon: Smile,
    emojis: [
      { char: '😀', keywords: ['grinning', 'happy', 'smile'] },
      { char: '😃', keywords: ['happy', 'smiley'] },
      { char: '😄', keywords: ['laugh', 'happy', 'smile'] },
      { char: '😁', keywords: ['beam', 'grin', 'teeth'] },
      { char: '😆', keywords: ['laughing', 'lol', 'haha'] },
      { char: '😅', keywords: ['sweat', 'smile', 'relief'] },
      { char: '🤣', keywords: ['rofl', 'rolling', 'laughing'] },
      { char: '😂', keywords: ['tears', 'joy', 'lol', 'crying', 'haha'] },
      { char: '🙂', keywords: ['slightly', 'smile'] },
      { char: '🙃', keywords: ['upside', 'down', 'sarcasm'] },
      { char: '😉', keywords: ['wink', 'flirt'] },
      { char: '😊', keywords: ['blush', 'proud', 'happy'] },
      { char: '😇', keywords: ['angel', 'innocent'] },
      { char: '🥰', keywords: ['hearts', 'love', 'adore'] },
      { char: '😍', keywords: ['heart', 'eyes', 'love'] },
      { char: '🤩', keywords: ['star', 'eyes', 'excited'] },
      { char: '😘', keywords: ['kiss', 'love'] },
      { char: '😋', keywords: ['yummy', 'delicious', 'tongue'] },
      { char: '😜', keywords: ['wink', 'tongue', 'playful'] },
      { char: '🤪', keywords: ['zany', 'crazy', 'goofy'] },
      { char: '🤑', keywords: ['money', 'rich', 'dollar'] },
      { char: '🤗', keywords: ['hug', 'hands', 'open'] },
      { char: '🤭', keywords: ['gasp', 'secret', 'giggle'] },
      { char: '🤫', keywords: ['shh', 'quiet', 'secret'] },
      { char: '🤔', keywords: ['thinking', 'curious', 'ponder'] },
      { char: '🤐', keywords: ['zipper', 'silent'] },
      { char: '🤨', keywords: ['eyebrow', 'suspicious'] },
      { char: '😐', keywords: ['neutral', 'blank'] },
      { char: '😑', keywords: ['expressionless', 'unimpressed'] },
      { char: '😶', keywords: ['no', 'mouth', 'silent'] },
      { char: '🙄', keywords: ['eyeroll', 'whatever'] },
      { char: '😏', keywords: ['smirk', 'cool'] },
      { char: '😒', keywords: ['unamused', 'bored'] },
      { char: '😔', keywords: ['pensive', 'sad'] },
      { char: '😴', keywords: ['sleep', 'tired', 'zzz'] },
      { char: '😷', keywords: ['mask', 'sick', 'health'] },
      { char: '🤒', keywords: ['thermometer', 'sick', 'fever'] },
      { char: '🤕', keywords: ['bandage', 'hurt', 'injury'] },
      { char: '🥵', keywords: ['hot', 'sweat', 'summer'] },
      { char: '🥶', keywords: ['cold', 'freeze', 'winter'] },
      { char: '🥴', keywords: ['woozy', 'drunk', 'dizzy'] },
      { char: '😵', keywords: ['dizzy', 'fainted'] },
      { char: '🤯', keywords: ['mind', 'blown', 'shocked', 'explosion'] },
      { char: '🥳', keywords: ['party', 'celebrate', 'hat'] },
      { char: '😎', keywords: ['cool', 'sunglasses', 'awesome'] },
      { char: '🤓', keywords: ['nerd', 'geek', 'glasses'] },
      { char: '🧐', keywords: ['monocle', 'inspect'] },
      { char: '😮', keywords: ['surprised', 'wow', 'open'] },
      { char: '🥺', keywords: ['pleading', 'puppy', 'eyes'] },
      { char: '😢', keywords: ['cry', 'tear', 'sad'] },
      { char: '😭', keywords: ['sob', 'crying', 'loud'] },
      { char: '😱', keywords: ['scream', 'fear', 'shocked'] },
      { char: '😤', keywords: ['triumph', 'proud', 'determined'] },
      { char: '😡', keywords: ['angry', 'rage', 'mad'] },
      { char: '🤬', keywords: ['cursing', 'swearing', 'mad'] },
      { char: '😈', keywords: ['devil', 'evil', 'smile'] },
      { char: '💀', keywords: ['skull', 'dead', 'deadly'] },
      { char: '💩', keywords: ['poop', 'funny'] },
      { char: '🤡', keywords: ['clown', 'joke'] },
      { char: '👻', keywords: ['ghost', 'halloween', 'spooky'] },
      { char: '🤖', keywords: ['robot', 'bot', 'ai'] }
    ]
  },
  {
    id: 'gestures',
    name: 'Gestures & Hands',
    icon: Hand,
    emojis: [
      { char: '👍', keywords: ['thumbsup', 'like', 'approve', 'yes', 'ok', 'good'] },
      { char: '👎', keywords: ['thumbsdown', 'dislike', 'no'] },
      { char: '👏', keywords: ['applause', 'clap', 'bravo', 'congrats'] },
      { char: '🙌', keywords: ['raising', 'hands', 'hooray', 'celebrate'] },
      { char: '👐', keywords: ['open', 'hands'] },
      { char: '🤝', keywords: ['handshake', 'deal', 'agree', 'partner'] },
      { char: '🙏', keywords: ['pray', 'please', 'thanks', 'namaste', 'thankyou'] },
      { char: '✌️', keywords: ['peace', 'victory', 'two'] },
      { char: '🤞', keywords: ['crossed', 'fingers', 'luck', 'hope'] },
      { char: '🫰', keywords: ['hand', 'heart', 'kpop'] },
      { char: '🤟', keywords: ['love', 'you', 'gesture'] },
      { char: '🤘', keywords: ['rock', 'horns'] },
      { char: '🤙', keywords: ['call', 'shaka'] },
      { char: '👈', keywords: ['point', 'left'] },
      { char: '👉', keywords: ['point', 'right'] },
      { char: '👆', keywords: ['point', 'up'] },
      { char: '👇', keywords: ['point', 'down'] },
      { char: '☝️', keywords: ['index', 'point', 'one'] },
      { char: '👋', keywords: ['wave', 'hello', 'bye', 'hi'] },
      { char: '✋', keywords: ['high', 'five', 'stop', 'hand'] },
      { char: '👌', keywords: ['ok', 'perfect', 'fine', 'good'] },
      { char: '🤌', keywords: ['pinched', 'fingers', 'italian'] },
      { char: '🤏', keywords: ['pinching', 'small', 'little'] },
      { char: '✊', keywords: ['fist', 'power'] },
      { char: '👊', keywords: ['fist', 'bump', 'punch'] },
      { char: '🤛', keywords: ['left', 'fist'] },
      { char: '🤜', keywords: ['right', 'fist'] },
      { char: '💪', keywords: ['muscle', 'strong', 'flex', 'power', 'gym'] },
      { char: '✍️', keywords: ['writing', 'pen', 'note'] }
    ]
  },
  {
    id: 'hearts',
    name: 'Hearts & Emotions',
    icon: Heart,
    emojis: [
      { char: '❤️', keywords: ['heart', 'love', 'red'] },
      { char: '🧡', keywords: ['orange', 'heart'] },
      { char: '💛', keywords: ['yellow', 'heart'] },
      { char: '💚', keywords: ['green', 'heart'] },
      { char: '💙', keywords: ['blue', 'heart'] },
      { char: '💜', keywords: ['purple', 'heart'] },
      { char: '🖤', keywords: ['black', 'heart'] },
      { char: '🤍', keywords: ['white', 'heart'] },
      { char: '🤎', keywords: ['brown', 'heart'] },
      { char: '💔', keywords: ['broken', 'heart', 'sad'] },
      { char: '❣️', keywords: ['heart', 'exclamation'] },
      { char: '💕', keywords: ['two', 'hearts', 'love'] },
      { char: '💞', keywords: ['revolving', 'hearts'] },
      { char: '💓', keywords: ['beating', 'heart'] },
      { char: '💗', keywords: ['growing', 'heart'] },
      { char: '💖', keywords: ['sparkle', 'heart'] },
      { char: '💘', keywords: ['cupid', 'arrow'] },
      { char: '💝', keywords: ['ribbon', 'gift', 'heart'] },
      { char: '🔥', keywords: ['fire', 'flame', 'lit', 'hot', 'trending'] },
      { char: '✨', keywords: ['sparkles', 'stars', 'magic', 'clean', 'new'] },
      { char: '⭐', keywords: ['star', 'favorite'] },
      { char: '🌟', keywords: ['glowing', 'star', 'awesome'] },
      { char: '💥', keywords: ['boom', 'collision', 'explosion'] },
      { char: '💯', keywords: ['hundred', 'score', 'perfect', '100'] }
    ]
  },
  {
    id: 'work',
    name: 'Work & Objects',
    icon: Briefcase,
    emojis: [
      { char: '💻', keywords: ['laptop', 'computer', 'code', 'tech', 'work'] },
      { char: '📱', keywords: ['phone', 'mobile', 'cell'] },
      { char: '💼', keywords: ['briefcase', 'work', 'job', 'business'] },
      { char: '📁', keywords: ['folder', 'file'] },
      { char: '📂', keywords: ['open', 'folder'] },
      { char: '📄', keywords: ['page', 'document', 'file', 'paper'] },
      { char: '📊', keywords: ['bar', 'chart', 'analytics', 'stats'] },
      { char: '📈', keywords: ['chart', 'up', 'growth', 'trending'] },
      { char: '📉', keywords: ['chart', 'down', 'decrease'] },
      { char: '📌', keywords: ['pin', 'pushpin', 'note'] },
      { char: '📍', keywords: ['round', 'pin', 'location'] },
      { char: '📎', keywords: ['paperclip', 'attachment', 'clip'] },
      { char: '💡', keywords: ['lightbulb', 'idea', 'innovate', 'smart'] },
      { char: '🚀', keywords: ['rocket', 'launch', 'fast', 'deploy', 'ship'] },
      { char: '🎯', keywords: ['target', 'goal', 'bullseye', 'accuracy'] },
      { char: '🏆', keywords: ['trophy', 'winner', 'prize', 'first'] },
      { char: '🥇', keywords: ['gold', 'medal', 'first'] },
      { char: '🛠️', keywords: ['tools', 'hammer', 'wrench', 'fix', 'build'] },
      { char: '⚙️', keywords: ['gear', 'settings', 'config'] },
      { char: '🔒', keywords: ['lock', 'security', 'secure', 'private'] },
      { char: '🔑', keywords: ['key', 'password', 'access'] },
      { char: '✉️', keywords: ['envelope', 'mail', 'email'] },
      { char: '📦', keywords: ['package', 'box', 'delivery', 'ship'] },
      { char: '📅', keywords: ['calendar', 'date', 'schedule'] },
      { char: '⏰', keywords: ['alarm', 'clock', 'time', 'reminder'] },
      { char: '☕', keywords: ['coffee', 'tea', 'drink', 'morning', 'break'] },
      { char: '🍕', keywords: ['pizza', 'food', 'snack'] },
      { char: '🎉', keywords: ['party', 'popper', 'tada', 'celebrate', 'congrats'] },
      { char: '🎊', keywords: ['confetti', 'ball', 'celebration'] },
      { char: '🎁', keywords: ['gift', 'present', 'reward'] }
    ]
  },
  {
    id: 'symbols',
    name: 'Symbols & Status',
    icon: CheckCircle,
    emojis: [
      { char: '✅', keywords: ['check', 'done', 'approved', 'pass', 'success'] },
      { char: '❌', keywords: ['cross', 'x', 'cancel', 'failed', 'no'] },
      { char: '⭕', keywords: ['circle', 'o'] },
      { char: '❗', keywords: ['exclamation', 'alert', 'important', 'warning'] },
      { char: '❓', keywords: ['question', 'help', 'why'] },
      { char: '⚡', keywords: ['zap', 'lightning', 'fast', 'instant', 'power'] },
      { char: '⚠️', keywords: ['warning', 'caution', 'alert'] },
      { char: '🚫', keywords: ['forbidden', 'no', 'blocked'] },
      { char: '🔄', keywords: ['refresh', 'sync', 'loop', 'reload'] },
      { char: '💬', keywords: ['speech', 'bubble', 'chat', 'message'] },
      { char: '💭', keywords: ['thought', 'bubble', 'think'] },
      { char: '📢', keywords: ['loudspeaker', 'announcement', 'broadcast'] },
      { char: '🔔', keywords: ['bell', 'notification', 'alert'] },
      { char: '🛡️', keywords: ['shield', 'protect', 'security'] },
      { char: '🌐', keywords: ['globe', 'web', 'internet', 'world'] },
      { char: '🏁', keywords: ['chequered', 'flag', 'finish', 'complete'] },
      { char: '🚩', keywords: ['red', 'flag', 'report', 'issue'] }
    ]
  }
];

export default function EmojiPicker({ onSelectEmoji, onClose, position = 'bottom' }) {
  const [activeCategory, setActiveCategory] = useState('smileys');
  const [searchQuery, setSearchQuery] = useState('');
  const [recentEmojis, setRecentEmojis] = useState(() => {
    try {
      const stored = localStorage.getItem('teamshub_recent_emojis');
      return stored ? JSON.parse(stored) : ['👍', '❤️', '😂', '🔥', '🎉', '✅', '🚀', '👏'];
    } catch (e) {
      return ['👍', '❤️', '😂', '🔥', '🎉', '✅', '🚀', '👏'];
    }
  });

  const pickerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Focus search on open
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Click outside listener to close picker
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Handle emoji selection & save to recent
  const handleEmojiClick = (emojiChar) => {
    // Add to recent emojis
    setRecentEmojis((prev) => {
      const filtered = prev.filter((e) => e !== emojiChar);
      const updated = [emojiChar, ...filtered].slice(0, 18);
      try {
        localStorage.setItem('teamshub_recent_emojis', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    onSelectEmoji(emojiChar);
  };

  // Filter emojis based on search query
  const filteredEmojis = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase().trim();
    const matches = [];

    EMOJI_CATEGORIES.forEach((cat) => {
      cat.emojis.forEach((emoji) => {
        if (
          emoji.char.includes(query) ||
          emoji.keywords.some((k) => k.includes(query))
        ) {
          if (!matches.some((m) => m.char === emoji.char)) {
            matches.push(emoji);
          }
        }
      });
    });

    return matches;
  }, [searchQuery]);

  return (
    <div
      ref={pickerRef}
      style={{
        position: 'absolute',
        bottom: position === 'top' ? 'auto' : '68px',
        top: position === 'top' ? '48px' : 'auto',
        right: '16px',
        width: '320px',
        maxHeight: '380px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        boxShadow: '0 16px 36px rgba(0, 0, 0, 0.22), 0 0 1px rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(16px)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'fadeInSlideUp 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* Search Header */}
      <div
        style={{
          padding: '12px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: 'var(--bg-primary)'
        }}
      >
        <Search size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search emojis (e.g. fire, party, like)..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
            outline: 'none',
            padding: '2px 0'
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              padding: '2px'
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Category Tabs (shown when not actively searching) */}
      {!searchQuery && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 10px',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)'
          }}
        >
          {recentEmojis.length > 0 && (
            <button
              onClick={() => setActiveCategory('recent')}
              title="Recently Used"
              style={{
                background: activeCategory === 'recent' ? 'var(--accent-light)' : 'transparent',
                color: activeCategory === 'recent' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
            >
              <Clock size={16} />
            </button>
          )}

          {EMOJI_CATEGORIES.filter((c) => c.id !== 'recent').map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                title={cat.name}
                style={{
                  background: isActive ? 'var(--accent-light)' : 'transparent',
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={16} />
              </button>
            );
          })}
        </div>
      )}

      {/* Emoji Grid Container */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px 12px',
          maxHeight: '260px'
        }}
      >
        {/* Search Results Mode */}
        {filteredEmojis ? (
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: '600',
                color: 'var(--text-muted)',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              Search Results ({filteredEmojis.length})
            </div>
            {filteredEmojis.length === 0 ? (
              <div
                style={{
                  padding: '24px 0',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem'
                }}
              >
                No emojis found matching "{searchQuery}"
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: '4px'
                }}
              >
                {filteredEmojis.map((emoji, index) => (
                  <button
                    key={`${emoji.char}-${index}`}
                    onClick={() => handleEmojiClick(emoji.char)}
                    title={emoji.keywords?.join(', ')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '1.35rem',
                      padding: '6px 0',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'transform 0.12s ease, background-color 0.12s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                      e.currentTarget.style.transform = 'scale(1.22)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    {emoji.char}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : activeCategory === 'recent' ? (
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: '600',
                color: 'var(--text-muted)',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              Frequently Used
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '4px'
              }}
            >
              {recentEmojis.map((emojiChar, index) => (
                <button
                  key={`${emojiChar}-${index}`}
                  onClick={() => handleEmojiClick(emojiChar)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '1.35rem',
                    padding: '6px 0',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'transform 0.12s ease, background-color 0.12s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                    e.currentTarget.style.transform = 'scale(1.22)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {emojiChar}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            {EMOJI_CATEGORIES.filter((c) => c.id === activeCategory).map((cat) => (
              <div key={cat.id}>
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: 'var(--text-muted)',
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  {cat.name}
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: '4px'
                  }}
                >
                  {cat.emojis.map((emoji, index) => (
                    <button
                      key={`${emoji.char}-${index}`}
                      onClick={() => handleEmojiClick(emoji.char)}
                      title={emoji.keywords?.join(', ')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '1.35rem',
                        padding: '6px 0',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'transform 0.12s ease, background-color 0.12s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                        e.currentTarget.style.transform = 'scale(1.22)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      {emoji.char}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
