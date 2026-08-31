/**
 * Notification & Sound utilities for TeamsHub
 */

let sharedAudioCtx = null;

// Initialize / unlock audio on user click
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext && !sharedAudioCtx) {
        sharedAudioCtx = new AudioContext();
      }
      if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
        sharedAudioCtx.resume();
      }
    } catch (e) {}
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
}

// Web Audio API synthesized Microsoft Teams notification chime (no external audio files required)
export const playTeamsNotificationSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = sharedAudioCtx || new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // First tone (E5 / 659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.18);

    // Second tone (A5 / 880 Hz - iconic Teams chime interval)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.09);
    gain2.gain.setValueAtTime(0.35, now + 0.09);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.09);
    osc2.stop(now + 0.45);
  } catch (err) {
    console.warn('[Sound] Failed to play notification chime:', err.message);
  }
};

// Request Browser Desktop Notification Permission
export const requestNotificationPermission = async () => {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (e) {}
    }
  }
};

// Flash browser document title
let titleFlashTimer = null;
let originalDocTitle = typeof document !== 'undefined' ? document.title : 'TeamsHub';

export const flashBrowserTabTitle = (senderName) => {
  if (typeof document === 'undefined') return;
  if (!originalDocTitle || originalDocTitle.includes('💬')) {
    originalDocTitle = 'TeamsHub';
  }

  if (titleFlashTimer) clearInterval(titleFlashTimer);

  let isAlert = true;
  const alertText = `💬 New message from ${senderName || 'Teams'}`;

  titleFlashTimer = setInterval(() => {
    document.title = isAlert ? alertText : originalDocTitle;
    isAlert = !isAlert;
  }, 1000);

  const resetOnFocus = () => {
    clearInterval(titleFlashTimer);
    document.title = originalDocTitle;
    window.removeEventListener('focus', resetOnFocus);
  };
  window.addEventListener('focus', resetOnFocus);
};

// Trigger Browser Desktop Notification
export const showDesktopNotification = (title, body, onClick) => {
  flashBrowserTabTitle(title);

  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          body: body || 'New message in Microsoft Teams',
          icon: '/favicon.ico',
          tag: `teamshub-msg-${Date.now()}`
        });

        if (onClick) {
          notif.onclick = () => {
            window.focus();
            onClick();
            notif.close();
          };
        }
      } catch (e) {
        console.warn('[Notification] Desktop notification error:', e.message);
      }
    } else if (Notification.permission === 'default') {
      requestNotificationPermission();
    }
  }
};
