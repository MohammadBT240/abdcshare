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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { DocumentsService } from './documents.service';
import {
  AddDocumentParticipantDto,
  ConfirmBatchDto,
  ConfirmUploadDto,
  CreateDocumentDto,
  PresignBatchDto,
  DocumentDetailResponseDto,
  DocumentListQueryDto,
  DocumentListResponseDto,
  DownloadUrlResponseDto,
  PresignedUploadResponseDto,
  PresignUploadDto,
  SetDocumentStatusDto,
  UpdateDocumentDto,
} from './presentation/dto/document.dto';

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  /** Create a document. FinalReport is enforced Super-Admin-only in the service. */
  @Post()
  @RequirePermission('working-paper:upload')
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

  @Get(':id')
  @RequirePermission('document:view')
  getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentDetailResponseDto> {
    return this.documents.getOne(id, user);
  }

  @Patch(':id')
  @RequirePermission('working-paper:upload')
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
  @RequirePermission('working-paper:upload')
  presign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PresignUploadDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PresignedUploadResponseDto> {
    return this.documents.presignUpload(id, dto, user);
  }

  @Post(':id/files')
  @RequirePermission('working-paper:upload')
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmUploadDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentDetailResponseDto> {
    return this.documents.confirmUpload(id, dto, user);
  }

  @Post(':id/files/presign-batch')
  @RequirePermission('working-paper:upload')
  presignBatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PresignBatchDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PresignedUploadResponseDto[]> {
    return this.documents.presignUploadBatch(id, dto.files, user);
  }

  @Post(':id/files/batch')
  @RequirePermission('working-paper:upload')
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
