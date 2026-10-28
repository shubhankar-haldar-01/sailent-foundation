'use client';

import * as React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';

import { cn, formatCurrency, Input, Label } from '@sailent/ui';

import { Field, FormStatus, SubmitButton, TextArea } from '@/components/admin/form-shell';
import { getVideoEmbedUrl } from '@/components/campaigns/campaign-gallery';
import {
  createCampaign,
  updateCampaign,
  uploadCampaignVideo,
  uploadMediaDirect,
  type ActionState,
  type DirectUploadResult,
} from '@/lib/admin/actions';
import type { AdminCategory, AdminGalleryItem, AdminMedia, AdminProgram } from '@/lib/admin/api';

/** Paise on the wire, rupees in the form. Converted at this one boundary. */
function toRupees(paise: number | undefined): string {
  if (paise === undefined || paise === null || paise === 0) return '';
  return String(paise / 100);
}

const DEFAULT_PRESET_AMOUNTS = [500, 1000, 2500, 5000, 10000];

function PresetAmountsEditor({ initialAmounts }: { initialAmounts?: number[] | null }) {
  const [amounts, setAmounts] = React.useState<string[]>(() => {
    if (initialAmounts && initialAmounts.length > 0) {
      return initialAmounts.map(String);
    }
    return DEFAULT_PRESET_AMOUNTS.map(String);
  });

  const handleAmountChange = (index: number, val: string) => {
    setAmounts((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const handleRemove = (index: number) => {
    setAmounts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    if (amounts.length >= 8) return;
    setAmounts((prev) => [...prev, '']);
  };

  const handleReset = () => {
    setAmounts(DEFAULT_PRESET_AMOUNTS.map(String));
  };

  // Valid positive integer amounts serialized for the form submission
  const serialized = amounts
    .map((a) => Number.parseInt(a.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0 && n <= 10_000_000)
    .join(', ');

  const validAmounts = amounts
    .map((a) => Number.parseInt(a.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0 && n <= 10_000_000);

  return (
    <div className="space-y-3">
      {/* Hidden input submitted with the form */}
      <input type="hidden" id="presetAmounts" name="presetAmounts" value={serialized} />

      {/* Editable buttons list */}
      <div className="flex flex-wrap items-center gap-2.5">
        {amounts.map((amount, idx) => (
          <div
            key={idx}
            className="border-border bg-card shadow-xs hover:border-primary/50 focus-within:border-primary focus-within:ring-primary/20 group inline-flex items-center gap-1 rounded-xl border px-3 py-2 transition-all focus-within:ring-2"
          >
            <span className="text-muted-foreground select-none text-sm font-bold">₹</span>
            <input
              type="number"
              min={1}
              max={10000000}
              placeholder="0"
              value={amount}
              onChange={(e) => handleAmountChange(idx, e.target.value)}
              aria-label={`Preset amount ${idx + 1}`}
              className="text-foreground w-20 bg-transparent text-sm font-semibold tabular-nums [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive ml-0.5 cursor-pointer rounded p-1 transition-colors"
              title="Remove this button"
              aria-label={`Remove preset ${amount || idx + 1}`}
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}

        {amounts.length < 8 && (
          <button
            type="button"
            onClick={handleAdd}
            className="border-border hover:border-primary text-muted-foreground hover:text-primary hover:bg-primary/5 inline-flex cursor-pointer items-center gap-1.5 rounded-xl border-2 border-dashed px-3 py-2 text-xs font-semibold transition-colors"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            <span>Add Button</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleReset}
          className="text-muted-foreground hover:text-foreground ml-auto cursor-pointer text-xs underline decoration-dotted transition-colors"
        >
          Reset to defaults
        </button>
      </div>

      {/* Live Preview Bar */}
      <div className="border-border/70 bg-surface-sunken/40 rounded-lg border px-3.5 py-2.5">
        <div className="text-muted-foreground mb-1.5 text-[11px] font-semibold uppercase tracking-wider">
          Live Donor Form Preview
        </div>
        {validAmounts.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {validAmounts.map((rupees, i) => (
              <span
                key={i}
                className={cn(
                  'inline-flex items-center justify-center rounded-lg border px-3 py-1 text-xs font-semibold tabular-nums',
                  i === 0
                    ? 'border-success bg-wash-mint text-wash-mint-ink-strong'
                    : 'border-border bg-surface text-foreground',
                )}
              >
                {formatCurrency(rupees * 100)}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-xs italic">
            No amounts set. Will default to ₹500, ₹1,000, ₹2,500, ₹5,000, ₹10,000 on the donor form.
          </p>
        )}
      </div>
    </div>
  );
}

function CampaignVideoUploadField({ initialUrl }: { initialUrl: string }) {
  const [videoUrl, setVideoUrl] = React.useState(initialUrl);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const embed = React.useMemo(() => getVideoEmbedUrl(videoUrl), [videoUrl]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await uploadCampaignVideo(fd);
      if (res.ok && res.url) {
        setVideoUrl(res.url);
      } else {
        setUploadError(res.error || 'Failed to upload video.');
      }
    } catch {
      setUploadError('Network error uploading video.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    setVideoUrl('');
    setUploadError(null);
  };

  return (
    <div className="space-y-2">
      <input type="hidden" id="videoUrl" name="videoUrl" value={videoUrl} />

      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/ogg,video/quicktime"
        className="sr-only"
        onChange={handleFileChange}
        disabled={isUploading}
      />

      {videoUrl ? (
        <div className="border-border bg-surface overflow-hidden rounded-xl border">
          <div className="relative aspect-video w-full max-w-xl bg-black">
            {embed?.type === 'direct' || !embed ? (
              <video
                src={embed?.embedUrl ?? videoUrl}
                controls
                playsInline
                className="h-full w-full object-contain"
              />
            ) : (
              <iframe
                src={embed.embedUrl}
                title="Campaign video"
                className="h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 p-3">
            <div className="flex items-center gap-2">
              <span className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium">
                <Video className="size-3.5" />
                Video attached
              </span>
              <span className="text-muted-foreground truncate text-xs" title={videoUrl}>
                {videoUrl.split('/').pop()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="border-border hover:bg-muted text-foreground inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
              >
                <Upload className="size-3.5" />
                Replace video
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={isUploading}
                className="hover:bg-destructive/10 text-destructive border-destructive/20 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
              >
                <Trash2 className="size-3.5" />
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={cn(
            'border-border hover:border-primary/60 hover:bg-muted/40 group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all',
            isUploading && 'pointer-events-none opacity-60',
          )}
        >
          <div className="bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary mb-3 grid size-12 place-items-center rounded-full transition-colors">
            {isUploading ? (
              <Loader2 className="size-6 animate-spin" />
            ) : (
              <Video className="size-6" />
            )}
          </div>
          <p className="text-body-sm text-foreground font-semibold">
            {isUploading
              ? 'Uploading campaign video...'
              : 'Upload campaign video from local device'}
          </p>
          <p className="text-caption text-muted-foreground mt-1 max-w-sm">
            MP4, WebM, or MOV file (up to 100MB). Video will appear in the &apos;About This
            Campaign&apos; gallery carousel.
          </p>
          <button
            type="button"
            disabled={isUploading}
            className="border-border bg-surface text-foreground group-hover:border-primary/40 shadow-xs mt-4 inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-semibold"
          >
            <Upload className="text-primary size-3.5" />
            Choose Video File
          </button>
        </div>
      )}

      {uploadError ? <p className="text-destructive text-xs font-medium">{uploadError}</p> : null}
    </div>
  );
}

/**
 * Upload a local image file directly via the BFF (/api/bff/admin/media),
 * falling back to Server Action uploadMediaDirect if needed.
 */
async function uploadMediaFile(file: File): Promise<DirectUploadResult> {
  const fd = new FormData();
  fd.append('file', file, file.name);
  const fallbackAlt =
    file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .trim() || 'Uploaded photograph';
  fd.append('altText', fallbackAlt);
  fd.append('visibility', 'public');

  try {
    const res = await fetch('/api/bff/admin/media', {
      method: 'POST',
      body: fd,
    });
    const payload = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      data?: AdminMedia;
      error?: { code?: string; message?: string; details?: { field?: string; message?: string }[] };
    };

    if (res.ok && payload.success && payload.data) {
      return { ok: true, media: payload.data };
    }

    const errorMessage =
      payload.error?.message ||
      (Array.isArray(payload.error?.details) && payload.error.details[0]?.message) ||
      'Failed to upload photo.';
    return { ok: false, error: errorMessage };
  } catch {
    // If BFF fetch encounters an unexpected failure, try server action
    return uploadMediaDirect(fd);
  }
}

function CampaignGalleryPicker({
  options,
  initialItems = [],
  onPhotoUploaded,
}: {
  options: AdminMedia[];
  initialItems?: AdminGalleryItem[] | null;
  onPhotoUploaded?: (media: AdminMedia) => void;
}) {
  const [allOptions, setAllOptions] = React.useState<AdminMedia[]>(options);

  // Sync if options prop updates
  React.useEffect(() => {
    setAllOptions((prev) => {
      const existingIds = new Set(prev.map((o) => o.id));
      const newItems = options.filter((o) => !existingIds.has(o.id));
      return [...newItems, ...prev];
    });
  }, [options]);

  const usableOptions = React.useMemo(
    () => allOptions.filter((item) => item.visibility === 'public' && Boolean(item.url)),
    [allOptions],
  );

  const [selected, setSelected] = React.useState<
    { id: string; mediaId: string; url: string; altText: string }[]
  >(() => {
    if (initialItems && initialItems.length > 0) {
      return initialItems
        .filter((item) => item.url)
        .map((item) => ({
          id: item.id,
          mediaId: item.mediaId,
          url: item.url!,
          altText: item.altText,
        }));
    }
    return [];
  });

  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = React.useState(false);
  const [uploadPhotoError, setUploadPhotoError] = React.useState<string | null>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);

  const selectedMediaIds = React.useMemo(() => new Set(selected.map((s) => s.mediaId)), [selected]);

  const handleAdd = (item: AdminMedia) => {
    if (!item.url || selectedMediaIds.has(item.id)) return;
    setSelected((prev) => [
      ...prev,
      {
        id: item.id,
        mediaId: item.id,
        url: item.url!,
        altText: item.altText,
      },
    ]);
  };

  const handleRemove = (mediaId: string) => {
    setSelected((prev) => prev.filter((item) => item.mediaId !== mediaId));
  };

  const handleMove = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= selected.length) return;
    setSelected((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  };

  const handleDirectPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    setUploadPhotoError(null);

    try {
      const res = await uploadMediaFile(file);
      if (res.ok && res.media && res.media.url) {
        const newMedia = res.media;
        setAllOptions((prev) => [newMedia, ...prev.filter((m) => m.id !== newMedia.id)]);
        onPhotoUploaded?.(newMedia);
        setSelected((prev) => {
          if (prev.some((s) => s.mediaId === newMedia.id)) return prev;
          return [
            ...prev,
            {
              id: newMedia.id,
              mediaId: newMedia.id,
              url: newMedia.url!,
              altText: newMedia.altText,
            },
          ];
        });
      } else {
        setUploadPhotoError(res.error || 'Failed to upload photo.');
      }
    } catch (err) {
      setUploadPhotoError(err instanceof Error ? err.message : 'Network error uploading photo.');
    } finally {
      setIsUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const filteredOptions = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return usableOptions.filter((item) => {
      if (!q) return true;
      return (
        item.altText.toLowerCase().includes(q) ||
        (item.caption && item.caption.toLowerCase().includes(q))
      );
    });
  }, [usableOptions, search]);

  return (
    <div className="space-y-3">
      {/* Hidden input submitted with the form */}
      <input
        type="hidden"
        name="galleryMediaIds"
        value={selected.map((s) => s.mediaId).join(',')}
      />

      {/* Hidden file input for direct photo upload */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={isUploadingPhoto}
        onChange={handleDirectPhotoUpload}
      />

      {/* Selected Gallery Items */}
      {selected.length === 0 ? (
        <div className="border-border rounded-lg border border-dashed p-4 text-center">
          <p className="text-body-sm text-muted-foreground">No gallery photographs selected yet.</p>
          <p className="text-caption text-muted-foreground mt-0.5">
            The carousel will only display on the public page when at least one photo or video is
            added.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {selected.map((item, index) => (
            <div
              key={`${item.mediaId}-${index}`}
              className="border-border bg-surface shadow-xs group relative flex flex-col overflow-hidden rounded-lg border"
            >
              <div className="bg-muted relative aspect-[4/3] w-full overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={item.altText}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
                <span className="text-caption backdrop-blur-xs absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 font-semibold text-white">
                  #{index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(item.mediaId)}
                  aria-label={`Remove ${item.altText} from gallery`}
                  className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/60 text-white transition-opacity hover:bg-black/80"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              <div className="bg-surface flex items-center justify-between gap-1 p-2">
                <p
                  className="text-caption text-muted-foreground truncate font-medium"
                  title={item.altText}
                >
                  {item.altText}
                </p>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => handleMove(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${item.altText} earlier`}
                    className="text-muted-foreground hover:bg-muted hover:text-foreground grid size-6 place-items-center rounded disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(index, 1)}
                    disabled={index === selected.length - 1}
                    aria-label={`Move ${item.altText} later`}
                    className="text-muted-foreground hover:bg-muted hover:text-foreground grid size-6 place-items-center rounded disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Button to toggle photo picker modal / tray & direct upload */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="border-border bg-surface text-body-sm text-foreground hover:bg-muted inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3.5 py-2 font-medium transition-colors"
        >
          <Plus className="text-primary size-4" />
          {isOpen ? 'Close Media Library selection' : 'Choose from Media Library'}
        </button>

        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          disabled={isUploadingPhoto}
          className="border-border bg-surface text-body-sm text-foreground hover:bg-muted inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3.5 py-2 font-medium transition-colors"
        >
          {isUploadingPhoto ? (
            <Loader2 className="text-primary size-4 animate-spin" />
          ) : (
            <Upload className="text-primary size-4" />
          )}
          {isUploadingPhoto ? 'Uploading photo...' : 'Upload photo from local device'}
        </button>
      </div>

      {uploadPhotoError ? (
        <p className="text-destructive text-xs font-medium">{uploadPhotoError}</p>
      ) : null}

      {/* Media Library Photo Selector Tray */}
      {isOpen ? (
        <div className="border-border bg-muted/30 space-y-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h5 className="text-body-sm text-foreground font-semibold">
              Choose photographs from Media Library
            </h5>
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={isUploadingPhoto}
              className="text-caption text-primary hover:text-primary-hover inline-flex cursor-pointer items-center gap-1.5 font-medium transition-colors"
            >
              {isUploadingPhoto ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
              {isUploadingPhoto ? 'Uploading...' : 'Upload new photo'}
            </button>
          </div>

          {usableOptions.length > 6 ? (
            <Input
              type="search"
              placeholder="Filter photos by alt text or caption..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
          ) : null}

          {usableOptions.length === 0 ? (
            <div className="border-border rounded-lg border border-dashed p-6 text-center">
              <p className="text-body-sm text-muted-foreground">
                No public photos in the media library yet.
              </p>
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="bg-primary text-primary-foreground hover:bg-primary-hover mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors"
              >
                <Upload className="size-3.5" />
                Upload photograph now
              </button>
            </div>
          ) : (
            <div className="grid max-h-72 grid-cols-3 gap-2.5 overflow-y-auto p-1 sm:grid-cols-4 md:grid-cols-6">
              {filteredOptions.map((item) => {
                const isSelected = selectedMediaIds.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => (isSelected ? handleRemove(item.id) : handleAdd(item))}
                    className={cn(
                      'group relative aspect-[4/3] w-full overflow-hidden rounded-lg border-2 text-left transition-all',
                      isSelected
                        ? 'border-primary ring-primary/20 ring-2'
                        : 'border-border/60 hover:border-primary/60',
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url!}
                      alt={item.altText}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 truncate bg-black/65 p-1 text-[11px] text-white">
                      {item.altText}
                    </div>
                    {isSelected ? (
                      <span className="bg-primary text-primary-foreground absolute right-1 top-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                        ✓
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function CampaignCoverPicker({
  options,
  selectedCover,
  onSelectCover,
  onCoverUploaded,
}: {
  options: AdminMedia[];
  selectedCover: AdminMedia | null;
  onSelectCover: (media: AdminMedia | null) => void;
  onCoverUploaded?: (media: AdminMedia) => void;
}) {
  const [allOptions, setAllOptions] = React.useState<AdminMedia[]>(options);
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setAllOptions((prev) => {
      const existingIds = new Set(prev.map((o) => o.id));
      const newItems = options.filter((o) => !existingIds.has(o.id));
      return [...newItems, ...prev];
    });
  }, [options]);

  const usableOptions = React.useMemo(
    () => allOptions.filter((item) => item.visibility === 'public' && Boolean(item.url)),
    [allOptions],
  );

  const filteredOptions = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return usableOptions.filter((item) => {
      if (!q) return true;
      return (
        item.altText.toLowerCase().includes(q) ||
        (item.caption && item.caption.toLowerCase().includes(q))
      );
    });
  }, [usableOptions, search]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const res = await uploadMediaFile(file);
      if (res.ok && res.media && res.media.url) {
        const newMedia = res.media;
        setAllOptions((prev) => [newMedia, ...prev.filter((m) => m.id !== newMedia.id)]);
        onCoverUploaded?.(newMedia);
        onSelectCover(newMedia);
      } else {
        setUploadError(res.error || 'Failed to upload photo.');
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Network error uploading photo.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      {/* Hidden input to pass coverImage URL to form submission */}
      <input type="hidden" name="coverImage" value={selectedCover?.url ?? ''} />

      {/* Hidden file input for uploading from local device */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={isUploading}
        onChange={handleFileChange}
      />

      {/* Selected Cover Display */}
      {selectedCover && selectedCover.url ? (
        <div className="border-border bg-surface flex items-start gap-3.5 rounded-lg border p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedCover.url}
            alt={selectedCover.altText}
            className="border-border h-20 w-28 shrink-0 rounded-md border object-cover"
          />
          <div className="min-w-0 flex-1">
            <p
              className="text-body-sm text-foreground truncate font-semibold"
              title={selectedCover.altText}
            >
              {selectedCover.altText}
            </p>
            <p className="text-caption text-muted-foreground mt-0.5">
              Active hero cover photograph
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSelectCover(null)}
                className="text-caption text-muted-foreground hover:text-destructive cursor-pointer underline transition-colors"
              >
                Remove cover photo
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-border rounded-lg border border-dashed p-4 text-center">
          <p className="text-body-sm text-muted-foreground">No cover photo chosen yet.</p>
          <p className="text-caption text-muted-foreground mt-0.5">
            With no cover photo, the public page displays its placeholder illustration.
          </p>
        </div>
      )}

      {/* Action buttons: choose from library or upload from local device */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="border-border bg-surface text-body-sm text-foreground hover:bg-muted inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3.5 py-2 font-medium transition-colors"
        >
          <Plus className="text-primary size-4" />
          {isOpen ? 'Close Media Library selection' : 'Choose from Media Library'}
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="border-border bg-surface text-body-sm text-foreground hover:bg-muted inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3.5 py-2 font-medium transition-colors"
        >
          {isUploading ? (
            <Loader2 className="text-primary size-4 animate-spin" />
          ) : (
            <Upload className="text-primary size-4" />
          )}
          {isUploading ? 'Uploading photo...' : 'Upload photo from local device'}
        </button>
      </div>

      {uploadError ? <p className="text-destructive text-xs font-medium">{uploadError}</p> : null}

      {/* Collapsible Media Library Tray */}
      {isOpen ? (
        <div className="border-border bg-muted/30 space-y-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h5 className="text-body-sm text-foreground font-semibold">
              Choose photograph from Media Library
            </h5>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="text-caption text-primary hover:text-primary-hover inline-flex cursor-pointer items-center gap-1.5 font-medium transition-colors"
            >
              {isUploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
              {isUploading ? 'Uploading...' : 'Upload new photo'}
            </button>
          </div>

          {usableOptions.length > 6 ? (
            <Input
              type="search"
              placeholder="Filter photos by alt text or caption..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
          ) : null}

          {usableOptions.length === 0 ? (
            <div className="border-border rounded-lg border border-dashed p-6 text-center">
              <p className="text-body-sm text-muted-foreground">
                No public photos in the media library yet.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="bg-primary text-primary-foreground hover:bg-primary-hover mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors"
              >
                <Upload className="size-3.5" />
                Upload photograph now
              </button>
            </div>
          ) : (
            <div className="grid max-h-72 grid-cols-3 gap-2.5 overflow-y-auto p-1 sm:grid-cols-4 md:grid-cols-6">
              {filteredOptions.map((item) => {
                const isSelected = selectedCover?.id === item.id || selectedCover?.url === item.url;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectCover(isSelected ? null : item);
                      if (!isSelected) setIsOpen(false);
                    }}
                    className={cn(
                      'group relative aspect-[4/3] w-full overflow-hidden rounded-lg border-2 text-left transition-all',
                      isSelected
                        ? 'border-primary ring-primary/20 ring-2'
                        : 'border-border/60 hover:border-primary/60',
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url!}
                      alt={item.altText}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 truncate bg-black/65 p-1 text-[11px] text-white">
                      {item.altText}
                    </div>
                    {isSelected ? (
                      <span className="bg-primary text-primary-foreground absolute right-1 top-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                        ✓
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function CampaignForm({
  programs,
  categories,
  campaign,
  mediaOptions = [],
  initialGallery = [],
}: {
  programs: AdminProgram[];
  categories: AdminCategory[];
  campaign?: {
    id: string;
    title: string;
    slug: string;
    coverImage?: string | null;
    shortDescription: string | null;
    description: string | null;
    beneficiaryContext: string | null;
    fundUtilization: string | null;
    internalNotes: string | null;
    programId: string | null;
    categoryId: string | null;
    location: string | null;
    state: string | null;
    fundraisingGoal: number;
    beneficiaryTarget: number | null;
    startDate: string | null;
    endDate: string | null;
    amountRaised: number;
    presetAmounts?: number[] | null;
    supportProvides?: string | null;
    videoUrl?: string | null;
    isFeatured: boolean;
    featuredOrder: number | null;
  };
  mediaOptions?: AdminMedia[];
  initialGallery?: AdminGalleryItem[] | null;
}) {
  const [state, action, pending] = React.useActionState<ActionState, FormData>(
    campaign ? updateCampaign : createCampaign,
    {},
  );
  const [isFeatured, setIsFeatured] = React.useState(campaign?.isFeatured ?? false);
  const [extraMedia, setExtraMedia] = React.useState<AdminMedia[]>([]);

  const combinedMediaOptions = React.useMemo(() => {
    const existingIds = new Set(mediaOptions.map((m) => m.id));
    const uniqueExtra = extraMedia.filter((m) => !existingIds.has(m.id));
    return [...uniqueExtra, ...mediaOptions];
  }, [extraMedia, mediaOptions]);

  const existingCoverInOptions = combinedMediaOptions.find(
    (item) => item.url === campaign?.coverImage,
  );
  const effectiveOptions = React.useMemo(() => {
    if (campaign?.coverImage && !existingCoverInOptions) {
      return [
        {
          id: '__current__',
          url: campaign.coverImage,
          altText: 'Current cover image',
          visibility: 'public' as const,
        } as AdminMedia,
        ...combinedMediaOptions,
      ];
    }
    return combinedMediaOptions;
  }, [campaign?.coverImage, existingCoverInOptions, combinedMediaOptions]);

  const initialCover = effectiveOptions.find((item) => item.url === campaign?.coverImage) ?? null;
  const [selectedCover, setSelectedCover] = React.useState<AdminMedia | null>(initialCover);

  return (
    <form action={action} className="max-w-2xl space-y-5">
      {campaign ? <input type="hidden" name="id" value={campaign.id} /> : null}
      <FormStatus state={state} />

      {/* Hero Cover Image */}
      <div className="border-border/80 bg-muted/20 space-y-4 rounded-xl border p-4">
        <div className="border-border/60 border-b pb-3">
          <h4 className="text-foreground flex items-center gap-2 text-sm font-semibold">
            <ImageIcon className="text-primary size-4" aria-hidden="true" />
            Hero Cover Image
          </h4>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Primary visual displayed at the top of the campaign and on listing cards.
          </p>
        </div>

        <CampaignCoverPicker
          options={effectiveOptions}
          selectedCover={selectedCover}
          onSelectCover={setSelectedCover}
          onCoverUploaded={(newMedia) => setExtraMedia((prev) => [newMedia, ...prev])}
        />
      </div>

      <Field label="Title" name="title" errors={state.fieldErrors} required>
        <Input id="title" name="title" defaultValue={campaign?.title} required />
      </Field>

      <Field
        label="URL"
        name="slug"
        errors={state.fieldErrors}
        hint={
          campaign
            ? 'Changing this leaves a permanent redirect behind, so posters and existing links keep working.'
            : 'Left blank, this is generated from the title.'
        }
      >
        <Input id="slug" name="slug" defaultValue={campaign?.slug} />
      </Field>

      <div className="space-y-1.5">
        <Label htmlFor="programId">
          Program
          <span className="text-destructive ml-0.5" aria-hidden="true">
            *
          </span>
        </Label>
        <select
          id="programId"
          name="programId"
          defaultValue={campaign?.programId ?? ''}
          required
          aria-invalid={state.fieldErrors?.programId ? true : undefined}
          aria-describedby={
            ['programId-hint', state.fieldErrors?.programId ? 'programId-error' : null]
              .filter(Boolean)
              .join(' ') || undefined
          }
          className="border-input bg-surface text-body-sm h-10 w-full rounded-md border px-3"
        >
          <option value="" disabled>
            Select a program...
          </option>
          {programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.title}
              {program.status === 'draft' ? ' (Draft)' : ''}
            </option>
          ))}
        </select>
        <p id="programId-hint" className="text-caption text-muted-foreground">
          Every campaign funds a specific piece of a program.
        </p>
        {state.fieldErrors?.programId ? (
          <p id="programId-error" className="text-caption text-destructive">
            {state.fieldErrors.programId}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="categoryId">
          Category
          <span className="text-destructive ml-0.5" aria-hidden="true">
            *
          </span>
        </Label>
        <select
          id="categoryId"
          name="categoryId"
          defaultValue={campaign?.categoryId ?? ''}
          required
          aria-invalid={state.fieldErrors?.categoryId ? true : undefined}
          aria-describedby={
            ['categoryId-hint', state.fieldErrors?.categoryId ? 'categoryId-error' : null]
              .filter(Boolean)
              .join(' ') || undefined
          }
          className="border-input bg-surface text-body-sm h-10 w-full rounded-md border px-3"
        >
          <option value="" disabled>
            Select a category...
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <p id="categoryId-hint" className="text-caption text-muted-foreground">
          Categorizes the campaign for cause filtering and thematic badge display.
        </p>
        {state.fieldErrors?.categoryId ? (
          <p id="categoryId-error" className="text-caption text-destructive">
            {state.fieldErrors.categoryId}
          </p>
        ) : null}
      </div>

      <Field
        label="Short description"
        name="shortDescription"
        errors={state.fieldErrors}
        hint="Appears on every card. Required before publishing."
      >
        <TextArea
          name="shortDescription"
          rows={3}
          defaultValue={campaign?.shortDescription}
          errors={state.fieldErrors}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Fundraising goal (₹)"
          name="fundraisingGoal"
          errors={state.fieldErrors}
          hint={
            campaign && campaign.amountRaised > 0
              ? `Cannot be set below the ₹${(campaign.amountRaised / 100).toLocaleString('en-IN')} already raised.`
              : 'Required above zero before publishing.'
          }
        >
          <Input
            id="fundraisingGoal"
            name="fundraisingGoal"
            type="number"
            min={1}
            step="1"
            inputMode="numeric"
            defaultValue={toRupees(campaign?.fundraisingGoal)}
          />
        </Field>

        <Field label="Beneficiary target" name="beneficiaryTarget" errors={state.fieldErrors}>
          <Input
            id="beneficiaryTarget"
            name="beneficiaryTarget"
            type="number"
            min={0}
            defaultValue={campaign?.beneficiaryTarget ?? ''}
          />
        </Field>

        <Field label="Location" name="location" errors={state.fieldErrors}>
          <Input id="location" name="location" defaultValue={campaign?.location ?? ''} />
        </Field>

        <Field label="State" name="state" errors={state.fieldErrors}>
          <Input id="state" name="state" defaultValue={campaign?.state ?? ''} />
        </Field>
      </div>

      <Field label="Preset donation amounts (₹)" name="presetAmounts" errors={state.fieldErrors}>
        <PresetAmountsEditor initialAmounts={campaign?.presetAmounts} />
      </Field>

      {/*
        What leads the homepage. Featured campaigns come first in the
        "Featured Campaigns" band, in this order; the band fills the rest with
        active campaigns ending soonest. See `lib/featured-campaigns.ts`.
      */}
      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-body-sm px-1 font-medium">Homepage</legend>

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            name="isFeatured"
            checked={isFeatured}
            onChange={(changed) => setIsFeatured(changed.target.checked)}
            aria-describedby="isFeatured-hint"
            className="mt-0.5 size-4"
          />
          <span>
            <span className="text-body-sm block">Feature on the homepage</span>
            <span id="isFeatured-hint" className="text-caption text-muted-foreground block">
              Featured campaigns lead the homepage&rsquo;s &ldquo;Featured Campaigns&rdquo; band.
              Only active campaigns are shown there, so a paused or completed one waits until it is
              active again.
            </span>
          </span>
        </label>

        {isFeatured ? (
          <Field
            label="Featured order"
            name="featuredOrder"
            errors={state.fieldErrors}
            hint="Lower numbers come first. Leave blank to place it after the numbered ones."
          >
            <Input
              id="featuredOrder"
              name="featuredOrder"
              type="number"
              min={0}
              max={9999}
              step="1"
              inputMode="numeric"
              defaultValue={campaign?.featuredOrder ?? ''}
              aria-describedby="featuredOrder-hint"
              className="w-32"
            />
          </Field>
        ) : null}
      </fieldset>

      <div className="space-y-4 pt-2">
        <div className="border-border border-t pt-4">
          <h3 className="text-foreground text-sm font-semibold">
            Story &amp; Public Narrative (&quot;About This Campaign&quot;)
          </h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Content that powers the &quot;Why This Campaign?&quot; and impact sections on the public
            campaign page.
          </p>
        </div>

        {/* About This Campaign: Images & Video */}
        <div className="border-border/80 bg-muted/20 space-y-4 rounded-xl border p-4">
          <div>
            <h4 className="text-foreground flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="text-primary size-4" />
              About This Campaign — Visual Media (Images &amp; Video)
            </h4>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Curate the carousel of photographs and video displayed under &quot;About This
              Campaign&quot; on the public page.
            </p>
          </div>

          <Field
            label="Campaign Video"
            name="videoUrl"
            errors={state.fieldErrors}
            hint="Optional. Upload a video file from your local machine (MP4, WebM, MOV up to 100MB). When uploaded, the video appears in the 'About This Campaign' gallery carousel."
          >
            <CampaignVideoUploadField initialUrl={campaign?.videoUrl ?? ''} />
          </Field>

          <Field
            label="Campaign Gallery Photographs"
            name="galleryImages"
            errors={state.fieldErrors}
            hint="Upload photos from your device or select existing photographs from your Media Library to show in the 'About This Campaign' carousel."
          >
            <CampaignGalleryPicker
              options={combinedMediaOptions}
              initialItems={initialGallery}
              onPhotoUploaded={(newMedia) => setExtraMedia((prev) => [newMedia, ...prev])}
            />
          </Field>
        </div>

        <Field
          label="Why This Campaign? (The Story)"
          name="description"
          errors={state.fieldErrors}
          hint="Powers the 'Why This Campaign?' card on the public campaign page. First paragraph becomes the lead. Separate paragraphs with blank lines."
        >
          <TextArea
            name="description"
            rows={8}
            defaultValue={campaign?.description ?? ''}
            placeholder="Write the campaign narrative here. Each paragraph separated by a blank line will display as a distinct paragraph under 'Why This Campaign?'..."
          />
        </Field>

        <Field
          label="What Will Your Support Provide?"
          name="supportProvides"
          errors={state.fieldErrors}
          hint="Powers the 'What Will Your Support Provide?' card on the public campaign page. Explains what donations deliver or fund. If left blank, it automatically summarizes the campaign's products."
        >
          <TextArea
            name="supportProvides"
            rows={4}
            defaultValue={campaign?.supportProvides ?? ''}
            placeholder="e.g. Your support pays for essential school kits, textbooks, and learning supplies delivered directly to underprivileged children..."
          />
        </Field>
      </div>

      <SubmitButton pending={pending}>{campaign ? 'Save changes' : 'Create campaign'}</SubmitButton>
    </form>
  );
}
