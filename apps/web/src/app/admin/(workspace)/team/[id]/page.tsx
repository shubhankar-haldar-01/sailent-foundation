import { redirect } from 'next/navigation';

export default async function AdminTeamMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/team/${id}/edit`);
}

