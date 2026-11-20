'use client';

import * as React from 'react';
import { CheckCircle2, WifiOff } from 'lucide-react';

import { cn } from '../lib/cn';

/**
 * Says so when the connection drops, and when it comes back (2026-11-19,
 * docs/ui-feedback.md). Mounted once, at the top of the app.
 *
 * Nothing to dismiss: it goes away by itself when the connection returns,
 * after a short "Back online".
 */
function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

export function OfflineBanner({
  className,
  preview,
}: {
  className?: string;
  /** Shows a state regardless of the connection, in place (for the /dev/ui-states page). */
  preview?: 'offline' | 'online';
}) {
  const online = React.useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  const [showBack, setShowBack] = React.useState(false);
  const wasOffline = React.useRef(false);

  React.useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      setShowBack(false);
      return;
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    setShowBack(true);
    const timer = setTimeout(() => setShowBack(false), 3000);
    return () => clearTimeout(timer);
  }, [online]);

  if (preview)
    return <BannerBody online={preview === 'online'} className={cn('static', className)} />;
  if (online && !showBack) return null;
  return <BannerBody online={online} className={className} />;
}

function BannerBody({ online, className }: { online: boolean; className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        'z-(--z-banner) fixed inset-x-0 top-0 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium',
        online ? 'bg-success text-white' : 'bg-foreground text-background',
        className,
      )}
    >
      {online ? (
        <>
          <CheckCircle2 className="size-4" aria-hidden="true" /> Back online
        </>
      ) : (
        <>
          <WifiOff className="size-4" aria-hidden="true" /> You’re offline. We’ll reconnect
          automatically.
        </>
      )}
    </div>
  );
}
