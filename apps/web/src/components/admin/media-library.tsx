'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  formatBytes,
  formatDate,
} from '@sailent/ui';
import {
  Check,
  Copy,
  ExternalLink,
  Globe,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Lock,
  Plus,
  Search,
  Upload,
  UploadCloud,
  X,
} from 'lucide-react';

import { Field, FormStatus, SubmitButton } from '@/components/admin/form-shell';
import { deleteMedia, updateMedia, uploadMedia, type ActionState } from '@/lib/admin/actions';
import type { AdminMedia, AdminMediaDetail } from '@/lib/admin/api';

const ACCEPTED = 'image/jpeg,image/png,image/webp';

async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to fallback
    }
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    return true;
  } catch {
    return false;
  }
}

/**
 * Modern modal dialog for uploading photographs to the media library.
 * Accessible, responsive, with drag-and-drop file preview and validation.
 */
export function UploadPanel() {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(uploadMedia, {});
  const [open, setOpen] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [altTextValue, setAltTextValue] = React.useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Reset or close dialog on successful upload
  React.useEffect(() => {
    if (state.ok) {
      setOpen(false);
      setSelectedFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setAltTextValue('');
      router.refresh();
    }
  }, [state.ok, previewUrl, router]);

  // Clean up object URL on unmount
  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFile = (file: File) => {
    setSelectedFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));

    // If alt text is empty, suggest a friendly default from file name
    if (!altTextValue.trim()) {
      const generated = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]+/g, ' ')
        .trim();
      if (generated) setAltTextValue(generated);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (
      file &&
      (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp')
    ) {
      handleFile(file);
      // Synchronize file with the real file input so form submission carries the file
      if (fileInputRef.current && e.dataTransfer.files) {
        fileInputRef.current.files = e.dataTransfer.files;
      }
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setSelectedFile(null);
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
          setAltTextValue('');
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" className="shadow-xs gap-2">
          <Plus className="size-4" />
          <span>Upload an image</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <UploadCloud className="text-primary size-5" />
            Upload Media Asset
          </DialogTitle>
          <DialogDescription>
            Add a photograph or graphic to the media library. Alt text is mandatory for
            accessibility.
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="space-y-4">
          <FormStatus state={state} success="Uploaded" />

          {/* Real file input (hidden visually but present for Playwright & accessibility) */}
          <input
            ref={fileInputRef}
            id="file"
            name="file"
            type="file"
            accept={ACCEPTED}
            required
            className="sr-only"
            disabled={pending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />

          {/* Dropzone / Preview Area */}
          {selectedFile && previewUrl ? (
            <div className="border-border bg-surface-sunken flex items-center gap-4 rounded-xl border p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Upload preview"
                className="border-border h-20 w-24 shrink-0 rounded-lg border object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="text-body-sm text-foreground truncate font-semibold">
                  {selectedFile.name}
                </p>
                <p className="text-caption text-muted-foreground mt-0.5">
                  {formatBytes(selectedFile.size)} ·{' '}
                  {selectedFile.type.replace('image/', '').toUpperCase()}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-caption text-muted-foreground hover:text-destructive mt-1.5 inline-flex items-center gap-1 underline transition-colors"
                >
                  <X className="size-3" />
                  Choose different file
                </button>
              </div>
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-border/80 hover:border-primary/60 hover:bg-muted/30'
              }`}
            >
              <div className="bg-primary/10 text-primary mb-3 grid size-12 place-items-center rounded-full transition-transform group-hover:scale-110">
                <Upload className="size-6" />
              </div>
              <p className="text-body-sm text-foreground font-semibold">
                Click to browse or drag and drop
              </p>
              <p className="text-caption text-muted-foreground mt-1">
                JPEG, PNG, or WebP up to 10MB
              </p>
            </div>
          )}

          <Field
            label="Alt text"
            name="altText"
            required
            errors={state.fieldErrors}
            hint="Describe what is in the photograph for screen readers and search engines. Required."
          >
            <Input
              id="altText"
              name="altText"
              value={altTextValue}
              onChange={(e) => setAltTextValue(e.target.value)}
              required
              maxLength={300}
              placeholder="e.g. Children smiling in an outdoor classroom in Ranchi"
            />
          </Field>

          <Field
            label="Caption"
            name="caption"
            errors={state.fieldErrors}
            hint="Optional. Displayed under the image when embedded in stories or articles."
          >
            <Input
              id="caption"
              name="caption"
              maxLength={500}
              placeholder="e.g. Annual school kits distribution drive, October 2026"
            />
          </Field>

          <Field
            label="Visibility"
            name="visibility"
            errors={state.fieldErrors}
            hint="Public images are served from the high-speed CDN. Private images are restricted to staff."
          >
            <Select name="visibility" defaultValue="public">
              <SelectTrigger id="visibility">
                <SelectValue placeholder="Select visibility" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start">
                <SelectItem value="public">
                  <span className="flex items-center gap-2">
                    <Globe className="text-success size-3.5" />
                    <span>Public — usable across the website</span>
                  </span>
                </SelectItem>
                <SelectItem value="private">
                  <span className="flex items-center gap-2">
                    <Lock className="text-warning-foreground size-3.5" />
                    <span>Private — restricted to staff</span>
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending} className="gap-2">
              <Upload className="size-4" />
              <span>{pending ? 'Uploading…' : 'Upload image'}</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Single media tile with responsive aspect ratio, metadata pills, and quick copy actions.
 */
export function MediaTile({ item }: { item: AdminMedia }) {
  const [copied, setCopied] = React.useState(false);
  const src = item.url ?? item.signedUrl ?? null;
  const ext = item.mimeType.replace('image/', '').toUpperCase();

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!src) return;
    const ok = await copyToClipboard(src);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="border-border/70 bg-surface hover:border-primary/50 shadow-xs group relative flex flex-col overflow-hidden rounded-xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      {/* Thumbnail area */}
      <div className="bg-muted/40 relative aspect-[4/3] w-full overflow-hidden">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={item.altText}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="text-muted-foreground flex size-full flex-col items-center justify-center p-4 text-center">
            <ImageIcon className="mb-1.5 size-7 opacity-40" />
            <p className="text-caption text-muted-foreground leading-snug">
              No preview — storage is not configured
            </p>
          </div>
        )}

        {/* Top Badges */}
        <div className="pointer-events-none absolute inset-x-2.5 top-2.5 flex items-center justify-between gap-1.5">
          <span className="shadow-xs backdrop-blur-xs rounded-full bg-black/60 px-2 py-0.5 font-mono text-[10px] font-semibold text-white">
            {ext}
          </span>
          <span
            className={`shadow-xs backdrop-blur-xs flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${
              item.visibility === 'public' ? 'bg-success/90' : 'bg-warning/90'
            }`}
          >
            {item.visibility === 'public' ? (
              <>
                <Globe className="size-2.5" />
                <span>Public</span>
              </>
            ) : (
              <>
                <Lock className="size-2.5" />
                <span>Private</span>
              </>
            )}
          </span>
        </div>

        {/* Bottom hover action bar */}
        {src ? (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1.5 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-2.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 max-sm:opacity-100">
            <button
              type="button"
              onClick={handleCopy}
              className="text-caption shadow-xs bg-surface/95 text-foreground hover:bg-surface flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 font-medium transition-colors"
              title="Copy image link"
            >
              {copied ? (
                <>
                  <Check className="text-success size-3" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-3" />
                  <span>Copy URL</span>
                </>
              )}
            </button>
          </div>
        ) : null}
      </div>

      {/* Card Details */}
      <div className="flex flex-1 flex-col justify-between p-3.5">
        <div>
          <p
            className="text-body-sm text-foreground group-hover:text-primary line-clamp-1 font-semibold transition-colors"
            title={item.altText}
          >
            {item.altText}
          </p>
          {item.caption ? (
            <p className="text-caption text-muted-foreground mt-0.5 line-clamp-1 italic">
              “{item.caption}”
            </p>
          ) : null}
        </div>

        <div className="text-caption text-muted-foreground border-border/50 mt-3 flex items-center justify-between border-t pt-2.5">
          <span>{formatBytes(item.sizeBytes)}</span>
          {item.width && item.height ? (
            <span>
              {item.width}×{item.height}
            </span>
          ) : (
            <span>{formatDate(item.createdAt, 'short')}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Interactive Media Gallery supporting Grid View and List/Table View,
 * fast clipboard copy, and responsive cards.
 */
export function MediaGallery({ items, query }: { items: AdminMedia[]; query?: string }) {
  const [view, setView] = React.useState<'grid' | 'list'>('grid');
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopyLink = async (id: string, url: string | null | undefined) => {
    if (!url) return;
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  if (items.length === 0) {
    return (
      <div className="border-border/80 bg-surface/50 rounded-2xl border border-dashed px-4 py-16 text-center">
        <div className="bg-muted text-muted-foreground mx-auto mb-3 grid size-12 place-items-center rounded-full">
          {query ? <Search className="size-6" /> : <ImageIcon className="size-6" />}
        </div>
        <h3 className="text-body-lg text-foreground font-semibold">
          {query ? `No image matches “${query}”.` : 'No media assets found in this view.'}
        </h3>
        <p className="text-body-sm text-muted-foreground mx-auto mt-1 max-w-sm">
          {query
            ? 'Try adjusting your search query or switching the visibility filter.'
            : 'Get started by uploading an image from your computer to use across the site.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View Switcher Header */}
      <div className="flex items-center justify-between">
        <p className="text-caption text-muted-foreground">
          Showing <span className="text-foreground font-semibold">{items.length}</span> assets
        </p>

        <div className="border-border/70 bg-surface shadow-xs flex items-center gap-0.5 rounded-lg border p-0.5">
          <button
            type="button"
            onClick={() => setView('grid')}
            aria-label="Grid view"
            className={`cursor-pointer rounded-md p-1.5 transition-colors ${
              view === 'grid'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            aria-label="List view"
            className={`cursor-pointer rounded-md p-1.5 transition-colors ${
              view === 'list'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <List className="size-4" />
          </button>
        </div>
      </div>

      {/* Grid View */}
      {view === 'grid' ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/admin/media/${item.id}`}
                className="focus-visible:outline-ring block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <MediaTile item={item} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        /* List / Table View */
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Preview</TableHead>
                  <TableHead>Asset Details</TableHead>
                  <TableHead>Type & Size</TableHead>
                  <TableHead>Resolution</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const src = item.url ?? item.signedUrl ?? null;
                  return (
                    <TableRow key={item.id} className="hover:bg-muted/40">
                      <TableCell>
                        <Link href={`/admin/media/${item.id}`} className="block">
                          <div className="border-border bg-muted/40 size-12 overflow-hidden rounded-md border">
                            {src ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={src}
                                alt={item.altText}
                                className="size-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="text-muted-foreground grid size-full place-items-center">
                                <ImageIcon className="size-4 opacity-40" />
                              </div>
                            )}
                          </div>
                        </Link>
                      </TableCell>

                      <TableCell className="max-w-[260px]">
                        <Link
                          href={`/admin/media/${item.id}`}
                          className="hover:text-primary text-foreground block truncate font-semibold transition-colors"
                          title={item.altText}
                        >
                          {item.altText}
                        </Link>
                        {item.caption ? (
                          <p className="text-caption text-muted-foreground truncate italic">
                            {item.caption}
                          </p>
                        ) : null}
                      </TableCell>

                      <TableCell className="text-caption whitespace-nowrap font-mono">
                        {item.mimeType.replace('image/', '').toUpperCase()} ·{' '}
                        {formatBytes(item.sizeBytes)}
                      </TableCell>

                      <TableCell className="text-caption whitespace-nowrap">
                        {item.width && item.height ? `${item.width} × ${item.height}` : '—'}
                      </TableCell>

                      <TableCell>
                        <Badge variant={item.visibility === 'public' ? 'success' : 'neutral'}>
                          {item.visibility}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-caption text-muted-foreground whitespace-nowrap">
                        {formatDate(item.createdAt, 'short')}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {src ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-caption h-8 gap-1.5 px-2"
                              onClick={() => handleCopyLink(item.id, src)}
                            >
                              {copiedId === item.id ? (
                                <>
                                  <Check className="text-success size-3.5" />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="size-3.5" />
                                  <span>Copy URL</span>
                                </>
                              )}
                            </Button>
                          ) : null}
                          <Button
                            asChild
                            variant="secondary"
                            size="sm"
                            className="text-caption h-8 gap-1 px-2.5"
                          >
                            <Link href={`/admin/media/${item.id}`}>
                              <span>Details</span>
                              <ExternalLink className="size-3" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}

/** Edit metadata, and delete when nothing references it. */
export function MediaDetailPanel({ item }: { item: AdminMediaDetail }) {
  const [editState, editAction, editPending] = React.useActionState<ActionState, FormData>(
    updateMedia,
    {},
  );
  const [deleteState, deleteAction, deletePending] = React.useActionState<ActionState, FormData>(
    deleteMedia,
    {},
  );
  const [confirming, setConfirming] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    if (editState.ok) router.refresh();
  }, [editState.ok, router]);

  React.useEffect(() => {
    if (deleteState.redirectTo) router.push(deleteState.redirectTo);
  }, [deleteState.redirectTo, router]);

  const inUse = item.references.length > 0;
  const src = item.url ?? item.signedUrl ?? null;

  const handleCopy = async () => {
    if (!src) return;
    const ok = await copyToClipboard(src);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-8">
      {/* Quick link action banner */}
      {src ? (
        <div className="border-border bg-surface-sunken flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
          <div className="min-w-0 flex-1">
            <p className="text-caption text-muted-foreground">Resource Link</p>
            <p className="text-caption text-foreground truncate font-mono">{src}</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleCopy}
            className="shrink-0 gap-1.5"
          >
            {copied ? <Check className="text-success size-3.5" /> : <Copy className="size-3.5" />}
            <span>{copied ? 'Copied' : 'Copy link'}</span>
          </Button>
        </div>
      ) : null}

      <form action={editAction} className="space-y-4">
        <input type="hidden" name="id" value={item.id} />
        <FormStatus state={editState} />

        <Field label="Alt text" name="altText" required errors={editState.fieldErrors}>
          <Input id="altText" name="altText" defaultValue={item.altText} required maxLength={300} />
        </Field>

        <Field label="Caption" name="caption" errors={editState.fieldErrors}>
          <Input id="caption" name="caption" defaultValue={item.caption ?? ''} maxLength={500} />
        </Field>

        <Field
          label="Visibility"
          name="visibility"
          errors={editState.fieldErrors}
          hint="Changing this moves the file between storage buckets; private images require authentication."
        >
          <Select name="visibility" defaultValue={item.visibility}>
            <SelectTrigger id="visibility">
              <SelectValue placeholder="Select visibility" />
            </SelectTrigger>
            <SelectContent position="popper" side="bottom" align="start">
              <SelectItem value="public">Public — usable across the website</SelectItem>
              <SelectItem value="private">Private — restricted to staff</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <SubmitButton pending={editPending}>Save changes</SubmitButton>
      </form>

      <section className="border-border space-y-3 border-t pt-4">
        <h2 className="text-h4 text-destructive font-semibold">Danger Zone</h2>
        <FormStatus state={deleteState} success="File deleted" />

        {inUse ? (
          <Alert variant="destructive" role="status">
            <strong>This image is in use and cannot be deleted.</strong>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {item.references.map((reference) => (
                <li key={reference.kind}>
                  {reference.count} {reference.kind}
                </li>
              ))}
            </ul>
            Remove it from those records first before deleting.
          </Alert>
        ) : confirming ? (
          <form
            action={deleteAction}
            className="border-destructive/40 bg-destructive/5 space-y-4 rounded-xl border p-5"
          >
            <input type="hidden" name="id" value={item.id} />
            <h3 className="text-h4 text-destructive font-semibold">Delete this image?</h3>
            <p className="text-body-sm text-muted-foreground">
              The file is removed from storage permanently. There is no archived copy and this
              cannot be undone.
            </p>
            <div className="flex gap-2">
              <SubmitButton pending={deletePending} variant="destructive">
                Delete permanently
              </SubmitButton>
              <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button type="button" variant="destructive" onClick={() => setConfirming(true)}>
            Delete this image
          </Button>
        )}
      </section>
    </div>
  );
}
