'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { IconBold, IconItalic, IconList, IconPhoto } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ROLE_NAMES, type RoleName } from '@abdcshare/shared';
import { HELP_TIPTAP_EXTENSIONS } from '../lib/tiptap-extensions';
import { extractPlainText } from '../lib/plain-text';
import { useUploadHelpImage } from '../hooks/use-help-image-upload';
import type { HelpCategory } from '../types';

export interface ArticleFormValues {
  title: string;
  slug: string;
  categoryId: string;
  bodyJson: Record<string, unknown>;
  bodyText: string;
  visibleToRoles: string[];
}

export interface ArticleEditorProps {
  categories: HelpCategory[];
  initial?: Partial<ArticleFormValues>;
  onSubmit: (values: ArticleFormValues) => void;
  submitting?: boolean;
  error?: string | null;
}

const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] };

export function ArticleEditor({ categories, initial, onSubmit, submitting, error }: ArticleEditorProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<string>(initial?.categoryId ?? categories[0]?.id ?? '');
  const rolesRef = useRef<string[]>(initial?.visibleToRoles ?? []);
  const uploadImage = useUploadHelpImage();
  const [validationError, setValidationError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: HELP_TIPTAP_EXTENSIONS,
    content: initial?.bodyJson ?? EMPTY_DOC,
    immediatelyRender: false,
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
      editor.chain().focus().setImage({ src: '', alt: file.name }).run();
      // setImage doesn't accept custom attrs directly — patch the just-inserted node's storageKey.
      const { state } = editor;
      const pos = state.selection.from - 1;
      editor.chain().command(({ tr }) => {
        tr.setNodeAttribute(pos, 'storageKey', storageKey);
        return true;
      }).run();
    };
    input.click();
  };

  const toggleRole = (role: RoleName, checked: boolean) => {
    rolesRef.current = checked
      ? [...rolesRef.current, role]
      : rolesRef.current.filter((r) => r !== role);
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

    onSubmit({
      title,
      slug,
      categoryId,
      bodyJson: editor.getJSON(),
      bodyText: extractPlainText(editor.getJSON()),
      visibleToRoles: rolesRef.current,
    });
  };

  return (
    <div className="space-y-4">
      <Input ref={titleRef} defaultValue={initial?.title} placeholder="Article title" />
      <Input ref={slugRef} defaultValue={initial?.slug} placeholder="article-slug" />

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

      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">
          Visible to (none selected = every role)
        </p>
        <div className="flex flex-wrap gap-3">
          {ROLE_NAMES.map((role) => (
            <label key={role} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                defaultChecked={rolesRef.current.includes(role)}
                onChange={(e) => toggleRole(role, e.target.checked)}
              />
              {role}
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border">
        <div className="flex gap-1 border-b border-border p-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => editor?.chain().focus().toggleBold().run()}>
            <IconBold className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => editor?.chain().focus().toggleItalic().run()}>
            <IconItalic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            <IconList className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={handleImagePick} disabled={uploadImage.isPending}>
            <IconPhoto className="h-4 w-4" />
          </Button>
        </div>
        <EditorContent editor={editor} className="prose prose-sm max-w-none p-3" />
      </div>

      {(validationError || error) && (
        <p className="text-sm text-destructive">{validationError ?? error}</p>
      )}

      <Button type="button" onClick={handleSubmit} disabled={submitting}>
        Save
      </Button>
    </div>
  );
}
