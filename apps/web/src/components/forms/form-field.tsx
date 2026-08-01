'use client';

import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

interface FormFieldProps {
  label: string;
  required?: boolean;
  /** Shown below the control so side-by-side fields stay aligned. */
  description?: string;
  /** Alias for description — also shown below the control. */
  hint?: string;
  error?: string;
  htmlFor?: string;
  labelRight?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function FormField({
  label,
  required,
  description,
  hint,
  error,
  htmlFor,
  labelRight,
  className,
  children,
}: FormFieldProps) {
  const helper = description ?? hint;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor}>
          {label}
          {required ? (
            <span className="ml-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          ) : null}
        </Label>
        {labelRight}
      </div>
      {children}
      {helper && !error ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{helper}</p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

interface FormSectionProps {
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}

export function FormSection({ title, description, className, children }: FormSectionProps) {
  return (
    <section className={cn('space-y-4 rounded-lg border border-border bg-muted/20 p-4', className)}>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
