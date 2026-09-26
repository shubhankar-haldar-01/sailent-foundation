import Link from 'next/link';
import { Button, EmptyState } from '@sailent/ui';

export default function AdminNotFound() {
  return (
    <EmptyState
      kind="no-content"
      title="Page not found"
      description="This admin page doesn't exist, or hasn't been built yet."
      action={
        <Button asChild variant="secondary" size="sm">
          <Link href="/admin">Back to dashboard</Link>
        </Button>
      }
    />
  );
}
