/** "18m", "3h 28m", "2d" — compact enough for a dense server row. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '-';
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1) return '<1m';
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function formatAgo(timestamp: number | undefined, now = Date.now()): string {
  if (timestamp === undefined) return '-';
  return `${formatDuration(now - timestamp)} ago`;
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Job ids are 36-char UUIDs; the middle carries no meaning for a human scanning a list. */
export function shortJobId(jobId: string): string {
  if (jobId.length <= 12) return jobId;
  return `${jobId.slice(0, 4)}...${jobId.slice(-4)}`;
}

/**
 * The servers API reports a server-side average across the players in an instance, not
 * the viewer's own latency, so the "avg" prefix is not decoration - dropping it would
 * state something we never measured.
 */
export function formatPing(ping: number | undefined): string {
  return ping === undefined ? '-' : `avg ${Math.round(ping)}ms`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
