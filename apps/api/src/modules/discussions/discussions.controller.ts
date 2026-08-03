import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { DiscussionsService } from './discussions.service';
import {
  MultipartAbortDto,
  MultipartCompleteDto,
  MultipartCreateDto,
  MultipartSignPartsDto,
} from '../../common/storage/multipart.dto';
import {
  AttachmentConfirmDto,
  AttachmentPresignDto,
  EditMessageDto,
  MarkReadDto,
  MessageListQueryDto,
  MessageListResponseDto,
  MessageResponseDto,
  PostMessageDto,
} from './presentation/dto/discussion.dto';

@ApiTags('discussions')
@ApiBearerAuth()
@Controller()
export class DiscussionsController {
  constructor(private readonly discussions: DiscussionsService) {}

  @Post('requests/:requestId/messages')
  @RequirePermission('discussion:participate')
  post(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: PostMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponseDto> {
    return this.discussions.post(requestId, dto, user);
  }

  @Get('requests/:requestId/messages')
  @RequirePermission('discussion:participate')
  list(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Query() query: MessageListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageListResponseDto> {
    return this.discussions.list(requestId, query, user);
  }

  @Post('requests/:requestId/messages/read')
  @RequirePermission('discussion:participate')
  markRead(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: MarkReadDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    return this.discussions.markRead(requestId, dto, user);
  }

  @Patch('messages/:id')
  @RequirePermission('discussion:participate')
  edit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EditMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponseDto> {
    return this.discussions.edit(id, dto, user);
  }

  @Post('messages/:id/attachments/presign')
  @RequirePermission('discussion:participate')
  presign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttachmentPresignDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.discussions.presignAttachment(id, dto, user);
  }

  @Post('messages/:id/attachments')
  @RequirePermission('discussion:participate')
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttachmentConfirmDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponseDto> {
    return this.discussions.confirmAttachment(id, dto, user);
  }

  @Post('messages/:id/attachments/multipart')
  @RequirePermission('discussion:participate')
  createMultipart(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MultipartCreateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.discussions.createMultipart(id, dto, user);
  }

  @Post('messages/:id/attachments/multipart/:uploadId/parts')
  @RequirePermission('discussion:participate')
  signMultipartParts(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('uploadId') uploadId: string,
    @Body() dto: MultipartSignPartsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.discussions.signMultipartParts(id, uploadId, dto, user);
  }

  @Post('messages/:id/attachments/multipart/:uploadId/complete')
  @RequirePermission('discussion:participate')
  completeMultipart(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('uploadId') uploadId: string,
    @Body() dto: MultipartCompleteDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponseDto> {
    return this.discussions.completeMultipart(id, uploadId, dto, user);
  }

  @Post('messages/:id/attachments/multipart/:uploadId/abort')
  @RequirePermission('discussion:participate')
  abortMultipart(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('uploadId') uploadId: string,
    @Body() dto: MultipartAbortDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.discussions.abortMultipart(id, uploadId, dto, user);
  }
}
