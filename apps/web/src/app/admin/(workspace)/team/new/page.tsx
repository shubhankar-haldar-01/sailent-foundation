import { TeamForm } from '@/components/admin/team-form';

export const dynamic = 'force-dynamic';

export default function NewTeamMemberPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-h1 font-bold tracking-tight">Add someone to the team</h1>
        <p className="text-body-sm text-muted-foreground mt-1">
          Saved as a draft and not public. Publish it once the biography reads the way the person
          would want it to.
        </p>
      </header>
      <TeamForm />
    </div>
  );
}
