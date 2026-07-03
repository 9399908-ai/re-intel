// Single source of truth for the backend URL.
// Override locally with REACT_APP_API_URL=http://localhost:5000 in frontend/.env
export const API_URL =
  process.env.REACT_APP_API_URL || 'https://re-intel-production.up.railway.app';

// Display name for chat until real auth lands — persisted per browser so two
// windows show as different members.
export function getDisplayName() {
  let name = localStorage.getItem('reintel_display_name');
  if (!name) {
    name = `Guest-${Math.floor(1000 + Math.random() * 9000)}`;
    localStorage.setItem('reintel_display_name', name);
  }
  return name;
}
