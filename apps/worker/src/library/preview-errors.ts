import { PreviewErrorCode } from '@abdcshare/shared';

/** OLE2 / Compound File Binary magic — what an *encrypted* .docx/.xlsx/.pptx actually is. */
const CFB_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

/**
 * OOXML files are ZIPs ("PK"). A password-protected one is wrapped in a CFB container instead,
 * so a .docx/.xlsx/.pptx that starts with the CFB magic is encrypted (S3, D28). Legacy .doc/.xls
 * are CFB anyway, so they can't be judged this way.
 */
export function isEncryptedOoxml(head: Buffer, fileName: string): boolean {
  return /\.(docx|xlsx|pptx)$/i.test(fileName) && head.subarray(0, 8).equals(CFB_MAGIC);
}

export class ClassifiedPreviewError extends Error {
  constructor(
    readonly code: PreviewErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** Map a LibreOffice / conversion failure to a code the viewer can explain. */
export function classifyPreviewFailure(err: unknown): PreviewErrorCode {
  if (err instanceof ClassifiedPreviewError) return err.code;
  const e = err as { killed?: boolean; signal?: string; code?: string; message?: string } | null;
  const message = (e?.message ?? String(err)).toLowerCase();
  if (e?.killed || e?.signal === 'SIGTERM' || message.includes('timed out') || message.includes('etimedout')) {
    return PreviewErrorCode.Timeout;
  }
  if (message.includes('password') || message.includes('encrypt')) return PreviewErrorCode.PasswordProtected;
  // soffice exits 0 but writes no PDF for files it can't read.
  if (e?.code === 'ENOENT' || message.includes('no such file') || message.includes('general input/output error')) {
    return PreviewErrorCode.Corrupt;
  }
  return PreviewErrorCode.Unknown;
}
