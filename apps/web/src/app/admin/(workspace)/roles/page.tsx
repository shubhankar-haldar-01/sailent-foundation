import { listRoles, getRole, type AdminRoleDetail } from '@/lib/admin/api';

export const dynamic = 'force-dynamic';

/**
 * Roles and permissions — READ ONLY.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THERE IS ONE ROLE, AND THIS SCREEN EXISTS TO SAY SO CLEARLY.
 *
 * The obvious build here is a role editor: create a role, tick permissions,
 * save. It is not built, deliberately. The API exposes reads only —
 * `GET /admin/roles`, `GET /admin/roles/:key`, `GET /admin/permissions` — and
 * there is no write route to call. Adding one would be redesigning RBAC, which
 * this phase explicitly is not.
 *
 * What the screen is genuinely for: seeing what SUPER_ADMIN can actually do.
 * Ninety-four permissions is more than anybody holds in their head, and "which
 * permission governs this button" is a real question with an answer that
 * currently lives only in a database table.
 *
 * Permissions marked sensitive additionally require a re-authentication within
 * the last five minutes, which is why they are called out rather than listed
 * flat.
 * ══════════════════════════════════════════════════════════════════════════
 */
export default async function AdminRolesPage() {
  const roles = await listRoles();

  const details = await Promise.all(roles.map((role) => getRole(role.key).catch(() => null)));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-h1 font-bold tracking-tight">Roles and permissions</h1>
        <p className="text-body-sm text-muted-foreground mt-1">
          Read-only. Guards check <strong>permissions</strong>, never role names, so what a screen
          allows is decided by this list rather than by who you are.
        </p>
      </header>

      {roles.length === 0 ? (
        <p className="border-border text-body text-muted-foreground rounded-lg border border-dashed p-10 text-center">
          No roles are defined. Seed reference data with <code>pnpm db:seed --reference</code>.
        </p>
      ) : null}

      {details
        .filter((detail): detail is AdminRoleDetail => detail !== null)
        .map((role) => (
          <section key={role.key} className="space-y-4">
            <div className="border-border rounded-lg border p-5">
              <h2 className="text-h3 font-semibold">{role.key}</h2>
              {role.description ? (
                <p className="text-body-sm text-muted-foreground mt-1">{role.description}</p>
              ) : null}
              <p className="text-body-sm text-muted-foreground mt-3">
                {role.permissions.length} permissions
                {typeof role.userCount === 'number' ? ` · ${role.userCount} account(s)` : ''}
              </p>
            </div>

            <PermissionTable permissions={role.permissions} />
          </section>
        ))}
    </div>
  );
}

function PermissionTable({
  permissions,
}: {
  permissions: { key: string; description?: string | null; isSensitive?: boolean }[];
}) {
  // Grouped by resource, because a flat list of ninety-four strings is a wall.
  const byResource = new Map<string, typeof permissions>();
  for (const permission of permissions) {
    const resource = permission.key.split('.')[0] ?? 'other';
    byResource.set(resource, [...(byResource.get(resource) ?? []), permission]);
  }

  return (
    <div className="border-border overflow-x-auto rounded-lg border">
      <table className="text-body-sm w-full">
        <caption className="sr-only">Permissions granted by this role, grouped by resource</caption>
        <thead className="bg-surface-sunken text-caption text-muted-foreground uppercase">
          <tr>
            <th scope="col" className="px-4 py-3 text-left font-semibold">
              Permission
            </th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">
              What it allows
            </th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">
              Re-auth
            </th>
          </tr>
        </thead>
        <tbody>
          {[...byResource.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .flatMap(([resource, group]) => [
              <tr
                key={`${resource}-header`}
                className="border-border bg-surface-sunken/50 border-t"
              >
                <th
                  scope="colgroup"
                  colSpan={3}
                  className="text-caption text-muted-foreground px-4 py-2 text-left font-semibold uppercase"
                >
                  {resource.replace(/_/g, ' ')}
                </th>
              </tr>,
              ...group.map((permission) => (
                <tr key={permission.key} className="border-border border-t">
                  <td className="px-4 py-3 font-mono text-xs">{permission.key}</td>
                  <td className="text-muted-foreground px-4 py-3">
                    {permission.description ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {permission.isSensitive ? (
                      <span className="text-warning font-medium">Required</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              )),
            ])}
        </tbody>
      </table>
    </div>
  );
}
