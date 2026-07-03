// Single source of truth for the backend URL.
// Override locally with REACT_APP_API_URL=http://localhost:5000 in frontend/.env
export const API_URL =
  process.env.REACT_APP_API_URL || 'https://re-intel-production.up.railway.app';

// Deterministic avatar color per member name (WhatsApp-style)
const AVATAR_COLORS = [
  '#4F46E5', '#0891B2', '#059669', '#D97706',
  '#DC2626', '#7C3AED', '#DB2777', '#2563EB',
];

export function avatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// Label for a channel: DMs show the other participant's name
export function channelLabel(channel, displayName) {
  if (channel.type === 'dm') {
    return channel.dmParticipants.find((p) => p !== displayName) || channel.name;
  }
  return channel.name;
}
