import { DashboardNav } from './dashboard-nav';
import { DonorAvatar } from './donor-avatar';
import { Panel } from './panel';
import { SignOutButton } from './sign-out-button';

/**
 * The account sidebar (design, 2026-10-08): one white panel with the donor's
 * avatar, name and address, the navigation, a rule and Logout. (The
 * "Together we create brighter futures." card under it was removed at the
 * owner's request, 2026-10-15, here and in the phone menu.)
 *
 * ON A PHONE IT IS A STRIP, NOT A SIDEBAR: the identity row and a sideways-
 * scrolling navigation at the top of the page, and Logout at the foot of the
 * page (the layout places it), so the content comes first.
 */
export function DashboardSidebar({
  name,
  email,
  avatarUrl,
}: {
  name: string;
  email: string | null;
  avatarUrl?: string | null;
}) {
  return (
    <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start print:hidden">
      <Panel className="min-w-0 p-3 lg:p-4 xl:p-3">
        <div className="flex items-center gap-3 px-2 py-1.5 lg:py-2 xl:py-1.5">
          <DonorAvatar
            name={name}
            src={avatarUrl}
            className="size-12 text-[0.9375rem] lg:size-14 lg:text-base xl:size-12 xl:text-[0.9375rem]"
          />
          <div className="min-w-0">
            <p className="font-display text-foreground truncate text-[1.0625rem] font-bold">
              {name || 'Your account'}
            </p>
            {email ? (
              <p className="text-caption text-muted-foreground truncate" title={email}>
                {email}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-3 lg:mt-4 xl:mt-2.5">
          <DashboardNav />
        </div>

        <div className="border-border mt-3 hidden border-t pt-3 lg:block xl:mt-2 xl:pt-2">
          <SignOutButton />
        </div>
      </Panel>
    </aside>
  );
}
