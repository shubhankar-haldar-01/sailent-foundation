import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  PageHeader,
  Badge,
} from '@sailent/ui';
import { ShieldCheck, Lock, AlertCircle } from 'lucide-react';

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
      <PageHeader
        title="Roles and permissions"
        description="Guards check explicit permissions, never role names. What any screen or action allows is governed by this verified capability matrix."
      />

      {roles.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <AlertCircle className="text-muted-foreground/40 mb-3 h-10 w-10" />
            <p className="text-foreground text-sm font-medium">No roles are defined</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Seed reference data with <code>pnpm db:seed --reference</code>.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {details
        .filter((detail): detail is AdminRoleDetail => detail !== null)
        .map((role) => (
          <section key={role.key} className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="text-primary h-5 w-5" />
                    <CardTitle className="text-lg font-bold">{role.key}</CardTitle>
                    <Badge variant="accent" className="font-mono text-xs">
                      {role.permissions.length} permissions
                    </Badge>
                  </div>
                  {role.description ? (
                    <CardDescription className="mt-1.5">{role.description}</CardDescription>
                  ) : null}
                </div>
                {typeof role.userCount === 'number' ? (
                  <Badge variant="neutral">
                    {role.userCount} {role.userCount === 1 ? 'account' : 'accounts'}
                  </Badge>
                ) : null}
              </CardHeader>
            </Card>

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
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Permissions granted by this role, grouped by resource
          </caption>
          <thead className="border-border bg-muted/40 text-muted-foreground border-b text-xs font-semibold uppercase tracking-wider">
            <tr>
              <th scope="col" className="px-5 py-3.5">
                Permission Key
              </th>
              <th scope="col" className="px-5 py-3.5">
                Allowed Operations
              </th>
              <th scope="col" className="px-5 py-3.5">
                Re-Authentication
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {[...byResource.entries()]
              .sort(([a], [b]) => a.localeCompare(b))
              .flatMap(([resource, group]) => [
                <tr key={`${resource}-header`} className="bg-muted/20">
                  <th
                    scope="colgroup"
                    colSpan={3}
                    className="text-foreground px-5 py-2.5 text-xs font-bold uppercase tracking-wider"
                  >
                    {resource.replace(/_/g, ' ')}
                  </th>
                </tr>,
                ...group.map((permission) => (
                  <tr key={permission.key} className="hover:bg-muted/30 transition-colors">
                    <td className="text-foreground px-5 py-3 font-mono text-xs">
                      {permission.key}
                    </td>
                    <td className="text-muted-foreground px-5 py-3 text-xs">
                      {permission.description ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      {permission.isSensitive ? (
                        <Badge variant="warning" className="gap-1 text-[11px]">
                          <Lock className="h-3 w-3" /> 5-Min Reauth
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                  </tr>
                )),
              ])}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
