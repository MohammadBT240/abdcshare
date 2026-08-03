import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { DocumentsService } from './documents.service';
import { DOCUMENT_MAX_BYTES } from './documents.constants';
import {
  MultipartAbortDto,
  MultipartCompleteDto,
  MultipartCreateDto,
  MultipartSignPartsDto,
} from '../../common/storage/multipart.dto';
import {
  AddDocumentParticipantDto,
  ConfirmBatchDto,
  ConfirmUploadDto,
  CreateDocumentDto,
  PresignBatchDto,
  DocumentDetailResponseDto,
  DocumentListQueryDto,
  DocumentListResponseDto,
  ExportDocumentsDto,
  DownloadUrlResponseDto,
  PresignedUploadResponseDto,
  PresignUploadDto,
  SetDocumentStatusDto,
  UpdateDocumentDto,
} from './presentation/dto/document.dto';

const fileInterceptor = FileInterceptor('file', {
  limits: { fileSize: DOCUMENT_MAX_BYTES },
});

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  /**
   * Create a document. Permission is category-scoped in the service:
   * Supporting → engagement:update; WorkingPaper → working-paper:upload; FinalReport → final-report:upload.
   */
  @Post()
  create(
    @Body() dto: CreateDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentDetailResponseDto> {
    return this.documents.create(dto, user);
  }

  @Get()
  @RequirePermission('document:view')
  list(
    @Query() query: DocumentListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentListResponseDto> {
    return this.documents.list(query, user);
  }

  @Post('export')
  @RequirePermission('document:view')
  exportDocuments(
    @Body() dto: ExportDocumentsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ accepted: true; jobId: string }> {
    return this.documents.exportDocuments(dto, user);
  }

  @Get(':id')
  @RequirePermission('document:view')
  getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentDetailResponseDto> {
    return this.documents.getOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentDetailResponseDto> {
    return this.documents.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission('document:delete')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    return this.documents.remove(id, user);
  }

  @Post(':id/files/presign')
  presign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PresignUploadDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PresignedUploadResponseDto> {
    return this.documents.presignUpload(id, dto, user);
  }

  @Post(':id/files')
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmUploadDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentDetailResponseDto> {
    return this.documents.confirmUpload(id, dto, user);
  }

  @Post(':id/files/multipart')
  createMultipart(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MultipartCreateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.createMultipart(id, dto, user);
  }

  @Post(':id/files/multipart/:uploadId/parts')
  signMultipartParts(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('uploadId') uploadId: string,
    @Body() dto: MultipartSignPartsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.signMultipartParts(id, uploadId, dto, user);
  }

  @Post(':id/files/multipart/:uploadId/complete')
  completeMultipart(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('uploadId') uploadId: string,
    @Body() dto: MultipartCompleteDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentDetailResponseDto> {
    return this.documents.completeMultipart(id, uploadId, dto, user);
  }

  @Post(':id/files/multipart/:uploadId/abort')
  abortMultipart(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('uploadId') uploadId: string,
    @Body() dto: MultipartAbortDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.abortMultipart(id, uploadId, dto, user);
  }

  /** Server-side multipart upload (category permission enforced in service). */
  @Post(':id/files/upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(fileInterceptor)
  uploadDirect(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentDetailResponseDto> {
    return this.documents.uploadDirect(
      id,
      file
        ? {
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            buffer: file.buffer,
          }
        : undefined,
      user,
    );
  }

  @Post(':id/files/presign-batch')
  presignBatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PresignBatchDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PresignedUploadResponseDto[]> {
    return this.documents.presignUploadBatch(id, dto.files, user);
  }

  @Post(':id/files/batch')
  confirmBatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmBatchDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentDetailResponseDto> {
    return this.documents.confirmUploadBatch(id, dto.files, user);
  }

  @Get(':id/files/:fileId/download')
  @RequirePermission('document:view')
  download(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DownloadUrlResponseDto> {
    return this.documents.downloadUrl(id, fileId, user);
  }

  @Get(':id/files/:fileId/preview')
  @RequirePermission('document:view')
  preview(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Query('retryFailed') retryFailed: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.previewUrl(id, fileId, user, {
      retryFailed: retryFailed === '1' || retryFailed === 'true',
    });
  }

  @Get(':id/files/:fileId/zip-entries')
  @RequirePermission('document:view')
  zipEntries(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.zipEntries(id, fileId, user);
  }

  @Get(':id/files/:fileId/zip-entry')
  @RequirePermission('document:view')
  zipEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Query('path') entryPath: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.zipEntryUrl(id, fileId, entryPath ?? '', user);
  }

  @Post(':id/participants')
  @RequirePermission('working-paper:upload')
  addParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddDocumentParticipantDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentDetailResponseDto> {
    return this.documents.addParticipant(id, dto, user);
  }

  @Delete(':id/participants/:userId')
  @RequirePermission('working-paper:upload')
  removeParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) participantUserId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentDetailResponseDto> {
    return this.documents.removeParticipant(id, participantUserId, user);
  }

  /** Move the document through Draft→Ready→UnderReview→SignedOff (sign-off = Super Admin). */
  @Post(':id/status')
  @RequirePermission('working-paper:upload')
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetDocumentStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentDetailResponseDto> {
    return this.documents.setStatus(id, dto, user);
  }
}
