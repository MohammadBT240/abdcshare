import { MarkdownToTiptap, parseFrontMatter, plainText } from './markdown';

describe('MarkdownToTiptap', () => {
  const md = new MarkdownToTiptap({
    image: (src) => ({ storageKey: `help-images/defaults/${src}` }),
    link: (href) => href.replace(/^help:/, '/help/'),
  });

  it('converts headings (h1 demoted to h2), paragraphs and inline marks', () => {
    const doc = md.convert('# Title\n\nSome **bold**, _italic_, `code` and ~~gone~~ text.');
    expect(doc.content![0]).toEqual({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] });
    const p = doc.content![1]!;
    expect(p.content).toEqual([
      { type: 'text', text: 'Some ' },
      { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
      { type: 'text', text: ', ' },
      { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
      { type: 'text', text: ', ' },
      { type: 'text', text: 'code', marks: [{ type: 'code' }] },
      { type: 'text', text: ' and ' },
      { type: 'text', text: 'gone', marks: [{ type: 'strike' }] },
      { type: 'text', text: ' text.' },
    ]);
  });

  it('converts ordered and bullet lists with nested lists', () => {
    const doc = md.convert('1. First\n2. Second\n   - nested\n');
    const ol = doc.content![0]!;
    expect(ol.type).toBe('orderedList');
    expect(ol.content).toHaveLength(2);
    expect(ol.content![1]!.content!.map((n) => n.type)).toEqual(['paragraph', 'bulletList']);
  });

  it('turns GitHub alerts into callouts', () => {
    const doc = md.convert('> [!TIP]\n> Press **Ctrl+K** to search.');
    expect(doc.content![0]).toMatchObject({ type: 'callout', attrs: { variant: 'tip' } });
    expect(plainText(doc)).toBe('Press Ctrl+K to search.');
    expect(md.convert('> [!WARNING]\n> Careful').content![0]!.attrs).toEqual({ variant: 'warning' });
    expect(md.convert('> Just a quote').content![0]!.type).toBe('blockquote');
  });

  it('converts tables with a header row', () => {
    const doc = md.convert('| Role | Can |\n| --- | --- |\n| Staff | Upload |');
    const table = doc.content![0]!;
    expect(table.type).toBe('table');
    expect(table.content![0]!.content![0]!.type).toBe('tableHeader');
    expect(table.content![1]!.content![1]!.content![0]!.content).toEqual([{ type: 'text', text: 'Upload' }]);
  });

  it('rewrites help links and marks external links', () => {
    const doc = md.convert('See [uploading](help:library-uploading#declaration) or [the site](https://example.com).');
    const marks = doc.content![0]!.content!.filter((n) => n.marks).map((n) => n.marks![0]!.attrs);
    expect(marks[0]).toMatchObject({ href: '/help/library-uploading#declaration', target: null });
    expect(marks[1]).toMatchObject({ href: 'https://example.com', target: '_blank' });
  });

  it('turns a standalone image into an image node with a storage key, and drops raw HTML', () => {
    const doc = md.convert('![The upload dialog](library/upload.png)\n\n<script>alert(1)</script>');
    expect(doc.content).toEqual([
      { type: 'image', attrs: { src: null, alt: 'The upload dialog', title: null, storageKey: 'help-images/defaults/library/upload.png' } },
    ]);
  });

  it('keeps screenshots that sit inside list steps', () => {
    const doc = md.convert('1. Click **Upload**.\n\n   ![The menu](library/menu.png)\n\n2. Next step');
    const item = doc.content![0]!.content![0]!;
    expect(item.content!.map((n) => n.type)).toEqual(['paragraph', 'image']);
    expect(item.content![1]!.attrs).toMatchObject({ alt: 'The menu', storageKey: 'help-images/defaults/library/menu.png' });
  });

  it('decodes entities in text', () => {
    expect(plainText(md.convert('Clients & contacts — "quotes" <b>'))).toBe('Clients & contacts — "quotes"');
  });
});

describe('parseFrontMatter', () => {
  it('reads strings, numbers and lists', () => {
    const { data, body } = parseFrontMatter('---\ntitle: Uploading\norder: 2\nroles: [Staff, Super Admin]\n---\n# Body');
    expect(data).toEqual({ title: 'Uploading', order: 2, roles: ['Staff', 'Super Admin'] });
    expect(body).toBe('# Body');
  });
});
