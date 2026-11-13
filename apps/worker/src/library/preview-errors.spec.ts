import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PreviewErrorCode } from '@abdcshare/shared';
import { ClassifiedPreviewError, classifyPreviewFailure, isEncryptedOoxml } from './preview-errors';

const FILES = path.join(__dirname, '..', '..', '..', '..', 'e2e', 'fixtures', 'files');

describe('conversion failure classification (D28)', () => {
  it('spots a password-protected .docx (CFB container instead of a ZIP)', () => {
    const protectedDocx = readFileSync(path.join(FILES, 'protected.docx'));
    const plainDocx = readFileSync(path.join(FILES, 'sample.docx'));
    expect(isEncryptedOoxml(protectedDocx.subarray(0, 8), 'protected.docx')).toBe(true);
    expect(isEncryptedOoxml(plainDocx.subarray(0, 8), 'sample.docx')).toBe(false);
    // A legacy .doc is CFB anyway — not judged.
    expect(isEncryptedOoxml(protectedDocx.subarray(0, 8), 'legacy.doc')).toBe(false);
  });

  it('maps errors to codes', () => {
    expect(classifyPreviewFailure(new ClassifiedPreviewError(PreviewErrorCode.PasswordProtected, 'x'))).toBe('password_protected');
    expect(classifyPreviewFailure(Object.assign(new Error('Command failed'), { killed: true, signal: 'SIGTERM' }))).toBe('timeout');
    expect(classifyPreviewFailure(new Error('Error: source file could not be loaded (password required)'))).toBe('password_protected');
    expect(classifyPreviewFailure(Object.assign(new Error("ENOENT: no such file or directory, open 'x.pdf'"), { code: 'ENOENT' }))).toBe(
      'corrupt',
    );
    expect(classifyPreviewFailure(new Error('something odd'))).toBe('unknown');
  });
});
