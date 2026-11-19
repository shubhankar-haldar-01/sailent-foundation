import { redirect } from 'next/navigation';

export default async function AdminPreviewEntityRootPage({
  params,
}: {
  params: Promise<{ entity: string }>;
}) {
  const { entity } = await params;
  if (entity === 'campaign') {
    redirect('/admin/campaigns');
  }
  if (entity === 'program') {
    redirect('/admin/programs');
  }
  redirect('/admin');
}

