'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Loader2, Trash2, Upload, User } from 'lucide-react';
import { Alert } from '@sailent/ui';

interface ProfilePhotoCardProps {
  initialAvatarUrl?: string | null;
  name: string;
}

export function ProfilePhotoCard({ initialAvatarUrl, name }: ProfilePhotoCardProps) {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(initialAvatarUrl ?? null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isRemoving, setIsRemoving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  // Sync with prop when server updates
  React.useEffect(() => {
    setAvatarUrl(initialAvatarUrl ?? null);
  }, [initialAvatarUrl]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(null);

    // Client-side validations
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please select a JPG, PNG, or WebP image.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setError('That file is larger than 5 MB. Please choose a smaller image.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Instant local preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/bff/me/avatar', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || json.success === false) {
        throw new Error(json.error?.message || 'Could not upload photo. Please try again.');
      }

      const uploadedUrl = json.data?.avatarUrl || objectUrl;
      setAvatarUrl(uploadedUrl);
      setPreviewUrl(null);
      setSuccess('Your profile photo has been updated.');
      router.refresh();
    } catch (err) {
      setPreviewUrl(null);
      setError(err instanceof Error ? err.message : 'Could not upload photo. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    setError(null);
    setSuccess(null);
    setIsRemoving(true);

    try {
      const res = await fetch('/api/bff/me/avatar', {
        method: 'DELETE',
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || json.success === false) {
        throw new Error(json.error?.message || 'Could not remove photo. Please try again.');
      }

      setAvatarUrl(null);
      setPreviewUrl(null);
      setSuccess('Your profile photo has been removed.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove photo. Please try again.');
    } finally {
      setIsRemoving(false);
    }
  };

  const currentPhoto = previewUrl || avatarUrl;

  return (
    <div className="card-standard rounded-2xl p-6">
      {error ? (
        <div className="mb-4">
          <Alert variant="destructive" role="alert">
            {error}
          </Alert>
        </div>
      ) : null}
      {success ? (
        <div className="mb-4">
          <Alert variant="success" role="status">
            {success}
          </Alert>
        </div>
      ) : null}

      <div className="flex flex-row items-center gap-4 sm:items-start sm:gap-6">
        {/* Avatar circle with camera badge */}
        <div className="relative shrink-0">
          <div className="ring-border/30 relative flex size-20 items-center justify-center overflow-hidden rounded-full bg-slate-100 ring-2 sm:size-24 dark:bg-slate-800">
            {currentPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentPhoto}
                alt={name || 'Donor avatar'}
                className="size-full rounded-full object-cover"
              />
            ) : (
              <User
                className="size-12 text-slate-400 dark:text-slate-500"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            )}

            {isUploading || isRemoving ? (
              <div className="bg-background/70 backdrop-blur-xs absolute inset-0 flex items-center justify-center">
                <Loader2 className="text-primary size-6 animate-spin" aria-hidden="true" />
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isRemoving}
            title="Upload new photo"
            aria-label="Upload new photo"
            className="ring-surface bg-primary hover:bg-primary/90 text-primary-foreground focus-visible:outline-ring ring-3 absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full shadow-md transition-colors focus-visible:outline-2 disabled:opacity-50 sm:size-8"
          >
            <Camera className="size-3.5 stroke-[2] sm:size-4" aria-hidden="true" />
          </button>
        </div>

        {/* Text & Actions matching Mockup 4 */}
        <div className="min-w-0 flex-1 text-left">
          <h2 className="font-display text-foreground hidden text-lg font-bold sm:block sm:text-xl">
            Profile photo
          </h2>
          <p className="text-body-sm text-muted-foreground mt-0.5 hidden sm:block">
            This photo will be shown on your donor profile.
          </p>

          <div className="flex flex-col gap-2 sm:mt-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isRemoving}
              className="border-primary text-primary hover:bg-primary/10 focus-visible:outline-ring inline-flex items-center justify-center gap-2 rounded-full border px-5 py-1.5 text-xs font-bold transition-colors focus-visible:outline-2 disabled:opacity-50 sm:py-2 sm:text-sm"
            >
              {isUploading ? (
                <Loader2 className="size-3.5 animate-spin sm:size-4" aria-hidden="true" />
              ) : (
                <Upload className="size-3.5 stroke-[2] sm:size-4" aria-hidden="true" />
              )}
              <span>{avatarUrl ? 'Change photo' : 'Upload photo'}</span>
            </button>

            {avatarUrl ? (
              <button
                type="button"
                onClick={handleRemove}
                disabled={isUploading || isRemoving}
                className="border-border/80 hover:bg-muted text-foreground/85 focus-visible:outline-ring inline-flex items-center justify-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 disabled:opacity-50 sm:py-2 sm:text-sm"
              >
                {isRemoving ? (
                  <Loader2 className="size-3.5 animate-spin sm:size-4" aria-hidden="true" />
                ) : (
                  <Trash2 className="size-3.5 stroke-[2] sm:size-4" aria-hidden="true" />
                )}
                <span>Remove photo</span>
              </button>
            ) : null}
          </div>

          <p className="text-muted-foreground sm:text-caption mt-2 text-[0.6875rem]">
            JPG, PNG or WebP. Max size 5 MB.
          </p>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}
