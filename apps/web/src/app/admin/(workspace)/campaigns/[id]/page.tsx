import { redirect } from 'next/navigation';

export default async function AdminCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/campaigns/${id}/edit`);
}

