export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

// Compact relative-time formatter: "5s ago", "10m ago", "12h ago", "5d ago".
// For anything older than a week, falls back to a locale date string.
export function formatRelativeAgo(ts: number, now: number = Date.now()): string {
  const diffMs = now - ts;
  if (diffMs < 0) return 'just now';
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}
