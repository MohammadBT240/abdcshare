import { extractPlainText } from './plain-text';

describe('extractPlainText', () => {
  it('joins text nodes across paragraphs with spaces', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'world' }] },
      ],
    };
    expect(extractPlainText(doc)).toBe('Hello world');
  });

  it('ignores image nodes', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'image', attrs: { src: '', storageKey: 'k' } },
        { type: 'paragraph', content: [{ type: 'text', text: 'caption' }] },
      ],
    };
    expect(extractPlainText(doc)).toBe('caption');
  });

  it('returns an empty string for an empty doc', () => {
    expect(extractPlainText({ type: 'doc', content: [] })).toBe('');
  });
});
