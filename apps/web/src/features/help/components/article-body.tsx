'use client';

import { generateHTML } from '@tiptap/core';
import { HELP_TIPTAP_EXTENSIONS } from '../lib/tiptap-extensions';

export function ArticleBody({ bodyJson }: { bodyJson: Record<string, unknown> }) {
  const html = generateHTML(bodyJson as never, HELP_TIPTAP_EXTENSIONS);
  return (
    <div
      className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-a:text-primary"
      // Content is authored in-app by help:manage roles only, via the Tiptap editor.
      // (No react/no-danger rule is configured in this project's eslint setup.)
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
