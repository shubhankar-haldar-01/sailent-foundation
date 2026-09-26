import { LoadingState } from '@sailent/ui';

export default function Loading() {
  return (
    <div className="container-page flex min-h-[50vh] items-center justify-center">
      <LoadingState label="Loading page" />
    </div>
  );
}
