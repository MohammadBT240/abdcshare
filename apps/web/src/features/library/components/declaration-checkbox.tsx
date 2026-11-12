'use client';

import { useId, useState } from 'react';
import { DECLARATION_TEXT } from '@/features/library/lib/licence';

/**
 * Upload declaration (S2, D18): required on every upload and file replacement.
 * The API refuses uploads without it; the guidance explains what counts.
 */
export function DeclarationCheckbox({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const guidanceId = useId();
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm">
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={open ? guidanceId : undefined}
        />
        <span>{DECLARATION_TEXT}</span>
      </label>
      <button
        type="button"
        className="ml-6 mt-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
        aria-expanded={open}
        aria-controls={guidanceId}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Hide guidance' : 'What counts as client-identifiable?'}
      </button>
      {open ? (
        <div id={guidanceId} className="ml-6 mt-2 space-y-1.5 text-xs text-muted-foreground">
          <p>
            Client names, logos, engagement letters, working papers, financial statements or figures that point to a
            specific client, and personal data about a client&apos;s staff.
          </p>
          <p>
            Anonymise the file first, or choose <span className="font-medium text-foreground">Specific departments</span>{' '}
            so only the people who need it can see it. If you are unsure, ask a library curator before uploading.
          </p>
        </div>
      ) : null}
    </div>
  );
}
