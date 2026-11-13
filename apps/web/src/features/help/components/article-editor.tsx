'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import {
  IconAlertTriangle,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconBold,
  IconBulb,
  IconCode,
  IconH2,
  IconH3,
  IconInfoCircle,
  IconItalic,
  IconLink,
  IconList,
  IconListNumbers,
  IconPhoto,
  IconTable,
  IconTableMinus,
} from '@tabler/icons-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ROLE_NAMES } from '@abdcshare/shared';
import { HELP_TIPTAP_EXTENSIONS, type CalloutVariant } from '../lib/tiptap-extensions';
import { extractPlainText } from '../lib/plain-text';
import { useUploadHelpImage } from '../hooks/use-help-image-upload';
import type { HelpCategory, HelpSource } from '../types';

export interface ArticleFormValues {
  title: string;
  slug: string;
  summary: string | null;
  categoryId: string;
  bodyJson: Record<string, unknown>;
  bodyText: string;
  visibleToRoles: string[];
}

export interface ArticleEditorProps {
  categories: HelpCategory[];
  initial?: Partial<ArticleFormValues> & { source?: HelpSource };
  onSubmit: (values: ArticleFormValues) => void;
  submitting?: boolean;
  error?: string | null;
}

const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] };

/** Roles plus the two partner designations (matched against a Super Admin's designation). */
const AUDIENCE: { value: string; label: string }[] = [
  ...ROLE_NAMES.map((r) => ({ value: r, label: r })),
  { value: 'Partner', label: 'Partners' },
  { value: 'PrincipalPartner', label: 'Principal Partner' },
];

/** Image `src` is a short-lived presigned URL resolved on read — store only the storage key. */
function stripImageSrc(node: Record<string, unknown>): Record<string, unknown> {
  const attrs = node.attrs as Record<string, unknown> | undefined;
  const next: Record<string, unknown> = { ...node };
  if (node.type === 'image' && attrs?.storageKey) next.attrs = { ...attrs, src: null };
  if (Array.isArray(node.content)) next.content = (node.content as Record<string, unknown>[]).map(stripImageSrc);
  return next;
}

function Tool({
  label,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn('h-8 w-8 p-0', active && 'bg-muted text-primary')}
    >
      {children}
    </Button>
  );
}

function Toolbar({ editor, onImage, uploading }: { editor: Editor | null; onImage: () => void; uploading: boolean }) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const rerender = () => force((n) => n + 1);
    editor.on('selectionUpdate', rerender);
    editor.on('transaction', rerender);
    return () => {
      editor.off('selectionUpdate', rerender);
      editor.off('transaction', rerender);
    };
  }, [editor]);
  if (!editor) return null;
  const chain = () => editor.chain().focus();
  const callout = (v: CalloutVariant) => () =>
    editor.isActive('callout', { variant: v }) ? chain().unsetCallout().run() : chain().setCallout(v).run();

  const setLink = () => {
    const prev = (editor.getAttributes('link').href as string | undefined) ?? '';
    const href = window.prompt('Link address — another help article (/help/slug), a page (/library) or https://…', prev);
    if (href === null) return;
    if (!href.trim()) chain().extendMarkRange('link').unsetLink().run();
    else {
      const external = /^https?:\/\//i.test(href.trim());
      chain()
        .extendMarkRange('link')
        .setLink({ href: href.trim(), target: external ? '_blank' : null, rel: external ? 'noopener noreferrer nofollow' : null })
        .run();
    }
  };

  return (
    <div className="sticky top-14 z-10 flex flex-wrap items-center gap-0.5 border-b border-border bg-card/95 p-1.5 backdrop-blur" role="toolbar" aria-label="Formatting">
      <Tool label="Heading" active={editor.isActive('heading', { level: 2 })} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
        <IconH2 className="h-4 w-4" />
      </Tool>
      <Tool label="Sub-heading" active={editor.isActive('heading', { level: 3 })} onClick={() => chain().toggleHeading({ level: 3 }).run()}>
        <IconH3 className="h-4 w-4" />
      </Tool>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <Tool label="Bold" active={editor.isActive('bold')} onClick={() => chain().toggleBold().run()}>
        <IconBold className="h-4 w-4" />
      </Tool>
      <Tool label="Italic" active={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()}>
        <IconItalic className="h-4 w-4" />
      </Tool>
      <Tool label="Code / button name" active={editor.isActive('code')} onClick={() => chain().toggleCode().run()}>
        <IconCode className="h-4 w-4" />
      </Tool>
      <Tool label="Link" active={editor.isActive('link')} onClick={setLink}>
        <IconLink className="h-4 w-4" />
      </Tool>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <Tool label="Bulleted list" active={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()}>
        <IconList className="h-4 w-4" />
      </Tool>
      <Tool label="Numbered steps" active={editor.isActive('orderedList')} onClick={() => chain().toggleOrderedList().run()}>
        <IconListNumbers className="h-4 w-4" />
      </Tool>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <Tool label="Note box" active={editor.isActive('callout', { variant: 'note' })} onClick={callout('note')}>
        <IconInfoCircle className="h-4 w-4" />
      </Tool>
      <Tool label="Tip box" active={editor.isActive('callout', { variant: 'tip' })} onClick={callout('tip')}>
        <IconBulb className="h-4 w-4" />
      </Tool>
      <Tool label="Important box" active={editor.isActive('callout', { variant: 'warning' })} onClick={callout('warning')}>
        <IconAlertTriangle className="h-4 w-4" />
      </Tool>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <Tool label="Insert table" onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
        <IconTable className="h-4 w-4" />
      </Tool>
      {editor.isActive('table') ? (
        <>
          <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => chain().addRowAfter().run()}>
            + Row
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => chain().addColumnAfter().run()}>
            + Column
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => chain().deleteRow().run()}>
            − Row
          </Button>
          <Tool label="Delete table" onClick={() => chain().deleteTable().run()}>
            <IconTableMinus className="h-4 w-4" />
          </Tool>
        </>
      ) : null}
      <Tool label="Image" onClick={onImage} disabled={uploading}>
        <IconPhoto className="h-4 w-4" />
      </Tool>
      <span className="ml-auto flex">
        <Tool label="Undo" disabled={!editor.can().undo()} onClick={() => chain().undo().run()}>
          <IconArrowBackUp className="h-4 w-4" />
        </Tool>
        <Tool label="Redo" disabled={!editor.can().redo()} onClick={() => chain().redo().run()}>
          <IconArrowForwardUp className="h-4 w-4" />
        </Tool>
      </span>
    </div>
  );
}

