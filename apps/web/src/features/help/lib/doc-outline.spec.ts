import { getSchema } from '@tiptap/core';
import { Node as PMDocNode } from '@tiptap/pm/model';
import { HELP_TIPTAP_EXTENSIONS } from './tiptap-extensions';
import { slugifyHeading, snippetParts, withHeadingIds, type PMNode } from './doc-outline';

const h = (level: number, text: string): PMNode => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] });

describe('withHeadingIds', () => {
  it('adds unique ids and returns the h2/h3 outline', () => {
    const { doc, outline } = withHeadingIds({
      type: 'doc',
      content: [h(2, 'Before you start'), h(3, 'Step 1: Open the dialog'), h(2, 'Before you start'), h(4, 'Deep')],
    });
    expect(outline).toEqual([
      { id: 'before-you-start', text: 'Before you start', level: 2 },
      { id: 'step-1-open-the-dialog', text: 'Step 1: Open the dialog', level: 3 },
      { id: 'before-you-start-2', text: 'Before you start', level: 2 },
    ]);
    expect(doc.content?.[3]?.attrs?.id).toBe('deep');
  });

  // generateHTML needs a DOM (none in this jest setup) — the rendered HTML is checked in the e2e help tests.
  it('produces documents valid for the help schema (tables, callouts, links, heading ids)', () => {
    const { doc } = withHeadingIds({
      type: 'doc',
      content: [
        h(2, 'Who can upload'),
        { type: 'callout', attrs: { variant: 'tip' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] }] },
        {
          type: 'table',
          content: [
            { type: 'tableRow', content: [{ type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Role' }] }] }] },
            { type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Staff' }] }] }] },
          ],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'See', marks: [{ type: 'link', attrs: { href: '/help/library-uploading#declaration', target: null, rel: null } }] }],
        },
      ],
    });
    const node = PMDocNode.fromJSON(getSchema(HELP_TIPTAP_EXTENSIONS), doc);
    expect(() => node.check()).not.toThrow();
    expect(node.firstChild?.attrs.id).toBe('who-can-upload');
    expect(node.child(1).type.name).toBe('callout');
    expect(node.child(2).type.name).toBe('table');
  });
});

describe('helpers', () => {
  it('slugifies headings', () => {
    expect(slugifyHeading('Visibility, licences & view-only')).toBe('visibility-licences-view-only');
    expect(slugifyHeading('???')).toBe('section');
  });

  it('splits snippets on highlight markers', () => {
    expect(snippetParts('how to ⟦upload⟧ a ⟦file⟧.')).toEqual([
      { text: 'how to ', hit: false },
      { text: 'upload', hit: true },
      { text: ' a ', hit: false },
      { text: 'file', hit: true },
      { text: '.', hit: false },
    ]);
  });
});
