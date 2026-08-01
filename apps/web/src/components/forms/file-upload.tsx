'use client';

import * as React from 'react';
import { IconUpload, IconX } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DOCUMENT_MAX_BYTES, validateFile } from '@/components/forms/file-validation';

export interface FileUploadProps {
  files: File[];
  onChange: (files: File[]) => void;
  accept?: string;
  allowedTypes?: Set<string>;
  maxBytes?: number;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  label?: string;
  description?: string;
}

export function FileUpload({
  files,
  onChange,
  accept,
  allowedTypes,
  maxBytes = DOCUMENT_MAX_BYTES,
  multiple = false,
  disabled = false,
  className,
  label = 'Upload files',
  description = 'Drag and drop or click to browse.',
}: FileUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);

  function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const incoming = Array.from(list);
    const next: File[] = multiple ? [...files] : [];
    for (const file of incoming) {
      if (allowedTypes || maxBytes) {
        const err = validateFile(file, {
          allowedTypes: allowedTypes ?? new Set([file.type]),
          maxBytes,
        });
        if (allowedTypes && err) {
          setError(err);
          return;
        }
        if (!allowedTypes) {
          const sizeErr = file.size > maxBytes ? validateFile(file, { allowedTypes: new Set(['*/*']), maxBytes }) : null;
          // size-only when no mime set
          if (file.size > maxBytes) {
            setError(`File must be ${Math.round(maxBytes / (1024 * 1024))} MB or smaller`);
            return;
          }
          void sizeErr;
        }
      }
      if (!multiple) {
        next.length = 0;
      }
      next.push(file);
    }
    setError(null);
    onChange(next);
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center transition-colors',
          dragging && 'border-primary bg-primary/5',
          disabled && 'opacity-50',
        )}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) addFiles(e.dataTransfer.files);
        }}
      >
        <IconUpload className="mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          Browse
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {files.length > 0 ? (
        <ul className="space-y-1">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate">
                {file.name}{' '}
                <span className="text-muted-foreground">
                  ({Math.round(file.size / 1024)} KB)
                </span>
              </span>
              <button
                type="button"
                className="ml-2 text-muted-foreground hover:text-foreground"
                onClick={() => onChange(files.filter((_, idx) => idx !== i))}
                aria-label={`Remove ${file.name}`}
              >
                <IconX className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