export function ArticleEditor({ categories, initial, onSubmit, submitting, error }: ArticleEditorProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<string>(initial?.categoryId ?? categories[0]?.id ?? '');
  const [roles, setRoles] = useState<string[]>(initial?.visibleToRoles ?? []);
  const uploadImage = useUploadHelpImage();
  const [validationError, setValidationError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: HELP_TIPTAP_EXTENSIONS,
    content: initial?.bodyJson ?? EMPTY_DOC,
    immediatelyRender: false,
    editorProps: { attributes: { class: 'help-prose px-4 py-4 sm:px-6', 'aria-label': 'Article body' } },
  });

  useEffect(() => {
    if (editor && initial?.bodyJson) editor.commands.setContent(initial.bodyJson);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync when the loaded article identity changes
  }, [editor, initial?.slug]);

  const handleImagePick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !editor) return;
      const { storageKey } = await uploadImage.mutateAsync(file);
      // Show the picked file immediately; the stored doc keeps only the storage key.
      editor.chain().focus().setImage({ src: URL.createObjectURL(file), alt: file.name }).run();
      const pos = editor.state.selection.from - 1;
      editor
        .chain()
        .command(({ tr }) => {
          tr.setNodeAttribute(pos, 'storageKey', storageKey);
          return true;
        })
        .run();
    };
    input.click();
  };

  const handleSubmit = () => {
    if (!editor) return;
    const title = titleRef.current?.value.trim() ?? '';
    const slug = slugRef.current?.value.trim() ?? '';
    const categoryId = categoryRef.current;
    if (!title || !slug || !categoryId) {
      setValidationError('Title, slug, and category are required.');
      return;
    }
    setValidationError(null);
    const json = stripImageSrc(editor.getJSON() as Record<string, unknown>);
    onSubmit({
      title,
      slug,
      summary: summaryRef.current?.value.trim() || null,
      categoryId,
      bodyJson: json,
      bodyText: extractPlainText(json),
      visibleToRoles: roles,
    });
  };

  return (
    <div className="space-y-5">
      {initial?.source === 'default' ? (
        <Alert>
          <AlertDescription>
            This is a built-in article that ships with the app. Once you save changes here, newer versions shipped with app
            updates won&apos;t replace yours. To go back to the shipped version, use <strong>Restore default</strong> on the
            Help content page.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="help-title">Title</Label>
          <Input id="help-title" ref={titleRef} defaultValue={initial?.title} placeholder="e.g. Uploading to the library" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="help-summary">Summary</Label>
          <Input
            id="help-summary"
            ref={summaryRef}
            defaultValue={initial?.summary ?? ''}
            maxLength={300}
            placeholder="One sentence shown under the title and in search results"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="help-slug">Address</Label>
          <div className="flex items-center rounded-md border border-input bg-card pl-3 text-sm text-muted-foreground focus-within:ring-2 focus-within:ring-ring/40">
            /help/
            <input
              id="help-slug"
              ref={slugRef}
              defaultValue={initial?.slug}
              placeholder="article-address"
              className="h-9 min-w-0 flex-1 bg-transparent pr-3 text-foreground outline-none"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select defaultValue={categoryRef.current} onValueChange={(v) => (categoryRef.current = v)}>
            <SelectTrigger>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium text-foreground">Who can read it</legend>
        <p className="text-xs text-muted-foreground">Leave all unticked for everyone. Partner options match a Super Admin&apos;s designation.</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
          {AUDIENCE.map((a) => (
            <label key={a.value} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={roles.includes(a.value)}
                onChange={(e) => setRoles((r) => (e.target.checked ? [...r, a.value] : r.filter((x) => x !== a.value)))}
              />
              {a.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Toolbar editor={editor} onImage={handleImagePick} uploading={uploadImage.isPending} />
        <EditorContent editor={editor} />
      </div>

      {(validationError || error) && <p className="text-sm text-destructive">{validationError ?? error}</p>}

      <Button type="button" onClick={handleSubmit} disabled={submitting}>
        Save
      </Button>
    </div>
  );
}
