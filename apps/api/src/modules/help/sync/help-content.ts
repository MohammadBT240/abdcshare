import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { ROLE_NAMES } from '@abdcshare/shared';
import { MarkdownToTiptap, parseFrontMatter, plainText, type PMNode } from './markdown';

/**
 * Loads the default Help Center content from `docs/help` (HC1):
 *
 *   docs/help/<category>/_category.md   front matter: title, order, icon, description
 *   docs/help/<category>/<slug>.md      front matter: title, summary, roles, order, related
 *   docs/help/images/**                 screenshots referenced as ![alt](../images/x.png)
 *
 * Pure file work — no database, no storage — so it is unit-tested against the real docs.
 */

/** Tokens allowed in `roles:` — role names plus the two partner designations (HC: designation-aware visibility). */
export const HELP_VISIBILITY_TOKENS: readonly string[] = [...ROLE_NAMES, 'Partner', 'PrincipalPartner'];

export interface HelpImageRef {
  /** sha256 of the file bytes. */
  hash: string;
  absPath: string;
  contentType: string;
}

export interface LoadedCategory {
  slug: string;
  name: string;
  order: number;
  icon: string | null;
  description: string | null;
}

export interface LoadedArticle {
  slug: string;
  categorySlug: string;
  title: string;
  summary: string | null;
  visibleToRoles: string[];
  order: number;
  related: string[];
  /** Image nodes carry `storageKey: "asset:<hash>"` until the sync swaps in the real key. */
  bodyJson: PMNode;
  bodyText: string;
  images: HelpImageRef[];
  file: string;
}

export interface LoadedHelpContent {
  categories: LoadedCategory[];
  articles: LoadedArticle[];
  /** Problems that must be fixed in the Markdown (unknown roles, broken links, missing images…). */
  errors: string[];
}

const IMAGE_TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const ASSET_PREFIX = 'asset:';
/** Help pages built into the app (not articles) that Markdown may link to; articles can't use these slugs. */
export const BUILT_IN_HELP_PAGES = ['who-can-do-what'];

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}
function list(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}
function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** Default content directory: `<repo>/docs/help`, from the API's working directory (apps/api). */
export function defaultHelpContentDir(): string {
  return path.resolve(process.cwd(), '../../docs/help');
}

