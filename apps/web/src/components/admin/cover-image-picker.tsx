'use client';

import * as React from 'react';
import {
  Check,
  Globe,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  List,
  Lock,
  Plus,
  Search,
  Upload,
  UploadCloud,
  X,
} from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
  formatBytes,
  formatDate,
  Spinner,
} from '@sailent/ui';

import { errorText } from '@/lib/feedback/error-messages';
import { uploadMediaDirect, type DirectUploadResult } from '@/lib/admin/actions';
import type { AdminMedia } from '@/lib/admin/api';

function fileExtension(mimeType: string, url: string | null | undefined): string {
  if (url) {
    const match = url.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
    if (match?.[1]) return match[1].toUpperCase();
  }
  if (mimeType.includes('/')) {
    const sub = mimeType.split('/')[1]!;
    return (sub === 'jpeg' ? 'jpg' : sub).toUpperCase();
  }
  return 'FILE';
}

/**
 * Upload a local image file directly via the BFF (/api/bff/admin/media),
 * falling back to the server action uploadMediaDirect if needed.
 */
async function uploadMediaFile(
  file: File,
  altText?: string,
  caption?: string,
): Promise<DirectUploadResult> {
  const fd = new FormData();
  fd.append('file', file, file.name);
  const fallbackAlt =
    altText?.trim() ||
    file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .trim() ||
    'Uploaded photograph';
  fd.append('altText', fallbackAlt);
  if (caption?.trim()) {
    fd.append('caption', caption.trim());
  }
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
    return uploadMediaDirect(fd);
  }
}

export interface CoverImagePickerProps {
  name?: string;
  label?: string;
  hint?: string;
  value?: string | null;
  options?: AdminMedia[];
  error?: string;
  required?: boolean;
  activeBadge?: string;
  onSelect?: (media: AdminMedia | null) => void;
}

