'use client';

import * as React from 'react';
import {
  Book,
  Briefcase,
  Check,
  Globe,
  Heart,
  Home,
  Loader2,
  PawPrint,
  Shield,
  Sparkles,
  Sprout,
  Tag,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';

import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
  cn,
} from '@sailent/ui';
import { slugify } from '@sailent/validation';

import { createCategoryAction, updateCategoryAction, type ActionState } from '@/lib/admin/actions';
import type { AdminCategory } from '@/lib/admin/api';

export const CATEGORY_ICONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'book', label: 'Education & Learning', icon: Book },
  { id: 'heart', label: 'Health & Medical', icon: Heart },
  { id: 'shield', label: 'Disaster & Protection', icon: Shield },
  { id: 'users', label: 'Community & Welfare', icon: Users },
  { id: 'briefcase', label: 'Livelihood & Skills', icon: Briefcase },
  { id: 'sprout', label: 'Environment & Nature', icon: Sprout },
  { id: 'paw', label: 'Animal Welfare', icon: PawPrint },
  { id: 'utensils', label: 'Food & Nutrition', icon: UtensilsCrossed },
  { id: 'home', label: 'Shelter & Housing', icon: Home },
  { id: 'globe', label: 'Outreach & Global', icon: Globe },
  { id: 'sparkles', label: 'Impact & Innovation', icon: Sparkles },
  { id: 'tag', label: 'General / Supplies', icon: Tag },
];

export const CATEGORY_KINDS = [
  {
    value: 'both',
    label: 'Both Programs & Campaigns',
    description: 'Available across campaigns and programs',
  },
  {
    value: 'program',
    label: 'Programs Only',
    description: 'For organizational long-term programs',
  },
  {
    value: 'campaign',
    label: 'Campaigns Only',
    description: 'For fundraising appeals only',
  },
  {
    value: 'blog',
    label: 'Blog Only',
    description: 'For editorial and story categorization',
  },
] as const;

interface CategoryDialogProps {
  category?: AdminCategory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CategoryDialog({ category, open, onOpenChange, onSuccess }: CategoryDialogProps) {
  const isEditing = Boolean(category);

  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [isSlugCustom, setIsSlugCustom] = React.useState(false);
  const [kind, setKind] = React.useState<'program' | 'campaign' | 'both' | 'blog'>('both');
  const [icon, setIcon] = React.useState('tag');
  const [description, setDescription] = React.useState('');
  const [displayOrder, setDisplayOrder] = React.useState(100);
  const [isActive, setIsActive] = React.useState(true);

  const [isPending, startTransition] = React.useTransition();
  const [formState, setFormState] = React.useState<ActionState>({});

  // Reset form when dialog opens or category changes
  React.useEffect(() => {
    if (open) {
      if (category) {
        setName(category.name);
        setSlug(category.slug);
        setIsSlugCustom(true);
        setKind(category.kind);
        setIcon(category.icon ?? 'tag');
        setDescription(category.description ?? '');
        setDisplayOrder(category.displayOrder ?? 100);
        setIsActive(category.isActive);
      } else {
        setName('');
        setSlug('');
        setIsSlugCustom(false);
        setKind('both');
        setIcon('tag');
        setDescription('');
        setDisplayOrder(100);
        setIsActive(true);
      }
      setFormState({});
    }
  }, [open, category]);

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const nextName = e.target.value;
    setName(nextName);
    if (!isEditing && !isSlugCustom) {
      setSlug(slugify(nextName));
    }
  }

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSlug(e.target.value);
    setIsSlugCustom(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormState({});

    const formData = new FormData();
    if (category?.id) {
      formData.set('id', category.id);
    }
    formData.set('name', name);
    formData.set('slug', slug);
    formData.set('kind', kind);
    formData.set('icon', icon);
    formData.set('description', description);
    formData.set('displayOrder', String(displayOrder));
    formData.set('isActive', isActive ? 'true' : 'false');

    startTransition(async () => {
      const res = isEditing
        ? await updateCategoryAction({}, formData)
        : await createCategoryAction({}, formData);

      if (res.ok) {
        onOpenChange(false);
        onSuccess?.();
      } else {
        setFormState(res);
      }
    });
  }

