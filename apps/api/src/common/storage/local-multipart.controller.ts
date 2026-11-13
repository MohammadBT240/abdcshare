import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Inject,
  NotFoundException,
  Param,
  ParseIntPipe,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../decorators/public.decorator';
import { STORAGE, type StoragePort } from './storage.port';
import { LocalStorageAdapter } from './local-storage.adapter';
import { localScope, verifyLocal } from './local-url-signer';

/**
 * Dev-only endpoint that receives multipart part bodies for LocalStorageAdapter.
 * Not used when STORAGE_DRIVER=r2 (browser PUTs to R2 directly).
 */
@ApiExcludeController()
@Controller('storage/local-multipart')
export class LocalMultipartController {
  constructor(@Inject(STORAGE) private readonly storage: StoragePort) {}

  @Public()
  @Put(':uploadId/:partNumber')
  async putPart(
    @Param('uploadId') uploadId: string,
    @Param('partNumber', ParseIntPipe) partNumber: number,
    @Query('key') key: string | undefined,
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ etag: string }> {
    if (!(this.storage instanceof LocalStorageAdapter)) {
      throw new NotFoundException();
    }
    if (!key) throw new BadRequestException('key query required');
    if (partNumber < 1 || partNumber > 10_000) {
      throw new BadRequestException('Invalid part number');
    }
    if (!/^[0-9a-f-]{36}$/i.test(uploadId)) throw new BadRequestException('Invalid upload id');
    if (!verifyLocal(this.storage.signingSecret(), localScope.part(uploadId, partNumber, key), exp, sig)) {
      throw new ForbiddenException('Invalid or expired storage URL');
    }
    const body = await streamToBuffer(req);
    const etag = await this.storage.writeLocalPart(uploadId, partNumber, body);
    // Uppy's S3 multipart reads the part ETag from the response header, like R2.
    res.setHeader('ETag', etag);
    return { etag };
  }
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
