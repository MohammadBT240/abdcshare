import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { SubmissionsService } from './submissions.service';
import {
  MultipartAbortDto,
  MultipartCompleteDto,
  MultipartCreateDto,
  MultipartCreateResponseDto,
  MultipartSignPartsDto,
  MultipartSignPartsResponseDto,
} from '../../common/storage/multipart.dto';
import {
  CreateSubmissionDto,
  ReopenSubmissionFileDto,
  ReviewSubmissionDto,
  ReviewSubmissionFileDto,
  SubmissionFileConfirmDto,
  SubmissionFilePresignDto,
  SubmissionListQueryDto,
  SubmissionListResponseDto,
  SubmissionResponseDto,
} from './presentation/dto/submission.dto';

@ApiTags('submissions')
@ApiBearerAuth()
@Controller()
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  /** Client starts a draft response (no staff notification until finalize). */
  @Post('requests/:requestId/submissions')
  @RequirePermission('submission:respond')
  create(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: CreateSubmissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto> {
    return this.submissions.create(requestId, dto, user);
  }

  @Get('requests/:requestId/submissions')
  @RequirePermission('request:view')
  list(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Query() query: SubmissionListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SubmissionListResponseDto> {
    return this.submissions.list(requestId, query, user);
  }

  @Get('submissions/:id')
  @RequirePermission('request:view')
  getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto> {
    return this.submissions.getOne(id, user);
  }

  /** Promote draft → Pending and notify staff (after uploads succeed). */
  @Post('submissions/:id/finalize')
  @RequirePermission('submission:respond')
  finalize(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto> {
    return this.submissions.finalize(id, user);
  }

  /** Discard an unfinished draft. */
  @Delete('submissions/:id')
  @HttpCode(204)
  @RequirePermission('submission:respond')
  async discard(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.submissions.discardDraft(id, user);
  }

  @Post('submissions/:id/files/presign')
  @RequirePermission('submission:respond')
  presignFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmissionFilePresignDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.submissions.presignFile(id, dto, user);
  }

  @Post('submissions/:id/files')
  @RequirePermission('submission:respond')
  confirmFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmissionFileConfirmDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto> {
    return this.submissions.confirmFile(id, dto, user);
  }

  @Post('submissions/:id/files/multipart')
  @RequirePermission('submission:respond')
  createMultipart(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MultipartCreateDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MultipartCreateResponseDto> {
    return this.submissions.createMultipart(id, dto, user);
  }

  @Post('submissions/:id/files/multipart/:uploadId/parts')
  @RequirePermission('submission:respond')
  signParts(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('uploadId') uploadId: string,
    @Body() dto: MultipartSignPartsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MultipartSignPartsResponseDto> {
    return this.submissions.signMultipartParts(id, uploadId, dto.storageKey, dto, user);
  }

  @Post('submissions/:id/files/multipart/:uploadId/complete')
  @RequirePermission('submission:respond')
  completeMultipart(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('uploadId') uploadId: string,
    @Body() dto: MultipartCompleteDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto> {
    return this.submissions.completeMultipart(id, uploadId, dto, user);
  }

  @Post('submissions/:id/files/multipart/:uploadId/abort')
  @RequirePermission('submission:respond')
  abortMultipart(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('uploadId') uploadId: string,
    @Body() dto: MultipartAbortDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    return this.submissions.abortMultipart(id, uploadId, dto, user);
  }

  @Get('submissions/:id/files/:fileId/download')
  @RequirePermission('request:view')
  downloadFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ url: string }> {
    return this.submissions.downloadUrl(id, fileId, user);
  }

  /** Queue a zip of all current files; download link arrives via notification. */
  @Post('submissions/:id/export')
  @RequirePermission('request:view')
  exportSubmission(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ accepted: true; jobId: string }> {
    return this.submissions.requestExport(id, user);
  }

  @Get('submissions/:id/files/:fileId/preview')
  @RequirePermission('request:view')
  previewFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Query('retryFailed') retryFailed: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.submissions.previewUrl(id, fileId, user, {
      retryFailed: retryFailed === '1' || retryFailed === 'true',
    });
  }

  @Get('submissions/:id/files/:fileId/zip-entries')
  @RequirePermission('request:view')
  zipEntries(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.submissions.zipEntries(id, fileId, user);
  }

  @Get('submissions/:id/files/:fileId/zip-entry')
  @RequirePermission('request:view')
  zipEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Query('path') entryPath: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.submissions.zipEntryUrl(id, fileId, entryPath ?? '', user);
  }

  /** Per-file accept/return — parent status is derived from current files. */
  @Post('submissions/:id/files/:fileId/review')
  @RequirePermission('submission:review')
  reviewFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Body() dto: ReviewSubmissionFileDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto> {
    return this.submissions.reviewFile(id, fileId, dto, user);
  }

  /** Reopen an Accepted file for revision (Accepted → Returned with reason). */
  @Post('submissions/:id/files/:fileId/reopen')
  @RequirePermission('submission:review')
  reopenFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Body() dto: ReopenSubmissionFileDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto> {
    return this.submissions.reopenFile(id, fileId, dto, user);
  }

  /** Bulk: apply decision to all current Pending files (Accept all / Return all). */
  @Post('submissions/:id/review')
  @RequirePermission('submission:review')
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewSubmissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto> {
    return this.submissions.review(id, dto, user);
  }
}
