import { Lexer, type Token, type Tokens } from 'marked';

/** A ProseMirror / Tiptap JSON node (the shape the help editor stores). */
export interface PMNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

export type CalloutVariant = 'note' | 'tip' | 'warning';

export interface ConvertOptions {
  /** Resolve an image path from the Markdown to `{ storageKey }` (the sync uploads it). */
  image?: (src: string, alt: string) => { storageKey: string } | null;
  /** Rewrite link targets (e.g. `help:slug#anchor` → `/help/slug#anchor`). */
  link?: (href: string) => string;
}

type Mark = NonNullable<PMNode['marks']>[number];

const ALERT = /^\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*\n?/i;

function variantOf(kind: string): CalloutVariant {
  const k = kind.toUpperCase();
  if (k === 'TIP') return 'tip';
  if (k === 'WARNING' || k === 'CAUTION' || k === 'IMPORTANT') return 'warning';
  return 'note';
}

function decode(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * Markdown → Tiptap JSON for help articles (Help Center HC2). Deliberately small: headings,
 * paragraphs, lists (incl. task-style), tables, GitHub-style callouts (`> [!TIP]`), code, links,
 * images, bold/italic/strike/code. No DOM needed, so it runs in the API at sync time.
 */
export class MarkdownToTiptap {
  constructor(private readonly opts: ConvertOptions = {}) {}

  convert(markdown: string): PMNode {
    const tokens = new Lexer({ gfm: true }).lex(markdown);
    return { type: 'doc', content: this.blocks(tokens) };
  }

  private blocks(tokens: Token[]): PMNode[] {
    const out: PMNode[] = [];
    for (const t of tokens) out.push(...this.block(t));
    return out;
  }

  private block(t: Token): PMNode[] {
    switch (t.type) {
      case 'space':
      case 'def':
        return [];
      case 'heading': {
        const h = t as Tokens.Heading;
        return [{ type: 'heading', attrs: { level: Math.min(Math.max(h.depth, 2), 4) }, content: this.inline(h.tokens) }];
      }
      case 'paragraph': {
        const p = t as Tokens.Paragraph;
        return this.imagesOnly(p.tokens) ?? [this.paragraph(this.inline(p.tokens))];
      }
      case 'text': {
        // Paragraphs inside tight list items come through as block-level `text` tokens.
        const tx = t as Tokens.Text;
        if (tx.tokens) return this.imagesOnly(tx.tokens) ?? [this.paragraph(this.inline(tx.tokens))];
        return [this.paragraph(this.textNodes(tx.text, []))];
      }
      case 'list': {
        const l = t as Tokens.List;
        const items: PMNode[] = l.items.map((item) => {
          let content = this.blocks(item.tokens);
          if (item.task) {
            const box = item.checked ? '☑ ' : '☐ ';
            const first = content[0];
            if (first?.type === 'paragraph') first.content = [{ type: 'text', text: box }, ...(first.content ?? [])];
          }
          if (content.length === 0 || content[0]!.type !== 'paragraph') content = [this.paragraph([]), ...content];
          return { type: 'listItem', content };
        });
        return [
          l.ordered
            ? { type: 'orderedList', attrs: { start: typeof l.start === 'number' ? l.start : 1 }, content: items }
            : { type: 'bulletList', content: items },
        ];
      }
      case 'blockquote': {
        const q = t as Tokens.Blockquote;
        const first = q.tokens[0];
        const raw = first && 'text' in first ? String((first as Tokens.Paragraph).text) : '';
        const m = ALERT.exec(raw);
        if (m) {
          // Strip the [!NOTE] marker and re-lex the remainder as the callout body.
          const body = q.text.replace(ALERT, '');
          return [{ type: 'callout', attrs: { variant: variantOf(m[1]!) }, content: this.nonEmpty(this.blocks(new Lexer({ gfm: true }).lex(body))) }];
        }
        return [{ type: 'blockquote', content: this.nonEmpty(this.blocks(q.tokens)) }];
      }
      case 'code': {
        const c = t as Tokens.Code;
        return [{ type: 'codeBlock', attrs: { language: c.lang || null }, content: c.text ? [{ type: 'text', text: c.text }] : [] }];
      }
      case 'hr':
        return [{ type: 'horizontalRule' }];
      case 'table': {
        const tb = t as Tokens.Table;
        const cell = (c: Tokens.TableCell, header: boolean): PMNode => ({
          type: header ? 'tableHeader' : 'tableCell',
          attrs: { colspan: 1, rowspan: 1, colwidth: null },
          content: [this.paragraph(this.inline(c.tokens))],
        });
        return [
          {
            type: 'table',
            content: [
              { type: 'tableRow', content: tb.header.map((c) => cell(c, true)) },
              ...tb.rows.map((r) => ({ type: 'tableRow', content: r.map((c) => cell(c, false)) })),
            ],
          },
        ];
      }
      case 'html':
        return []; // raw HTML is not allowed in help articles
      default:
        return 'text' in t && typeof t.text === 'string' ? [this.paragraph(this.textNodes(t.text, []))] : [];
    }
  }

  /** A paragraph holding nothing but images (and whitespace) becomes block images. */
  private imagesOnly(tokens: Token[]): PMNode[] | null {
    const meaningful = tokens.filter((t) => !(t.type === 'text' && !(t as Tokens.Text).text.trim()) && t.type !== 'br');
    if (!meaningful.length || !meaningful.every((t) => t.type === 'image')) return null;
    return meaningful.flatMap((t) => this.image(t as Tokens.Image));
  }

  private nonEmpty(nodes: PMNode[]): PMNode[] {
    return nodes.length ? nodes : [this.paragraph([])];
  }

  private paragraph(content: PMNode[]): PMNode {
    return content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
  }

  private image(img: Tokens.Image): PMNode[] {
    const resolved = this.opts.image?.(img.href, img.text) ?? null;
    if (!resolved) return [this.paragraph(this.textNodes(`[image: ${img.text}]`, []))];
    return [{ type: 'image', attrs: { src: null, alt: img.text || null, title: img.title || null, storageKey: resolved.storageKey } }];
  }

  private textNodes(text: string, marks: Mark[]): PMNode[] {
    const t = decode(text);
    if (!t) return [];
    return [marks.length ? { type: 'text', text: t, marks: [...marks] } : { type: 'text', text: t }];
  }

  private inline(tokens: Token[] | undefined, marks: Mark[] = []): PMNode[] {
    const out: PMNode[] = [];
    for (const t of tokens ?? []) {
      switch (t.type) {
        case 'text': {
          const tx = t as Tokens.Text;
          out.push(...(tx.tokens?.length ? this.inline(tx.tokens, marks) : this.textNodes(tx.text, marks)));
          break;
        }
        case 'escape':
          out.push(...this.textNodes((t as Tokens.Escape).text, marks));
          break;
        case 'strong':
          out.push(...this.inline((t as Tokens.Strong).tokens, [...marks, { type: 'bold' }]));
          break;
        case 'em':
          out.push(...this.inline((t as Tokens.Em).tokens, [...marks, { type: 'italic' }]));
          break;
        case 'del':
          out.push(...this.inline((t as Tokens.Del).tokens, [...marks, { type: 'strike' }]));
          break;
        case 'codespan':
          out.push(...this.textNodes((t as Tokens.Codespan).text, [...marks, { type: 'code' }]));
          break;
        case 'br':
          out.push({ type: 'hardBreak' });
          break;
        case 'link': {
          const l = t as Tokens.Link;
          const href = this.opts.link ? this.opts.link(l.href) : l.href;
          const external = /^https?:\/\//i.test(href);
          out.push(
            ...this.inline(l.tokens, [
              ...marks,
              { type: 'link', attrs: { href, target: external ? '_blank' : null, rel: external ? 'noopener noreferrer nofollow' : null } },
            ]),
          );
          break;
        }
        case 'html':
          break; // raw inline HTML is dropped
        case 'image':
          // Inline images aren't supported by the editor's image node; keep the alt text.
          out.push(...this.textNodes((t as Tokens.Image).text, marks));
          break;
        default:
          if ('text' in t && typeof t.text === 'string') out.push(...this.textNodes(t.text, marks));
      }
    }
    // Merge adjacent text nodes with identical marks.
    return out.reduce<PMNode[]>((acc, n) => {
      const prev = acc[acc.length - 1];
      if (prev && prev.type === 'text' && n.type === 'text' && JSON.stringify(prev.marks ?? []) === JSON.stringify(n.marks ?? [])) {
        prev.text = (prev.text ?? '') + (n.text ?? '');
      } else acc.push({ ...n });
      return acc;
    }, []);
  }
}

/** Plain text of a doc (search + `body_text`), one line per block. */
export function plainText(node: PMNode): string {
  const parts: string[] = [];
  const walk = (n: PMNode) => {
    if (n.type === 'text') parts.push(n.text ?? '');
    else if (n.type === 'hardBreak') parts.push(' ');
    n.content?.forEach(walk);
    if (['paragraph', 'heading', 'listItem', 'tableCell', 'tableHeader', 'codeBlock'].includes(n.type)) parts.push('\n');
  };
  walk(node);
  return parts.join('').replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n').trim();
}

export interface FrontMatter {
  [key: string]: string | number | string[] | undefined;
}

/** Tiny front-matter parser: `key: value`, numbers, and `[a, b]` lists. */
export function parseFrontMatter(source: string): { data: FrontMatter; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  if (!m) return { data: {}, body: source };
  const data: FrontMatter = {};
  for (const line of m[1]!.split(/\r?\n/)) {
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line.trim());
    if (!kv) continue;
    const [, key, rawValue] = kv;
    const value = rawValue!.trim();
    if (value.startsWith('[') && value.endsWith(']')) {
      data[key!] = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    } else if (/^-?\d+$/.test(value)) {
      data[key!] = Number(value);
    } else {
      data[key!] = value.replace(/^['"]|['"]$/g, '');
    }
  }
  return { data, body: source.slice(m[0].length) };
}