export function CoverImagePicker({
  name = 'coverImage',
  label = 'Upload image',
  hint = 'Select a high-quality photograph from the media library or upload directly from your device.',
  value,
  options = [],
  error,
  required,
  activeBadge = 'Active program cover image',
  onSelect,
}: CoverImagePickerProps) {
  const [allOptions, setAllOptions] = React.useState<AdminMedia[]>(options);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [filterVisibility, setFilterVisibility] = React.useState<'all' | 'public' | 'private'>(
    'all',
  );
  const [search, setSearch] = React.useState('');
  const [showUploadPanel, setShowUploadPanel] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  // Upload fields
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = React.useState<string | null>(null);
  const [uploadAlt, setUploadAlt] = React.useState('');
  const [uploadCaption, setUploadCaption] = React.useState('');
  const [isDragOver, setIsDragOver] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const modalFileInputRef = React.useRef<HTMLInputElement>(null);

  // Sync incoming options without clobbering newly uploaded ones
  React.useEffect(() => {
    setAllOptions((prev) => {
      const existingIds = new Set(prev.map((o) => o.id));
      const newItems = options.filter((o) => !existingIds.has(o.id));
      return [...newItems, ...prev];
    });
  }, [options]);

  // Fetch all available media from BFF whenever modal is opened
  React.useEffect(() => {
    if (isModalOpen) {
      fetch('/api/bff/admin/media?limit=100')
        .then((res) => (res.ok ? res.json() : null))
        .then((payload) => {
          if (payload?.success && Array.isArray(payload.data?.items)) {
            setAllOptions((prev) => {
              const fetched: AdminMedia[] = payload.data.items;
              const fetchedIds = new Set(fetched.map((f) => f.id));
              const localAdded = prev.filter((item) => !fetchedIds.has(item.id));
              return [...localAdded, ...fetched];
            });
          }
        })
        .catch(() => {
          // Fallback to options
        });
    }
  }, [isModalOpen]);

  // Match initial selection from existing options, or synthesize if a URL exists
  const initialSelected = React.useMemo(() => {
    if (!value) return null;
    const match = allOptions.find((item) => item.url === value);
    if (match) return match;
    const synthetic: AdminMedia = {
      id: 'current-cover',
      storageKey: 'current-cover',
      altText: 'Selected photograph',
      caption: null,
      width: null,
      height: null,
      url: value,
      visibility: 'public',
      sizeBytes: 0,
      mimeType: 'image/jpeg',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return synthetic;
  }, [value, allOptions]);

  const [selectedCover, setSelectedCover] = React.useState<AdminMedia | null>(initialSelected);
  const [modalSelected, setModalSelected] = React.useState<AdminMedia | null>(initialSelected);

  // Keep selectedCover in sync if parent value prop changes
  React.useEffect(() => {
    if (value === undefined) return;
    if (!value) {
      setSelectedCover(null);
    } else {
      const match = allOptions.find((item) => item.url === value);
      if (match) {
        setSelectedCover(match);
      } else {
        setSelectedCover({
          id: 'current-cover',
          storageKey: 'current-cover',
          altText: 'Selected photograph',
          caption: null,
          width: null,
          height: null,
          url: value,
          visibility: 'public',
          sizeBytes: 0,
          mimeType: 'image/jpeg',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }, [value, allOptions]);

  // Clean up object preview URL
  React.useEffect(() => {
    return () => {
      if (uploadPreviewUrl) {
        URL.revokeObjectURL(uploadPreviewUrl);
      }
    };
  }, [uploadPreviewUrl]);

  // Filter options based on visibility tab and search query
  const filteredOptions = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return allOptions.filter((item) => {
      if (filterVisibility !== 'all' && item.visibility !== filterVisibility) {
        return false;
      }
      if (!q) return true;
      return (
        item.altText.toLowerCase().includes(q) ||
        (item.caption && item.caption.toLowerCase().includes(q))
      );
    });
  }, [allOptions, filterVisibility, search]);

  const countPublic = React.useMemo(
    () => allOptions.filter((item) => item.visibility === 'public').length,
    [allOptions],
  );
  const countPrivate = React.useMemo(
    () => allOptions.filter((item) => item.visibility === 'private').length,
    [allOptions],
  );

  const handleSelect = (item: AdminMedia | null) => {
    setSelectedCover(item);
    onSelect?.(item);
  };

  const openModal = (startWithUpload = false) => {
    setModalSelected(selectedCover);
    setShowUploadPanel(startWithUpload);
    setUploadError(null);
    setSearch('');
    setIsModalOpen(true);
  };

  const handleConfirmModalSelection = () => {
    handleSelect(modalSelected);
    setIsModalOpen(false);
  };

  const handleSelectUploadFile = (file: File) => {
    setUploadFile(file);
    if (uploadPreviewUrl) {
      URL.revokeObjectURL(uploadPreviewUrl);
    }
    setUploadPreviewUrl(URL.createObjectURL(file));

    // Pre-populate readable alt text from filename if empty
    if (!uploadAlt.trim()) {
      const cleanName = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]+/g, ' ')
        .trim();
      setUploadAlt(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }
    setUploadError(null);
  };

  const handleModalUploadSubmit = async () => {
    if (!uploadFile) return;
    if (!uploadAlt.trim()) {
      setUploadError('Alt text is required so screen readers can describe this photograph.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const res = await uploadMediaFile(uploadFile, uploadAlt, uploadCaption);
      if (res.ok && res.media && res.media.url) {
        const newMedia = res.media;
        setAllOptions((prev) => [newMedia, ...prev.filter((m) => m.id !== newMedia.id)]);
        handleSelect(newMedia);
        setUploadFile(null);
        setUploadAlt('');
        setUploadCaption('');
        if (uploadPreviewUrl) {
          URL.revokeObjectURL(uploadPreviewUrl);
          setUploadPreviewUrl(null);
        }
        setShowUploadPanel(false);
        setIsModalOpen(false);
      } else {
        setUploadError(res.error || 'Failed to upload photo.');
      }
    } catch (err) {
      setUploadError(errorText(err, 'Couldn’t upload the photo. Try again.'));
    } finally {
      setIsUploading(false);
    }
  };

  // Direct file input change (uploads local file directly from device without opening modal)
  const handleDirectFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const cleanName = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]+/g, ' ')
        .trim();
      const altText = cleanName
        ? cleanName.charAt(0).toUpperCase() + cleanName.slice(1)
        : 'Uploaded photograph';

      const res = await uploadMediaFile(file, altText);
      if (res.ok && res.media && res.media.url) {
        const newMedia = res.media;
        setAllOptions((prev) => [newMedia, ...prev.filter((m) => m.id !== newMedia.id)]);
        handleSelect(newMedia);
      } else {
        setUploadError(res.error || 'Failed to upload photo.');
      }
    } catch (err) {
      setUploadError(errorText(err, 'Couldn’t upload the photo. Try again.'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-body-sm text-foreground block font-medium">
          {label}
          {required ? (
            <span className="text-destructive ml-0.5" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
        {hint ? <p className="text-caption text-muted-foreground mt-0.5">{hint}</p> : null}
      </div>

      {/* Hidden input to pass coverImage URL to form submission */}
      <input type="hidden" name={name} value={selectedCover?.url ?? ''} />
      {required ? (
        <input
          tabIndex={-1}
          autoComplete="off"
          style={{
            position: 'absolute',
            opacity: 0,
            pointerEvents: 'none',
            width: 1,
            height: 1,
            margin: -1,
            padding: 0,
            border: 0,
          }}
          value={selectedCover?.url ?? ''}
          required={required}
          onChange={() => {}}
          onFocus={() => openModal(false)}
          aria-hidden="true"
        />
      ) : null}

      {/* Hidden file input for direct device upload trigger */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={isUploading}
        onChange={handleDirectFileChange}
      />

      {/* Selected Cover Display */}
      {selectedCover && selectedCover.url ? (
        <div className="border-border bg-surface shadow-xs flex flex-col items-start gap-4 rounded-xl border p-4 sm:flex-row sm:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedCover.url}
            alt={selectedCover.altText}
            className="border-border aspect-[16/10] h-24 w-full shrink-0 rounded-lg border object-cover sm:w-36"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="neutral" className="text-xs">
                {activeBadge}
              </Badge>
              {selectedCover.width && selectedCover.height ? (
                <span className="text-caption text-muted-foreground">
                  {selectedCover.width} × {selectedCover.height} px
                </span>
              ) : null}
            </div>
            <p
              className="text-body-sm text-foreground truncate font-semibold"
              title={selectedCover.altText}
            >
              {selectedCover.altText}
            </p>
            {selectedCover.caption ? (
              <p className="text-caption text-muted-foreground line-clamp-1 italic">
                {selectedCover.caption}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => openModal(false)}
                className="text-caption text-primary hover:text-primary-hover inline-flex cursor-pointer items-center gap-1.5 font-medium underline transition-colors"
              >
                <ImageIcon className="size-3.5" />
                Change image
              </button>
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className="text-caption text-muted-foreground hover:text-destructive inline-flex cursor-pointer items-center gap-1.5 underline transition-colors"
              >
                <X className="size-3.5" />
                Remove image
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onClick={() => openModal(false)}
          className={cn(
            'border-border hover:border-primary/60 hover:bg-muted/30 group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all',
            error ? 'border-destructive/60 bg-destructive/5' : '',
          )}
        >
          <div className="bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground flex size-12 items-center justify-center rounded-full transition-colors">
            <ImageIcon className="size-6" />
          </div>
          <p className="text-body-sm text-foreground mt-3 font-semibold">No image selected</p>
          <p className="text-caption text-muted-foreground mt-1 max-w-sm">
            Choose a photograph from the media library or upload a new one from your device.
          </p>
        </div>
      )}

      {/* Action buttons: choose from library or upload from local device */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => openModal(false)}
          className="gap-2 font-medium"
        >
          <Plus className="text-primary size-4" />
          <span>Choose from media library</span>
        </Button>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="gap-2 font-medium"
        >
          {isUploading ? (
            <Spinner className="text-primary size-4" />
          ) : (
            <Upload className="text-primary size-4" />
          )}
          <span>{isUploading ? 'Uploading photo…' : 'Upload photo from device'}</span>
        </Button>
      </div>

      {uploadError ? <p className="text-destructive text-xs font-medium">{uploadError}</p> : null}
      {error ? <p className="text-destructive text-xs font-medium">{error}</p> : null}

      {/* Media Library Modal Dialog with the exact Media Library page design */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="border-border flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden p-0">
          {/* Header */}
          <DialogHeader className="border-border sm:pr-18 border-b p-5 pb-4 pr-16">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <DialogTitle className="text-h3 font-semibold">Media assets</DialogTitle>
                  <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
                    {allOptions.length}
                  </span>
                </div>
                <DialogDescription className="text-caption text-muted-foreground mt-1">
                  Public and private media assets. Choose an existing photograph or upload a new
                  one.
                </DialogDescription>
              </div>

              <div className="flex items-center gap-2 sm:mr-2">
                <Button
                  type="button"
                  variant={showUploadPanel ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={() => setShowUploadPanel(!showUploadPanel)}
                  className="gap-1.5"
                >
                  {showUploadPanel ? (
                    <>
                      <X className="size-4" />
                      <span>Close upload</span>
                    </>
                  ) : (
                    <>
                      <Plus className="size-4" />
                      <span>Upload an image</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Upload Panel (Dropdown / Collapsible section) */}
            {showUploadPanel ? (
              <div className="border-border bg-surface-sunken/40 mt-4 space-y-4 rounded-xl border p-4">
                <input
                  ref={modalFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={isUploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleSelectUploadFile(file);
                  }}
                />

                {!uploadFile ? (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file && file.type.startsWith('image/')) {
                        handleSelectUploadFile(file);
                      }
                    }}
                    onClick={() => modalFileInputRef.current?.click()}
                    className={cn(
                      'hover:border-primary/70 hover:bg-muted/40 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all',
                      isDragOver ? 'border-primary bg-primary/5' : 'border-border bg-surface',
                    )}
                  >
                    <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full">
                      <UploadCloud className="size-5" />
                    </div>
                    <p className="text-body-sm text-foreground mt-2 font-semibold">
                      Drag and drop your image here, or{' '}
                      <span className="text-primary underline">browse</span>
                    </p>
                    <p className="text-caption text-muted-foreground mt-0.5">
                      Supports PNG, JPG, or WEBP up to 10 MB.
                    </p>
                  </div>
                ) : (
                  <div className="border-border bg-surface shadow-xs space-y-3 rounded-xl border p-4">
                    <div className="flex items-center gap-3">
                      {uploadPreviewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={uploadPreviewUrl}
                          alt="Upload preview"
                          className="border-border size-16 shrink-0 rounded-lg border object-cover"
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <p className="text-body-sm text-foreground truncate font-semibold">
                          {uploadFile.name}
                        </p>
                        <p className="text-caption text-muted-foreground mt-0.5">
                          {formatBytes(uploadFile.size)} · {uploadFile.type}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadFile(null);
                            if (uploadPreviewUrl) {
                              URL.revokeObjectURL(uploadPreviewUrl);
                              setUploadPreviewUrl(null);
                            }
                          }}
                          className="text-caption text-muted-foreground hover:text-destructive mt-1 inline-flex items-center gap-1 underline transition-colors"
                        >
                          <X className="size-3" />
                          Choose different file
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="modal-alt-text" className="text-xs">
                          Alt text <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="modal-alt-text"
                          value={uploadAlt}
                          onChange={(e) => setUploadAlt(e.target.value)}
                          placeholder="Describe photograph for screen readers..."
                          className="h-9 text-xs"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="modal-caption" className="text-xs">
                          Caption (optional)
                        </Label>
                        <Input
                          id="modal-caption"
                          value={uploadCaption}
                          onChange={(e) => setUploadCaption(e.target.value)}
                          placeholder="Optional photograph caption or credit..."
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setUploadFile(null);
                          setShowUploadPanel(false);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={handleModalUploadSubmit}
                        disabled={isUploading || !uploadFile || !uploadAlt.trim()}
                        className="gap-2"
                      >
                        {isUploading ? (
                          <Spinner className="size-3.5" />
                        ) : (
                          <Upload className="size-3.5" />
                        )}
                        <span>{isUploading ? 'Uploading…' : 'Upload & Use Photograph'}</span>
                      </Button>
                    </div>
                  </div>
                )}

                {uploadError ? (
                  <Alert variant="destructive" role="alert" className="text-xs">
                    {uploadError}
                  </Alert>
                ) : null}
              </div>
            ) : null}

            {/* Filter and Search Bar (matching Media Library page 1:1) */}
            <div className="border-border/70 bg-surface shadow-xs mt-3 flex flex-col gap-3 rounded-xl border p-2.5 sm:flex-row sm:items-center sm:justify-between">
              {/* Visibility Pills */}
              <nav
                aria-label="Filter by visibility"
                className="flex flex-wrap items-center gap-1.5"
              >
                <button
                  type="button"
                  onClick={() => setFilterVisibility('all')}
                  className={`text-caption flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
                    filterVisibility === 'all'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Layers className="size-3.5" />
                  <span>All assets</span>
                  <span className="py-0.2 bg-surface/20 rounded-full px-1.5 text-[10px]">
                    {allOptions.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterVisibility('public')}
                  className={`text-caption flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
                    filterVisibility === 'public'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Globe className="size-3.5" />
                  <span>Public</span>
                  <span className="py-0.2 bg-surface/20 rounded-full px-1.5 text-[10px]">
                    {countPublic}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterVisibility('private')}
                  className={`text-caption flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
                    filterVisibility === 'private'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Lock className="size-3.5" />
                  <span>Private</span>
                  <span className="py-0.2 bg-surface/20 rounded-full px-1.5 text-[10px]">
                    {countPrivate}
                  </span>
                </button>
              </nav>

              {/* Search & View Mode Switcher */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-64">
                  <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search alt text, caption..."
                    aria-label="Search media"
                    className="border-input bg-surface text-body-sm shadow-xs focus-visible:outline-ring h-8 w-full rounded-md border pl-8 pr-7 text-xs focus-visible:outline-2"
                  />
                  {search ? (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      aria-label="Clear search"
                      className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2 p-0.5"
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                </div>

                <div className="border-border bg-muted/40 flex items-center rounded-lg border p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={cn(
                      'flex size-7 items-center justify-center rounded-md transition-colors',
                      viewMode === 'grid'
                        ? 'bg-surface text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                    title="Grid view"
                  >
                    <LayoutGrid className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={cn(
                      'flex size-7 items-center justify-center rounded-md transition-colors',
                      viewMode === 'list'
                        ? 'bg-surface text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                    title="List view"
                  >
                    <List className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Modal Content: Media Tiles matching Media Library Page */}
          <div className="flex-1 overflow-y-auto p-5">
            {filteredOptions.length === 0 ? (
              <div className="border-border/80 bg-surface/50 rounded-2xl border border-dashed px-4 py-12 text-center">
                <div className="bg-muted text-muted-foreground mx-auto mb-3 grid size-12 place-items-center rounded-full">
                  {search ? <Search className="size-6" /> : <ImageIcon className="size-6" />}
                </div>
                <h3 className="text-body-lg text-foreground font-semibold">
                  {search ? `No image matches “${search}”.` : 'No media assets found in this view.'}
                </h3>
                <p className="text-body-sm text-muted-foreground mx-auto mt-1 max-w-sm">
                  {search
                    ? 'Try adjusting your search query or switching the visibility filter.'
                    : 'Get started by uploading an image from your computer to use across the site.'}
                </p>
                {search ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearch('')}
                    className="mt-3 text-xs"
                  >
                    Clear search filter
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => setShowUploadPanel(true)}
                    className="mt-4 gap-2"
                  >
                    <Plus className="size-4" />
                    <span>Upload an image now</span>
                  </Button>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              /* Grid view matching MediaTile 1:1 */
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {filteredOptions.map((item) => {
                  const src = item.url ?? null;
                  const ext = fileExtension(item.mimeType, item.url);
                  const isSelected =
                    modalSelected?.id === item.id || modalSelected?.url === item.url;

                  return (
                    <div
                      key={item.id}
                      onClick={() => setModalSelected(isSelected ? null : item)}
                      onDoubleClick={() => {
                        handleSelect(item);
                        setIsModalOpen(false);
                      }}
                      className={cn(
                        'group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
                        isSelected
                          ? 'border-primary ring-primary/40 bg-primary/5 shadow-md ring-2'
                          : 'border-border/70 bg-surface hover:border-primary/50 shadow-xs',
                      )}
                    >
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

                        {/* Selected Checkmark Badge */}
                        {isSelected ? (
                          <div className="bg-primary text-primary-foreground absolute bottom-2.5 right-2.5 flex size-7 items-center justify-center rounded-full shadow-md">
                            <Check className="size-4 stroke-[3]" />
                          </div>
                        ) : null}
                      </div>

                      {/* Card Details (matching MediaTile) */}
                      <div className="flex flex-1 flex-col justify-between p-3.5">
                        <div>
                          <p
                            className={cn(
                              'text-body-sm line-clamp-1 font-semibold transition-colors',
                              isSelected
                                ? 'text-primary'
                                : 'text-foreground group-hover:text-primary',
                            )}
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
                })}
              </div>
            ) : (
              /* List / Table view matching MediaGallery table */
              <Card className="border-border/70 overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="w-16">Preview</TableHead>
                        <TableHead>File details</TableHead>
                        <TableHead>Format & size</TableHead>
                        <TableHead>Dimensions</TableHead>
                        <TableHead>Visibility</TableHead>
                        <TableHead>Uploaded</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOptions.map((item) => {
                        const src = item.url ?? null;
                        const isSelected =
                          modalSelected?.id === item.id || modalSelected?.url === item.url;
                        return (
                          <TableRow
                            key={item.id}
                            onClick={() => setModalSelected(isSelected ? null : item)}
                            className={cn(
                              'cursor-pointer transition-colors',
                              isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/40',
                            )}
                          >
                            <TableCell>
                              <div className="border-border bg-muted/40 relative size-12 overflow-hidden rounded-md border">
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
                            </TableCell>

                            <TableCell className="max-w-[260px]">
                              <p
                                className={cn(
                                  'truncate font-semibold transition-colors',
                                  isSelected ? 'text-primary' : 'text-foreground',
                                )}
                                title={item.altText}
                              >
                                {item.altText}
                              </p>
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
                              <Button
                                type="button"
                                variant={isSelected ? 'primary' : 'secondary'}
                                size="sm"
                                className="text-caption h-8 px-2.5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setModalSelected(isSelected ? null : item);
                                }}
                              >
                                {isSelected ? (
                                  <>
                                    <Check className="size-3.5" />
                                    <span>Selected</span>
                                  </>
                                ) : (
                                  <span>Select</span>
                                )}
                              </Button>
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

          {/* Footer */}
          <DialogFooter className="border-border bg-surface-sunken/60 flex flex-row items-center justify-between border-t p-4 sm:justify-between">
            <div className="min-w-0 flex-1 pr-3">
              {modalSelected ? (
                <div className="flex items-center gap-3">
                  {modalSelected.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={modalSelected.url}
                      alt={modalSelected.altText}
                      className="border-border size-9 shrink-0 rounded-md border object-cover"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <p className="text-body-sm text-foreground truncate font-semibold">
                      {modalSelected.altText}
                    </p>
                    <p className="text-caption text-muted-foreground line-clamp-1">
                      {modalSelected.visibility === 'public' ? 'Public asset' : 'Private asset'}
                      {modalSelected.width && modalSelected.height
                        ? ` · ${modalSelected.width} × ${modalSelected.height} px`
                        : ''}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-caption text-muted-foreground italic">No image selected</p>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleConfirmModalSelection}
                disabled={!modalSelected}
                className="gap-1.5"
              >
                <Check className="size-4" />
                <span>Use selected image</span>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
