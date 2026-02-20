/**
 * Lightweight push notifications via ntfy.sh.
 * Fire-and-forget — errors are caught silently so callers are never blocked.
 */

const DEFAULT_TOPIC = 'pws-events';

function getTopic(): string {
  return (typeof process !== 'undefined' && process.env?.NTFY_TOPIC) || DEFAULT_TOPIC;
}

export function getNtfyTopic(): string {
  return getTopic();
}

export interface NotifyOptions {
  priority?: 1 | 2 | 3 | 4 | 5;
  tags?: string[];
}

export function sendNotification(
  title: string,
  message: string,
  opts?: NotifyOptions,
): void {
  const topic = getTopic();
  const headers: Record<string, string> = {
    'X-Title': title,
  };
  if (opts?.priority) headers['X-Priority'] = String(opts.priority);
  if (opts?.tags?.length) headers['X-Tags'] = opts.tags.join(',');

  fetch(`https://ntfy.sh/${topic}`, {
    method: 'POST',
    body: message,
    headers,
  }).catch(() => {
    // Silently swallow — notifications must never break the main flow.
  });
}
