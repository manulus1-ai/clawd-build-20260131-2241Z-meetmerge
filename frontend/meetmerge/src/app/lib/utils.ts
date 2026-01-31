export function uid(prefix = ''): string {
  const s = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return prefix ? `${prefix}_${s}` : s;
}

export function formatLocalWithTz(iso: string): string {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return `${fmt.format(d)} (${tz})`;
}

export function toBase64Url(json: unknown): string {
  const raw = JSON.stringify(json);
  const b64 = btoa(unescape(encodeURIComponent(raw)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function fromBase64Url<T>(b64url: string): T {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '==='.slice((b64.length + 3) % 4);
  const raw = decodeURIComponent(escape(atob(padded)));
  return JSON.parse(raw) as T;
}
