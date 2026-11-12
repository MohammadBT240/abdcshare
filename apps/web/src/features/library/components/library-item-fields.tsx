'use client';

import { IconLock, IconWorld } from '@tabler/icons-react';
import { AppSelect, FormField, MultiCombobox } from '@/components/forms';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useDepartments } from '@/features/users/hooks/use-users';
import { useLibraryCategories } from '@/features/library/hooks/use-library';
import { TagInput } from '@/features/library/components/tag-input';
import type { LibraryItem, LibraryItemFields, LibraryVisibility } from '@/features/library/types';

export interface LibraryFormState {
  title: string;
  categoryId: string;
  description: string;
  authors: string;
  year: string;
  source: string;
  tags: string[];
  visibility: LibraryVisibility;
  departmentIds: string[];
}

export const EMPTY_LIBRARY_FORM: LibraryFormState = {
  title: '',
  categoryId: '',
  description: '',
  authors: '',
  year: '',
  source: '',
  tags: [],
  visibility: 'Firm',
  departmentIds: [],
};

export function formFromItem(item: LibraryItem): LibraryFormState {
  return {
    title: item.title,
    categoryId: item.category.id,
    description: item.description ?? '',
    authors: item.authors ?? '',
    year: item.publishedYear ? String(item.publishedYear) : '',
    source: item.source ?? '',
    tags: item.tags,
    visibility: item.visibility,
    departmentIds: item.departments.map((d) => String(d.id)),
  };
}

export function fieldsFromForm(state: LibraryFormState): LibraryItemFields {
  const year = state.year.trim() ? Number(state.year) : null;
  return {
    title: state.title.trim(),
    categoryId: state.categoryId,
    description: state.description.trim() || null,
    authors: state.authors.trim() || null,
    publishedYear: year,
    source: state.source.trim() || null,
    tags: state.tags,
    visibility: state.visibility,
    departmentIds: state.visibility === 'Departments' ? state.departmentIds.map(Number) : [],
  };
}

const CURRENT_YEAR = new Date().getFullYear();

export function validateLibraryForm(state: LibraryFormState): string | null {
  if (!state.title.trim()) return 'Give the item a title';
  if (!state.categoryId) return 'Choose a category';
  if (state.year.trim()) {
    const y = Number(state.year);
    if (!Number.isInteger(y) || y < 1900 || y > CURRENT_YEAR + 1) return `Year must be between 1900 and ${CURRENT_YEAR + 1}`;
  }
  if (state.visibility === 'Departments' && state.departmentIds.length === 0) {
    return 'Choose at least one department, or make the item firm-wide';
  }
  return null;
}

function VisibilityOption({
  active,
  icon,
  title,
  hint,
  onClick,
  disabled,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex flex-1 items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
        active ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
        disabled && 'opacity-50',
      )}
    >
      <span className={cn('mt-0.5', active ? 'text-primary' : 'text-muted-foreground')}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

/** Firm-wide vs specific departments, shared by items and collections. */
export function VisibilityPicker({
  visibility,
  departmentIds,
  onChange,
  disabled,
  restrictedHint = 'Only those departments (plus you and curators).',
}: {
  visibility: LibraryVisibility;
  departmentIds: string[];
  onChange: (next: { visibility: LibraryVisibility; departmentIds: string[] }) => void;
  disabled?: boolean;
  restrictedHint?: string;
}) {
  const departments = useDepartments();
  return (
    <>
      <FormField label="Who can see this">
        <div role="radiogroup" className="flex flex-col gap-2 sm:flex-row">
          <VisibilityOption
            active={visibility === 'Firm'}
            icon={<IconWorld className="h-4 w-4" />}
            title="Everyone in the firm"
            hint="All staff can find and open it."
            onClick={() => onChange({ visibility: 'Firm', departmentIds: [] })}
            disabled={disabled}
          />
          <VisibilityOption
            active={visibility === 'Departments'}
            icon={<IconLock className="h-4 w-4" />}
            title="Specific departments"
            hint={restrictedHint}
            onClick={() => onChange({ visibility: 'Departments', departmentIds })}
            disabled={disabled}
          />
        </div>
      </FormField>
      {visibility === 'Departments' ? (
        <FormField label="Departments" required>
          <MultiCombobox
            options={(departments.data ?? [])
              .filter((d) => d.isActive)
              .map((d) => ({ value: String(d.id), label: d.name }))}
            values={departmentIds}
            onValuesChange={(ids) => onChange({ visibility, departmentIds: ids })}
            placeholder="Choose departments"
            isLoading={departments.isPending}
            disabled={disabled}
          />
        </FormField>
      ) : null}
    </>
  );
}

/** Metadata fields shared by the upload and edit dialogs. */
export function LibraryItemFieldsForm({
  value,
  onChange,
  disabled,
}: {
  value: LibraryFormState;
  onChange: (next: LibraryFormState) => void;
  disabled?: boolean;
}) {
  const categories = useLibraryCategories();
  const set = <K extends keyof LibraryFormState>(key: K, v: LibraryFormState[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="space-y-4">
      <FormField label="Title" required htmlFor="library-title">
        <Input
          id="library-title"
          value={value.title}
          onChange={(e) => set('title', e.target.value)}
          maxLength={300}
          disabled={disabled}
          placeholder="e.g. IFRS 17 implementation guide"
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Category" required>
          <AppSelect
            options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            value={value.categoryId}
            onValueChange={(v) => set('categoryId', v)}
            placeholder="Choose a category"
            isLoading={categories.isPending}
            disabled={disabled}
          />
        </FormField>
        <FormField label="Year" htmlFor="library-year" hint="Year of publication, if known.">
          <Input
            id="library-year"
            inputMode="numeric"
            value={value.year}
            onChange={(e) => set('year', e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
            placeholder={String(CURRENT_YEAR)}
            disabled={disabled}
          />
        </FormField>
      </div>

      <FormField label="Description" htmlFor="library-description" hint="What is it and when is it useful?">
        <Textarea
          id="library-description"
          value={value.description}
          onChange={(e) => set('description', e.target.value)}
          maxLength={5000}
          rows={3}
          disabled={disabled}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Author(s)" htmlFor="library-authors">
          <Input
            id="library-authors"
            value={value.authors}
            onChange={(e) => set('authors', e.target.value)}
            maxLength={500}
            placeholder="e.g. Deloitte, IFRS Foundation"
            disabled={disabled}
          />
        </FormField>
        <FormField label="Source" htmlFor="library-source">
          <Input
            id="library-source"
            value={value.source}
            onChange={(e) => set('source', e.target.value)}
            maxLength={500}
            placeholder="Publisher, journal or link"
            disabled={disabled}
          />
        </FormField>
      </div>

      <FormField label="Tags" htmlFor="library-tags" hint="Press Enter or comma to add. Up to 20.">
        <TagInput id="library-tags" value={value.tags} onChange={(tags) => set('tags', tags)} disabled={disabled} />
      </FormField>

      <VisibilityPicker
        visibility={value.visibility}
        departmentIds={value.departmentIds}
        onChange={(v) => onChange({ ...value, ...v })}
        disabled={disabled}
      />
    </div>
  );
}
