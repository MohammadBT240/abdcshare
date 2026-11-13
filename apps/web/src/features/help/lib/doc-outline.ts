/** Helpers over the stored Tiptap JSON: heading anchors, the "On this page" outline, flat navigation. */

export interface PMNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  text?: string;
  marks?: unknown[];
}

export interface OutlineItem {
  id: string;
  text: string;
  level: number;
}

export function slugifyHeading(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/[\s-]+/g, '-')
      .slice(0, 80) || 'section'
  );
}

export function nodeText(node: PMNode): string {
  if (node.type === 'text') return node.text ?? '';
  return (node.content ?? []).map(nodeText).join('');
}

/**
 * Give every heading a stable, unique `id` (from its text) and return the h2/h3 outline.
 * The same function runs for the TOC and the rendered HTML, so they always agree.
 */
export function withHeadingIds(doc: PMNode): { doc: PMNode; outline: OutlineItem[] } {
  const seen = new Map<string, number>();
  const outline: OutlineItem[] = [];
  const walk = (node: PMNode): PMNode => {
    if (node.type === 'heading') {
      const text = nodeText(node).trim();
      const base = slugifyHeading(text);
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      const id = n === 0 ? base : `${base}-${n + 1}`;
      const level = Number(node.attrs?.level ?? 2);
      if (level <= 3 && text) outline.push({ id, text, level });
      return { ...node, attrs: { ...node.attrs, id } };
    }
    // Don't collect headings nested in callouts/tables into the outline (they're rare and noisy).
    return node.content ? { ...node, content: node.content.map(walk) } : node;
  };
  return { doc: walk(doc), outline };
}

/** Split a search snippet on the ⟦ ⟧ markers the API puts around matches. */
export function snippetParts(snippet: string): { text: string; hit: boolean }[] {
  const parts: { text: string; hit: boolean }[] = [];
  const re = /⟦([^⟧]*)⟧/g;
  let last = 0;
  for (let m = re.exec(snippet); m; m = re.exec(snippet)) {
    if (m.index > last) parts.push({ text: snippet.slice(last, m.index), hit: false });
    parts.push({ text: m[1] ?? '', hit: true });
    last = m.index + m[0].length;
  }
  if (last < snippet.length) parts.push({ text: snippet.slice(last), hit: false });
  return parts;
}
