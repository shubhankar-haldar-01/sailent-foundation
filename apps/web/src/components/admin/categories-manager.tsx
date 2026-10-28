'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Check,
  Copy,
  Edit2,
  ExternalLink,
  Layers,
  Megaphone,
  Plus,
  Search,
  Tag,
  X,
} from 'lucide-react';

import { Badge, Button, Card, Input, PageHeader, Switch, cn } from '@sailent/ui';

import { toggleCategoryStatusAction } from '@/lib/admin/actions';
import type { AdminCategory } from '@/lib/admin/api';
import { CATEGORY_ICONS, CategoryDialog } from './category-dialog';

interface CategoriesManagerProps {
  categories: AdminCategory[];
  canManage: boolean;
}

const DEFAULT_SCOPE_META: { label: string; variant: 'accent' | 'neutral' | 'info' | 'outline' } = {
  label: 'Programs & Campaigns',
  variant: 'accent',
};

const KIND_LABELS: Record<
  string,
  { label: string; variant: 'accent' | 'neutral' | 'info' | 'outline' }
> = {
  both: { label: 'Programs & Campaigns', variant: 'accent' },
  program: { label: 'Programs Only', variant: 'neutral' },
  campaign: { label: 'Campaigns Only', variant: 'info' },
  blog: { label: 'Blog Only', variant: 'outline' },
};

