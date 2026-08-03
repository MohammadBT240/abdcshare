import {
  Controller,
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
import { ConfigService } from '@nestjs/config';
import { Public } from '../decorators/public.decorator';
import { STORAGE, type StoragePort } from './storage.port';
import { LocalStorageAdapter } from './local-storage.adapter';

/**
 * Dev-only local object storage HTTP surface (PUT upload + GET download/preview).
 * Keys are URI-encoded (slashes → %2F) so a single path segment is enough.
 */
@ApiExcludeController()
@Controller('storage/local')
export class LocalStorageController {
  constructor(
    @Inject(STORAGE) private readonly storage: StoragePort,
    private readonly config: ConfigService,
  ) {}

  private rootDir(): string {
    return this.config.get<string>('LOCAL_STORAGE_DIR', './storage');
  }

  private assertLocal(): void {
    if (!(this.storage instanceof LocalStorageAdapter)) {
      throw new NotFoundException();
    }
  }

  @Public()
  @Put(':key')
  async put(@Param('key') key: string, @Req() req: Request): Promise<{ ok: true }> {
    this.assertLocal();
    const decoded = decodeURIComponent(key);
    const filePath = path.join(this.rootDir(), decoded);
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
    @Res() res: Response,
  ): void {
    this.assertLocal();
    const decoded = decodeURIComponent(key);
    const filePath = path.join(this.rootDir(), decoded);
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
