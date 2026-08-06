import {
  BadRequestException,
  Controller,
  Inject,
  NotFoundException,
  Param,
  ParseIntPipe,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../decorators/public.decorator';
import { STORAGE, type StoragePort } from './storage.port';
import { LocalStorageAdapter } from './local-storage.adapter';

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
    @Req() req: Request,
  ): Promise<{ etag: string }> {
    if (!(this.storage instanceof LocalStorageAdapter)) {
      throw new NotFoundException();
    }
    if (!key) throw new BadRequestException('key query required');
    if (partNumber < 1 || partNumber > 10_000) {
      throw new BadRequestException('Invalid part number');
    }
    const body = await streamToBuffer(req);
    const etag = await this.storage.writeLocalPart(uploadId, partNumber, body);
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