export function CategoriesManager({ categories, canManage }: CategoriesManagerProps) {
  const [items, setItems] = React.useState<AdminCategory[]>(categories);
  const [selectedCategory, setSelectedCategory] = React.useState<AdminCategory | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [copiedSlug, setCopiedSlug] = React.useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterScope, setFilterScope] = React.useState<string>('all');
  const [filterStatus, setFilterStatus] = React.useState<'all' | 'active' | 'inactive'>('all');

  // Keep items updated when server re-renders
  React.useEffect(() => {
    setItems(categories);
  }, [categories]);

  function handleCreateClick() {
    setSelectedCategory(null);
    setDialogOpen(true);
  }

  function handleEditClick(category: AdminCategory) {
    setSelectedCategory(category);
    setDialogOpen(true);
  }

  async function handleToggleStatus(category: AdminCategory) {
    if (!canManage) return;

    const nextActive = !category.isActive;
    // Optimistic update
    setItems((prev) =>
      prev.map((c) => (c.id === category.id ? { ...c, isActive: nextActive } : c)),
    );

    const res = await toggleCategoryStatusAction(category.id, nextActive);
    if (!res.ok) {
      // Revert if failed
      setItems((prev) =>
        prev.map((c) => (c.id === category.id ? { ...c, isActive: category.isActive } : c)),
      );
    }
  }

  function handleCopySlug(slug: string) {
    navigator.clipboard.writeText(slug);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  }

  // Filtered rows
  const filtered = items.filter((cat) => {
    if (filterScope !== 'all' && cat.kind !== filterScope) return false;
    if (filterStatus === 'active' && !cat.isActive) return false;
    if (filterStatus === 'inactive' && cat.isActive) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = cat.name.toLowerCase().includes(q);
      const matchSlug = cat.slug.toLowerCase().includes(q);
      const matchKey = cat.key.toLowerCase().includes(q);
      const matchDesc = cat.description?.toLowerCase().includes(q) ?? false;
      if (!matchName && !matchSlug && !matchKey && !matchDesc) return false;
    }
    return true;
  });

  // Metrics
  const totalCount = items.length;
  const activeCount = items.filter((c) => c.isActive).length;
  const inactiveCount = totalCount - activeCount;
  const totalPrograms = items.reduce((sum, c) => sum + (c.programCount || 0), 0);
  const totalCampaigns = items.reduce((sum, c) => sum + (c.campaignCount || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Category Management"
        count={totalCount}
        description="Lookup catalogue of causes and thematic sectors. Organizes public filters for campaigns, programs, and articles."
        actions={
          canManage ? (
            <Button onClick={handleCreateClick} className="shadow-xs gap-1.5">
              <Plus className="size-4" aria-hidden="true" />
              New Category
            </Button>
          ) : null
        }
      />

      {/* Metrics overview */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card className="border-border/70 p-3 sm:p-4">
          <p className="text-muted-foreground text-xs font-medium">Total Categories</p>
          <p className="text-foreground mt-1 text-2xl font-bold tracking-tight">{totalCount}</p>
        </Card>
        <Card className="border-border/70 p-3 sm:p-4">
          <p className="text-muted-foreground text-xs font-medium">Active in Catalogue</p>
          <p className="text-primary mt-1 text-2xl font-bold tracking-tight">{activeCount}</p>
        </Card>
        <Card className="border-border/70 p-3 sm:p-4">
          <p className="text-muted-foreground text-xs font-medium">Deactivated</p>
          <p className="text-muted-foreground mt-1 text-2xl font-bold tracking-tight">
            {inactiveCount}
          </p>
        </Card>
        <Card className="border-border/70 p-3 sm:p-4">
          <p className="text-muted-foreground text-xs font-medium">Public Programs</p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <Layers className="text-muted-foreground size-4" />
            <p className="text-foreground text-2xl font-bold tracking-tight">{totalPrograms}</p>
          </div>
        </Card>
        <Card className="border-border/70 p-3 sm:p-4">
          <p className="text-muted-foreground text-xs font-medium">Active Appeals</p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <Megaphone className="text-primary size-4" />
            <p className="text-foreground text-2xl font-bold tracking-tight">{totalCampaigns}</p>
          </div>
        </Card>
      </div>

      {/* Filters and search toolbar */}
      <Card className="border-border/70 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Scope and status chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'All Scopes' },
              { id: 'both', label: 'Programs & Campaigns' },
              { id: 'program', label: 'Programs' },
              { id: 'campaign', label: 'Campaigns' },
              { id: 'blog', label: 'Blog' },
            ].map((scope) => {
              const isSelected = filterScope === scope.id;
              return (
                <button
                  key={scope.id}
                  type="button"
                  onClick={() => setFilterScope(scope.id)}
                  className={cn(
                    'text-body-sm rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {scope.label}
                </button>
              );
            })}

            <span className="bg-border/80 mx-1 hidden h-4 w-px sm:inline-block" />

            {[
              { id: 'all', label: 'All Status' },
              { id: 'active', label: 'Active only' },
              { id: 'inactive', label: 'Inactive only' },
            ].map((st) => {
              const isSelected = filterStatus === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setFilterStatus(st.id as 'all' | 'active' | 'inactive')}
                  className={cn(
                    'text-body-sm rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    isSelected
                      ? 'bg-foreground text-background shadow-xs'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {st.label}
                </button>
              );
            })}
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-64">
            <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search category, slug, or key..."
              className="pl-8 text-xs"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-muted-foreground hover:text-foreground absolute right-2.5 top-1/2 -translate-y-1/2"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </Card>

      {/* Categories table */}
      <Card className="border-border/70 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="bg-muted text-muted-foreground mx-auto flex size-12 items-center justify-center rounded-full">
              <Tag className="size-6" />
            </div>
            <h3 className="text-foreground mt-3 text-base font-semibold">No categories found</h3>
            <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
              {searchQuery || filterScope !== 'all' || filterStatus !== 'all'
                ? 'Try adjusting your search terms or filter selections.'
                : 'Get started by creating your first category in the catalogue.'}
            </p>
            {(searchQuery || filterScope !== 'all' || filterStatus !== 'all') && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setFilterScope('all');
                  setFilterStatus('all');
                }}
                className="mt-4"
              >
                Reset filters
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-border/70 bg-muted/40 text-muted-foreground border-b text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Category / Key
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Slug
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Scope
                  </th>
                  <th scope="col" className="px-4 py-3 text-center">
                    Order
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Linked Records
                  </th>
                  <th scope="col" className="px-4 py-3 text-center">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border/60 divide-y">
                {filtered.map((category) => {
                  const iconDef = CATEGORY_ICONS.find((i) => i.id === category.icon);
                  const IconComp = iconDef?.icon ?? Tag;
                  const scopeMeta = KIND_LABELS[category.kind] ?? DEFAULT_SCOPE_META;

                  return (
                    <tr
                      key={category.id}
                      className={cn(
                        'hover:bg-muted/30 transition-colors',
                        !category.isActive && 'bg-muted/15 opacity-75',
                      )}
                    >
                      {/* Name & Key */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-start gap-3">
                          <div className="bg-primary/10 text-primary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md">
                            <IconComp className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-foreground font-semibold">{category.name}</span>
                              <code className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px] font-medium">
                                {category.key}
                              </code>
                            </div>
                            {category.description ? (
                              <p className="text-muted-foreground line-clamp-1 max-w-md text-xs">
                                {category.description}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      {/* Slug with copy */}
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <code className="text-muted-foreground font-mono text-xs">
                            {category.slug}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleCopySlug(category.slug)}
                            className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                            title="Copy slug"
                          >
                            {copiedSlug === category.slug ? (
                              <Check className="text-primary size-3.5" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Scope Badge */}
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <Badge variant={scopeMeta.variant} className="text-[11px] font-medium">
                          {scopeMeta.label}
                        </Badge>
                      </td>

                      {/* Display Order */}
                      <td className="text-muted-foreground px-4 py-3.5 text-center font-mono text-xs">
                        {category.displayOrder ?? 100}
                      </td>

                      {/* Linked counts */}
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/programs?categoryId=${category.id}`}
                            className={cn(
                              'flex items-center gap-1 rounded-md px-2 py-0.5 text-xs transition-colors',
                              category.programCount > 0
                                ? 'bg-primary/10 text-primary hover:bg-primary/20 font-medium'
                                : 'bg-muted text-muted-foreground hover:text-foreground',
                            )}
                            title="Filter programs by this category"
                          >
                            <Layers className="size-3" />
                            <span>{category.programCount}</span>
                          </Link>

                          <Link
                            href={`/admin/campaigns?categoryId=${category.id}`}
                            className={cn(
                              'flex items-center gap-1 rounded-md px-2 py-0.5 text-xs transition-colors',
                              category.campaignCount > 0
                                ? 'bg-primary/10 text-primary hover:bg-primary/20 font-medium'
                                : 'bg-muted text-muted-foreground hover:text-foreground',
                            )}
                            title="Filter campaigns by this category"
                          >
                            <Megaphone className="size-3" />
                            <span>{category.campaignCount}</span>
                          </Link>
                        </div>
                      </td>

                      {/* Active Status Switch */}
                      <td className="whitespace-nowrap px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Switch
                            checked={category.isActive}
                            onCheckedChange={() => handleToggleStatus(category)}
                            disabled={!canManage}
                            aria-label={`Toggle active state for ${category.name}`}
                          />
                          <span
                            className={cn(
                              'text-xs font-medium',
                              category.isActive
                                ? 'text-primary'
                                : 'text-muted-foreground line-through',
                            )}
                          >
                            {category.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="whitespace-nowrap px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="text-muted-foreground hover:text-foreground size-8 p-0"
                            title="View public campaigns in this category"
                          >
                            <Link
                              href={`/campaigns?category=${category.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="size-3.5" />
                              <span className="sr-only">Public link</span>
                            </Link>
                          </Button>

                          {canManage ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleEditClick(category)}
                              className="h-8 gap-1 px-2.5 text-xs"
                            >
                              <Edit2 className="size-3.5" />
                              Edit
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create / Edit Dialog */}
      <CategoryDialog category={selectedCategory} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
