import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';

/** Image node gains a persisted `storageKey` attribute; `src` is always server-resolved on read. */
const HelpImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      storageKey: { default: null },
    };
  },
});

export const HELP_TIPTAP_EXTENSIONS = [StarterKit, HelpImage];
