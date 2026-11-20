'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmationDialog } from '@sailent/ui';

/**
 * Warns before unsaved edits are lost (2026-11-19, docs/ui-feedback.md).
 *
 *   const guard = useUnsavedChangesGuard(isDirty);
 *   return <form …>{…}{guard.dialog}</form>;
 *
 * Two ways out are covered:
 *   - closing or reloading the tab: the browser's own "Leave site?" prompt;
 *   - following a link inside the site: our dialog, "Leave without saving?",
 *     and the link is followed only if they choose to leave.
 *
 * NOT covered: the browser's Back button inside the site. The App Router has
 * no way to hold a back navigation, and faking one by rewriting history
 * breaks Back for everyone. Long forms should save drafts where that matters.
 *
 * Set `dirty` back to false once the save succeeds, or the guard will ask
 * about changes that are already saved.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);
  const leaving = React.useRef(false);

  React.useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (leaving.current) return;
      event.preventDefault();
      // Chrome still needs a value; the text itself is never shown.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  React.useEffect(() => {
    if (!dirty) return;
    /*
      Captured on the document, before React's own handlers: stopping it here
      keeps Next's <Link> from navigating while we ask.
    */
    const onClick = (event: MouseEvent) => {
      if (leaving.current || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Only a fragment changes: not leaving the page.
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(`${url.pathname}${url.search}${url.hash}`);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [dirty]);

  const dialog = (
    <ConfirmationDialog
      open={pendingHref !== null}
      onOpenChange={(open) => {
        if (!open) setPendingHref(null);
      }}
      title="Leave without saving?"
      description="Your changes on this page haven’t been saved. If you leave now, they’ll be lost."
      confirmLabel="Leave page"
      cancelLabel="Keep editing"
      variant="destructive"
      onConfirm={() => {
        const href = pendingHref;
        setPendingHref(null);
        if (!href) return;
        leaving.current = true;
        router.push(href);
      }}
    />
  );

  return { dialog };
}

/**
 * The guard for an editor form whose fields are its own (uncontrolled): any
 * edit inside the form marks it dirty, and a successful save clears it.
 *
 *   const guard = useEditorGuard(state);
 *   <form action={action} onChange={guard.markDirty}>…{guard.dialog}</form>
 *
 * `onChange` on the form hears every field's edits as they bubble. Controls
 * that set a hidden input from script (a picker, a toggle) do not fire it; a
 * form that leans on those can call `markDirty` from their handlers too.
 */
export function useEditorGuard(result: { ok?: boolean; error?: string }) {
  const [dirty, setDirty] = React.useState(false);
  React.useEffect(() => {
    if (result.ok && !result.error) setDirty(false);
  }, [result]);
  const { dialog } = useUnsavedChangesGuard(dirty);
  const markDirty = React.useCallback(() => setDirty(true), []);
  return { markDirty, dialog, dirty };
}
