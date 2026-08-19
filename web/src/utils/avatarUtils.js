export const getInitials = (name) => {
  if (!name) return 'U';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

export const getAvatarColor = (name) => {
  if (!name) return '#6366f1'; // default indigo
  const colors = [
    '#f87171', // red
    '#fb923c', // orange
    '#fbbf24', // amber
    '#a3e635', // lime
    '#34d399', // emerald
    '#2dd4bf', // teal
    '#38bdf8', // sky
    '#818cf8', // indigo
    '#a78bfa', // violet
    '#e879f9', // fuchsia
    '#fb7185'  // rose
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};
