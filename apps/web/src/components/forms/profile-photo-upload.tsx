'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { IconCamera, IconX } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AVATAR_MAX_BYTES, AVATAR_TYPES, validateFile } from '@/components/forms/file-validation';

interface ProfilePhotoUploadProps {
  value: File | null;
  onChange: (file: File | null) => void;
  /** Existing remote avatar when no new file is selected. */
  existingUrl?: string | null;
  initials?: string;
  label?: string;
  description?: string;
  className?: string;
}

export function ProfilePhotoUpload({
  value,
  onChange,
  existingUrl,
  initials = '?',
  label = 'Profile photo',
  description = 'Optional — JPEG, PNG or WebP, up to 2 MB.',
  className,
}: ProfilePhotoUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const displayUrl = previewUrl ?? existingUrl ?? null;

  function handleFile(file: File | undefined) {
    if (!file) return;
    const validationError = validateFile(file, {
      allowedTypes: AVATAR_TYPES,
      maxBytes: AVATAR_MAX_BYTES,
    });
    if (validationError) {
      setError(
        validationError.includes('Unsupported')
          ? 'Use a JPEG, PNG, or WebP image'
          : 'Image must be 2 MB or smaller',
      );
      return;
    }
    setError(null);
    onChange(file);
  }

  return (
    <div className={cn('flex items-start gap-4', className)}>
      <div className="relative shrink-0">
        <div
          className={cn(
            'flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-muted text-lg font-semibold text-muted-foreground',
            displayUrl && 'border-primary/30',
          )}
        >
          {displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initials.slice(0, 2).toUpperCase()
          )}
        </div>
        {value ? (
          <button
            type="button"
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:text-foreground"
            onClick={() => {
              onChange(null);
              setError(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
            aria-label="Remove new photo"
          >
            <IconX className="h-3 w-3" />
          </button>
        ) : null}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description ? (
          <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => inputRef.current?.click()}
          >
            <IconCamera className="h-4 w-4" />
            {value || existingUrl ? 'Change photo' : 'Upload photo'}
          </Button>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}

/** Alias — same component as ProfilePhotoUpload. */
export const AvatarUpload = ProfilePhotoUpload;
