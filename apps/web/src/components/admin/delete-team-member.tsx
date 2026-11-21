'use client';

import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { Button, ConfirmationDialog, cn } from '@sailent/ui';
import { deleteTeamMember, type ActionState } from '@/lib/admin/actions';

export function DeleteTeamMemberButton({
  id,
  name,
  slug,
  variant = 'destructive',
  size = 'sm',
  label = 'Delete member',
  className,
}: {
  id: string;
  name: string;
  slug?: string;
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: React.ComponentProps<typeof Button>['size'];
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, action, pending] = React.useActionState<ActionState, FormData>(
    deleteTeamMember,
    {},
  );
  const formRef = React.useRef<HTMLFormElement>(null);

  return (
    <>
      <form ref={formRef} action={action} className="inline">
        <input type="hidden" name="id" value={id} />
        {slug ? <input type="hidden" name="slug" value={slug} /> : null}
        <Button
          type="button"
          variant={variant}
          size={size}
          onClick={() => setOpen(true)}
          disabled={pending}
          className={cn(
            variant === 'ghost'
              ? 'text-destructive hover:bg-destructive/10 hover:text-destructive'
              : undefined,
            className,
          )}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          <span>{label}</span>
        </Button>
      </form>

      <ConfirmationDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete “${name}”?`}
        description="This will permanently delete this team member profile from the database. This action is irreversible and cannot be undone."
        confirmLabel="Delete Permanently"
        variant="destructive"
        icon="danger"
        loading={pending}
        onConfirm={() => {
          formRef.current?.requestSubmit();
        }}
        error={state.error}
      />
    </>
  );
}