  const SelectedIcon = CATEGORY_ICONS.find((i) => i.id === icon)?.icon ?? Tag;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
              <SelectedIcon className="size-5" />
            </div>
            <div>
              <DialogTitle>
                {isEditing ? `Edit “${category?.name}”` : 'Create New Category'}
              </DialogTitle>
              <DialogDescription>
                {isEditing
                  ? 'Update category settings. Renaming keeps all linked campaigns & programs in sync.'
                  : 'Add a new category to organize programs, fundraising campaigns, or articles.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {formState.error ? (
            <div
              role="alert"
              className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm font-medium"
            >
              {formState.error}
            </div>
          ) : null}

          {isEditing && category?.key ? (
            <div className="border-border bg-muted/40 flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
              <span className="text-muted-foreground font-medium">Machine Identifier</span>
              <code className="text-foreground font-mono font-semibold">{category.key}</code>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="category-name">
                Category Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="category-name"
                name="name"
                value={name}
                onChange={handleNameChange}
                placeholder="e.g. Disaster Relief"
                required
                maxLength={120}
                className={cn(formState.fieldErrors?.name && 'border-destructive')}
              />
              {formState.fieldErrors?.name ? (
                <p className="text-destructive text-xs">{formState.fieldErrors.name}</p>
              ) : null}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="category-slug">
                URL Slug <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="category-slug"
                  name="slug"
                  value={slug}
                  onChange={handleSlugChange}
                  placeholder="e.g. disaster-relief"
                  required
                  maxLength={120}
                  className={cn(
                    'font-mono text-sm',
                    formState.fieldErrors?.slug && 'border-destructive',
                  )}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                Used in URLs: <code>/campaigns?category={slug || 'slug'}</code>
              </p>
              {formState.fieldErrors?.slug ? (
                <p className="text-destructive text-xs">{formState.fieldErrors.slug}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category-kind">Scope / Applicable To</Label>
              <select
                id="category-kind"
                name="kind"
                value={kind}
                onChange={(e) =>
                  setKind(e.target.value as 'program' | 'campaign' | 'both' | 'blog')
                }
                className="border-input bg-background focus-visible:ring-ring shadow-xs flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2"
              >
                {CATEGORY_KINDS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category-order">Display Order</Label>
              <Input
                id="category-order"
                name="displayOrder"
                type="number"
                min={0}
                max={9999}
                value={displayOrder}
                onChange={(e) => setDisplayOrder(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Category Icon</Label>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {CATEGORY_ICONS.map((item) => {
                const IconComponent = item.icon;
                const isSelected = icon === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setIcon(item.id)}
                    title={item.label}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1 rounded-lg border p-2 text-xs transition-colors',
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary shadow-xs font-medium'
                        : 'border-border/60 hover:border-border hover:bg-muted/50 text-muted-foreground',
                    )}
                  >
                    <IconComponent className="size-4 shrink-0" />
                    <span className="truncate text-[10px]">{item.id}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="category-description">Description (Optional)</Label>
            <textarea
              id="category-description"
              name="description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the causes or projects in this category."
              maxLength={1000}
              className="border-input bg-background focus-visible:ring-ring placeholder:text-muted-foreground shadow-xs flex w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
            />
          </div>

          <div className="border-border/70 flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="category-active" className="text-sm font-medium">
                Active in catalogue
              </Label>
              <p className="text-muted-foreground text-xs">
                When inactive, existing records stay intact but cannot be chosen for new ones.
              </p>
            </div>
            <Switch id="category-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending} className="gap-1.5">
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : isEditing ? (
                <>
                  <Check className="size-4" />
                  Save Changes
                </>
              ) : (
                'Create Category'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
