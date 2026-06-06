export function timeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function confidenceColor(score: number): string {
  if (score >= 85) return "text-emerald";
  if (score >= 60) return "text-amber";
  return "text-red";
}

export function confidenceHex(score: number): string {
  if (score >= 85) return "var(--accent-emerald)";
  if (score >= 60) return "var(--accent-amber)";
  return "var(--accent-red)";
}
