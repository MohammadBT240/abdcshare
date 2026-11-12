'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { IconTag, IconX } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { useLibraryTags } from '@/features/library/hooks/use-library';
import { normalizeTag } from '@/features/library/lib/library-files';

const MAX_TAGS = 20;

/**
 * Free-form tags with suggestions from tags already used in the library.
 * Enter / comma / Tab adds; Backspace on an empty input removes the last tag.
 */
export function TagInput({
  value,
  onChange,
  disabled,
  id,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
  id?: string;
}) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestions = useLibraryTags(draft, focused);

  const options = useMemo(
    () => (suggestions.data ?? []).filter((t) => !value.includes(t.tag)).slice(0, 6),
    [suggestions.data, value],
  );

  function add(raw: string) {
    const tags = raw
      .split(',')
      .map(normalizeTag)
      .filter(Boolean);
    if (tags.length === 0) return;
    const next = [...value];
    for (const tag of tags) {
      if (!next.includes(tag) && next.length < MAX_TAGS) next.push(tag);
    }
    onChange(next);
    setDraft('');
    setHighlight(0);
  }

  function remove(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  const showMenu = focused && options.length > 0 && !disabled;

  return (
    <div className="relative">
      <div
        className={cn(
          'flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-primary/5 px-2 py-1.5 text-sm transition-colors',
          'focus-within:bg-card focus-within:ring-2 focus-within:ring-ring',
          disabled && 'opacity-50',
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
          >
            {tag}
            {!disabled ? (
              <button
                type="button"
                className="rounded text-primary/70 hover:text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(tag);
                }}
                aria-label={`Remove tag ${tag}`}
              >
                <IconX className="h-3 w-3" />
              </button>
            ) : null}
          </span>
        ))}
        <input
          ref={inputRef}
          id={inputId}
          value={draft}
          disabled={disabled || value.length >= MAX_TAGS}
          onChange={(e) => {
            setDraft(e.target.value);
            setHighlight(0);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Let a suggestion click land before closing; keep typed text as a tag.
            setTimeout(() => setFocused(false), 120);
            if (draft.trim()) add(draft);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && options.length) {
              e.preventDefault();
              setHighlight((h) => (h + 1) % options.length);
            } else if (e.key === 'ArrowUp' && options.length) {
              e.preventDefault();
              setHighlight((h) => (h - 1 + options.length) % options.length);
            } else if (e.key === 'Enter' || e.key === ',' || (e.key === 'Tab' && draft.trim())) {
              if (!draft.trim() && e.key !== 'Enter') return;
              e.preventDefault();
              const picked = showMenu && draft.trim() === '' ? options[highlight]?.tag : null;
              add(picked ?? draft);
            } else if (e.key === 'Backspace' && !draft && value.length) {
              remove(value[value.length - 1]!);
            }
          }}
          placeholder={value.length ? '' : 'e.g. ifrs, tax, banking'}
          className="h-7 min-w-[8rem] flex-1 bg-transparent px-1 outline-none placeholder:text-muted-foreground"
          aria-autocomplete="list"
          aria-expanded={showMenu}
        />
      </div>
      {showMenu ? (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover py-1 text-sm shadow-md"
        >
          {options.map((opt, i) => (
            <li key={opt.tag} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(opt.tag)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted',
                  i === highlight && 'bg-muted',
                )}
              >
                <IconTag className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                <span className="flex-1 truncate">{opt.tag}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{opt.count}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