export function loadHelpContent(dir: string): LoadedHelpContent {
  const errors: string[] = [];
  const categories: LoadedCategory[] = [];
  const articles: LoadedArticle[] = [];
  if (!existsSync(dir)) return { categories, articles, errors: [`Help content folder not found: ${dir}`] };

  const categoryDirs = readdirSync(dir)
    .filter((d) => d !== 'images' && !d.startsWith('.') && statSync(path.join(dir, d)).isDirectory())
    .sort();

  /** Links are checked once every slug is known. */
  const linkChecks: { file: string; slug: string }[] = [];

  for (const catSlug of categoryDirs) {
    const catDir = path.join(dir, catSlug);
    const rel = (f: string) => path.relative(dir, f);
    if (!SLUG.test(catSlug)) errors.push(`${catSlug}: category folder names must be lowercase-with-dashes`);
    const catFile = path.join(catDir, '_category.md');
    if (!existsSync(catFile)) {
      errors.push(`${catSlug}: missing _category.md`);
      continue;
    }
    const { data: cat } = parseFrontMatter(readFileSync(catFile, 'utf8'));
    const name = str(cat.title);
    if (!name) errors.push(`${rel(catFile)}: title is required`);
    categories.push({
      slug: catSlug,
      name: name ?? catSlug,
      order: num(cat.order, 100),
      icon: str(cat.icon),
      description: str(cat.description),
    });

    for (const fileName of readdirSync(catDir).filter((f) => f.endsWith('.md') && f !== '_category.md').sort()) {
      const file = path.join(catDir, fileName);
      const { data, body } = parseFrontMatter(readFileSync(file, 'utf8'));
      const slug = str(data.slug) ?? fileName.replace(/\.md$/, '');
      const title = str(data.title);
      if (!SLUG.test(slug)) errors.push(`${rel(file)}: slug "${slug}" must be lowercase-with-dashes`);
      if (!title) errors.push(`${rel(file)}: title is required`);
      const roles = list(data.roles);
      for (const r of roles) {
        if (!HELP_VISIBILITY_TOKENS.includes(r)) errors.push(`${rel(file)}: unknown role "${r}" (use ${HELP_VISIBILITY_TOKENS.join(', ')})`);
      }

      const images: HelpImageRef[] = [];
      const converter = new MarkdownToTiptap({
        image: (src) => {
          if (/^https?:/i.test(src)) {
            errors.push(`${rel(file)}: external image ${src} — put screenshots in docs/help/images`);
            return null;
          }
          const absPath = path.resolve(catDir, decodeURIComponent(src));
          const contentType = IMAGE_TYPES[path.extname(absPath).toLowerCase()];
          if (!contentType) {
            errors.push(`${rel(file)}: image ${src} must be PNG, JPEG or WebP`);
            return null;
          }
          if (!existsSync(absPath)) {
            errors.push(`${rel(file)}: image not found: ${src}`);
            return null;
          }
          const hash = createHash('sha256').update(readFileSync(absPath)).digest('hex');
          images.push({ hash, absPath, contentType });
          return { storageKey: `${ASSET_PREFIX}${hash}` };
        },
        link: (href) => {
          const resolved = resolveHelpLink(href);
          if (resolved.slug) linkChecks.push({ file: rel(file), slug: resolved.slug });
          return resolved.href;
        },
      });
      const bodyJson = converter.convert(body);
      const related = list(data.related);
      for (const r of related) linkChecks.push({ file: rel(file), slug: r });
      articles.push({
        slug,
        categorySlug: catSlug,
        title: title ?? slug,
        summary: str(data.summary),
        visibleToRoles: roles,
        order: num(data.order, 100),
        related,
        bodyJson,
        bodyText: plainText(bodyJson),
        images,
        file: rel(file),
      });
    }
  }

  const slugs = new Map<string, string>();
  for (const a of articles) {
    const prev = slugs.get(a.slug);
    if (prev) errors.push(`${a.file}: slug "${a.slug}" is also used by ${prev}`);
    if (BUILT_IN_HELP_PAGES.includes(a.slug)) errors.push(`${a.file}: "${a.slug}" is a built-in help page — choose another slug`);
    slugs.set(a.slug, a.file);
  }
  for (const c of linkChecks) {
    if (!slugs.has(c.slug) && !BUILT_IN_HELP_PAGES.includes(c.slug)) errors.push(`${c.file}: links to unknown article "${c.slug}"`);
  }
  return { categories, articles, errors };
}

/**
 * `help:slug#anchor`, `./slug.md#anchor`, `../other/slug.md` → `/help/slug#anchor`.
 * App links (`/engagements`) and external URLs pass through unchanged.
 */
export function resolveHelpLink(href: string): { href: string; slug: string | null } {
  const help = /^help:([a-z0-9-]+)(#[\w-]+)?$/.exec(href);
  if (help) return { href: `/help/${help[1]}${help[2] ?? ''}`, slug: help[1]! };
  const md = /^(?:\.{1,2}\/)*(?:[a-z0-9-]+\/)*([a-z0-9-]+)\.md(#[\w-]+)?$/.exec(href);
  if (md) return { href: `/help/${md[1]}${md[2] ?? ''}`, slug: md[1]! };
  const page = /^\/help\/([a-z0-9-]+)(#[\w-]+)?$/.exec(href);
  if (page) return { href, slug: page[1]! };
  return { href, slug: null };
}

/** Stable JSON (sorted keys) so jsonb's key reordering doesn't change the hash. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** What an admin can change in the editor — if it differs from what the sync wrote, the article was edited. */
export function articleContentHash(a: {
  title: string;
  summary?: string | null;
  bodyJson: unknown;
  visibleToRoles: string[];
}): string {
  return createHash('sha256')
    .update(canonicalJson({ title: a.title, summary: a.summary ?? null, bodyJson: a.bodyJson, roles: [...a.visibleToRoles].sort() }))
    .digest('hex');
}

/** Replace `asset:<hash>` image keys with real storage keys. */
export function swapAssetKeys(node: PMNode, keys: Map<string, string>): PMNode {
  const attrs = node.attrs;
  const key = attrs && typeof attrs.storageKey === 'string' ? attrs.storageKey : null;
  const next: PMNode = { ...node };
  if (key?.startsWith(ASSET_PREFIX)) {
    next.attrs = { ...attrs, storageKey: keys.get(key.slice(ASSET_PREFIX.length)) ?? null };
  }
  if (node.content) next.content = node.content.map((c) => swapAssetKeys(c, keys));
  return next;
}
