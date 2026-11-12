import { Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Heading from '@tiptap/extension-heading';
import Image from '@tiptap/extension-image';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';

/** Image node gains a persisted `storageKey` attribute; `src` is always server-resolved on read. */
const HelpImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      storageKey: { default: null },
    };
  },
});

/** Headings carry an `id` (set at render time from the text) so the TOC and `#anchor` links work. */
const HelpHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      id: { default: null, rendered: true },
    };
  },
}).configure({ levels: [2, 3, 4] });

export type CalloutVariant = 'note' | 'tip' | 'warning';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      /** Wrap the selection in a callout box, or change the variant of the one it's in. */
      setCallout: (variant: CalloutVariant) => ReturnType;
      unsetCallout: () => ReturnType;
    };
  }
}

/** "Note / Tip / Warning" box. Markdown: `> [!TIP]` (see the API's help sync). */
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      variant: {
        default: 'note',
        parseHTML: (el) => el.getAttribute('data-callout') ?? 'note',
        renderHTML: (attrs) => ({ 'data-callout': attrs.variant as string }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'help-callout' }), 0];
  },
  addCommands() {
    return {
      setCallout:
        (variant) =>
        ({ editor, commands }) =>
          editor.isActive(this.name) ? commands.updateAttributes(this.name, { variant }) : commands.wrapIn(this.name, { variant }),
      unsetCallout:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
    };
  },
});

export const HELP_TIPTAP_EXTENSIONS = [
  StarterKit.configure({
    heading: false,
    link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: null, target: null } },
  }),
  HelpHeading,
  HelpImage,
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  Callout,
];
