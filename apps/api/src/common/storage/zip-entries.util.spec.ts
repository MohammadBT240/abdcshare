import JSZip from 'jszip';
import { BadRequestException } from '@nestjs/common';
import { extractZipEntry, listZipEntries } from './zip-entries.util';

describe('listZipEntries', () => {
  it('lists files and directories', async () => {
    const zip = new JSZip();
    zip.file('readme.txt', 'hello');
    zip.folder('docs')?.file('a.txt', 'a');
    const buffer = Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));

    const entries = await listZipEntries(buffer);
    expect(entries.some((e) => e.name === 'readme.txt' && !e.isDirectory)).toBe(true);
    expect(entries.some((e) => e.name === 'docs/' || e.name === 'docs')).toBe(true);
  });

  it('rejects invalid zip bytes', async () => {
    await expect(listZipEntries(Buffer.from('not-a-zip'))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('extractZipEntry', () => {
  it('extracts a named file', async () => {
    const zip = new JSZip();
    zip.file('version.txt', '1.0.0');
    const buffer = Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));

    const extracted = await extractZipEntry(buffer, 'version.txt');
    expect(extracted.name).toBe('version.txt');
    expect(extracted.mimeType).toBe('text/plain');
    expect(extracted.data.toString('utf8')).toBe('1.0.0');
  });

  it('rejects missing entries', async () => {
    const zip = new JSZip();
    zip.file('a.txt', 'a');
    const buffer = Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
    await expect(extractZipEntry(buffer, 'missing.txt')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
