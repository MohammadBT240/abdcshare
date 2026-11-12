import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { createReadStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Public } from '../decorators/public.decorator';
import { STORAGE, type StoragePort } from './storage.port';
import { LocalStorageAdapter } from './local-storage.adapter';
import { localScope, verifyLocal } from './local-url-signer';

/**
 * Dev-only local object storage HTTP surface (PUT upload + GET download/preview).
 * Keys are URI-encoded (slashes → %2F) so a single path segment is enough.
 * Every request must carry a valid, unexpired HMAC signature minted by the adapter
 * (`exp` + `sig`), and keys are confined to LOCAL_STORAGE_DIR.
 */
@ApiExcludeController()
@Controller('storage/local')
export class LocalStorageController {
  constructor(@Inject(STORAGE) private readonly storage: StoragePort) {}

  private local(): LocalStorageAdapter {
    if (!(this.storage instanceof LocalStorageAdapter)) {
      throw new NotFoundException();
    }
    return this.storage;
  }

  /** Verify the signature and return the contained absolute path. */
  private authorize(scope: string, key: string, exp?: string, sig?: string): string {
    const local = this.local();
    if (!verifyLocal(local.signingSecret(), scope, exp, sig)) {
      throw new ForbiddenException('Invalid or expired storage URL');
    }
    try {
      return local.pathFor(key);
    } catch {
      throw new NotFoundException();
    }
  }

  @Public()
  @Put(':key')
  async put(
    @Param('key') key: string,
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    const decoded = decodeURIComponent(key);
    const filePath = this.authorize(localScope.put(decoded), decoded, exp, sig);
    await mkdir(path.dirname(filePath), { recursive: true });
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    await writeFile(filePath, Buffer.concat(chunks));
    return { ok: true };
  }

  @Public()
  @Get(':key')
  get(
    @Param('key') key: string,
    @Query('download') download: string | undefined,
    @Query('inline') inline: string | undefined,
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Res() res: Response,
  ): void {
    const decoded = decodeURIComponent(key);
    const filePath = this.authorize(localScope.get(decoded), decoded, exp, sig);
    const fileName = inline || download;
    if (fileName) {
      const disposition = inline ? 'inline' : 'attachment';
      res.setHeader(
        'Content-Disposition',
        `${disposition}; filename="${fileName.replace(/"/g, '')}"`,
      );
    }
    res.setHeader('Cache-Control', 'private, max-age=60');
    createReadStream(filePath)
      .on('error', () => {
        if (!res.headersSent) res.status(404).json({ message: 'Not found' });
      })
      .pipe(res);
  }
}
