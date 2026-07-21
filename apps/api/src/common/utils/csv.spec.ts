import { parseCsv, toCsv } from './csv';

describe('csv util', () => {
  it('parses a header + rows into objects', () => {
    const rows = parseCsv('firstName,surname,email\nJane,Doe,jane@x.co\nJohn,Roe,john@x.co');
    expect(rows).toEqual([
      { firstName: 'Jane', surname: 'Doe', email: 'jane@x.co' },
      { firstName: 'John', surname: 'Roe', email: 'john@x.co' },
    ]);
  });

  it('handles quoted fields with commas and escaped quotes', () => {
    const rows = parseCsv('name,note\n"Doe, Jane","said ""hi"""');
    expect(rows[0]).toEqual({ name: 'Doe, Jane', note: 'said "hi"' });
  });

  it('skips blank lines and trims values', () => {
    const rows = parseCsv('a,b\n x , y \n\n');
    expect(rows).toEqual([{ a: 'x', b: 'y' }]);
  });

  it('round-trips via toCsv (quoting values that need it)', () => {
    const csv = toCsv([{ a: 'Doe, Jane', b: 'plain' }], ['a', 'b']);
    expect(csv).toBe('a,b\n"Doe, Jane",plain');
    expect(parseCsv(csv)).toEqual([{ a: 'Doe, Jane', b: 'plain' }]);
  });
});
