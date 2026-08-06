import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import { type Paginated, SubmissionStatus } from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import { engagementScopeWhere, resolveScope } from '../../common/security/access-scope';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { STORAGE, type StoragePort } from '../../common/storage/storage.port';
import { UPLOAD_MAX_BYTES } from '../../common/storage/upload.constants';
import { presignAvatar } from '../../common/storage/presign-avatar';
import type {
  MultipartAbortDto,
  MultipartCompleteDto,
  MultipartCreateDto,
  MultipartSignPartsDto,
} from '../../common/storage/multipart.dto';
import {
  NotificationsService,
  type NotifyRecipient,
} from '../notifications/notifications.service';
import {
  engagementClientContactRecipients,
  mergeRecipients,
} from '../notifications/recipient-helpers';
import { RequestEntity } from '../requests/infrastructure/persistence/request.entity';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import { SubmissionFileEntity } from '../submissions/infrastructure/persistence/submission-file.entity';
import { DiscussionMessageEntity } from './infrastructure/persistence/discussion-message.entity';
import { DiscussionMentionEntity } from './infrastructure/persistence/discussion-mention.entity';
import { DiscussionReadEntity } from './infrastructure/persistence/discussion-read.entity';
import { DiscussionAttachmentEntity } from './infrastructure/persistence/discussion-attachment.entity';
import { DiscussionFileReferenceEntity } from './infrastructure/persistence/discussion-file-reference.entity';
import type {
  AttachmentConfirmDto,
  AttachmentPresignDto,
  EditMessageDto,
  MarkReadDto,
  MessageListQueryDto,
  PostMessageDto,
} from './presentation/dto/discussion.dto';
import { MessageResponseDto } from './presentation/dto/discussion.dto';

const MESSAGE_POPULATE = [
  'author',
  'parentMessage',
  'mentions.mentionedUser',
  'attachments',
  'fileRefs.submissionFile',
] as const;

@Injectable()
export class DiscussionsService {
  constructor(
    private readonly em: EntityManager,
    private readonly notifications: NotificationsService,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

  private requestWhere(requestId: string, user?: AuthenticatedUser): FilterQuery<RequestEntity> {
    const eng = engagementScopeWhere(resolveScope(user));
    return (Object.keys(eng).length ? { id: requestId, engagement: eng } : { id: requestId }) as FilterQuery<RequestEntity>;
  }

  private messageWhere(messageId: string, user?: AuthenticatedUser): FilterQuery<DiscussionMessageEntity> {
    const eng = engagementScopeWhere(resolveScope(user));
    return (Object.keys(eng).length
      ? { id: messageId, request: { engagement: eng } }
      : { id: messageId }) as FilterQuery<DiscussionMessageEntity>;
  }

  private async toDto(m: DiscussionMessageEntity): Promise<MessageResponseDto> {
    return {
      id: m.id,
      authorId: m.author.id,
      authorName: m.author.fullName ?? null,
      authorAvatarUrl: await presignAvatar(this.storage, m.author.avatarPath),
      parentMessageId: m.parentMessage ? m.parentMessage.id : null,
      body: m.body,
      mentionUserIds: m.mentions.getItems().map((x) => x.mentionedUser.id),
      attachments: m.attachments.getItems().map((a) => ({
        id: a.id,
        fileName: a.fileName,
        mimeType: a.mimeType ?? null,
        sizeBytes: a.sizeBytes ?? null,
      })),
      referencedFiles: m.fileRefs.getItems().map((r) => ({
        id: r.id,
        submissionFileId: r.submissionFile?.id ?? null,
        fileName: r.fileName,
        statusAtPost: r.statusAtPost,
        submissionId: r.submissionId ?? null,
      })),
      editedAt: m.editedAt ?? null,
      createdAt: m.createdAt,
    };
  }

  private async getMessage(id: string): Promise<MessageResponseDto> {
    const m = await this.em.findOneOrFail(DiscussionMessageEntity, { id }, {
      populate: MESSAGE_POPULATE as unknown as never,
    });
    return this.toDto(m);
  }

  /** Everyone attached to the request: engagement team + creator + assignees + client contacts + mentioned. */
  private async collectRecipients(
    request: RequestEntity,
    mentionIds: string[],
  ): Promise<NotifyRecipient[]> {
    const firm: NotifyRecipient[] = [];
    const add = (u?: UserEntity | null) => {
      if (u) firm.push({ userId: u.id, email: u.email ?? null });
    };
    for (const tm of request.engagement.team.getItems()) add(tm.user);
    add(request.engagement.createdBy ?? null);
    for (const a of request.assignees.getItems()) add(a.user);
    if (mentionIds.length) {
      const mentioned = await this.em.find(UserEntity, { id: { $in: mentionIds } });
      for (const u of mentioned) add(u);
    }
    const clients = await engagementClientContactRecipients(this.em, request.engagement.id);
    return mergeRecipients(firm, clients);
  }

  async post(requestId: string, dto: PostMessageDto, user: AuthenticatedUser): Promise<MessageResponseDto> {
    const request = await this.em.findOne(RequestEntity, this.requestWhere(requestId, user), {
      populate: [
        'engagement.team.user',
        'engagement.createdBy',
        'assignees.user',
      ],
    });
    if (!request) throw new NotFoundException('Request not found');

    const message = this.em.create(DiscussionMessageEntity, {
      request,
      author: this.em.getReference(UserEntity, user.userId),
      parentMessage: dto.parentMessageId
        ? this.em.getReference(DiscussionMessageEntity, dto.parentMessageId)
        : null,
      body: dto.body,
    });
    const mentionIds = [...new Set(dto.mentionUserIds ?? [])];
    for (const uid of mentionIds) {
      this.em.create(DiscussionMentionEntity, {
        message,
        mentionedUser: this.em.getReference(UserEntity, uid),
      });
    }

    const referencedFileIds = [...new Set(dto.referencedFileIds ?? [])];
    if (referencedFileIds.length > 0) {
      const files = await this.em.find(
        SubmissionFileEntity,
        {
          id: { $in: referencedFileIds },
          submission: { request: requestId },
        } as FilterQuery<SubmissionFileEntity>,
        { populate: ['submission'] },
      );
      if (files.length !== referencedFileIds.length) {
        throw new BadRequestException(
          'One or more referenced files were not found on this request',
        );
      }
      for (const file of files) {
        if (file.status === SubmissionStatus.Draft) {
          throw new BadRequestException('Cannot tag an unpublished draft file');
        }
        this.em.create(DiscussionFileReferenceEntity, {
          message,
          submissionFile: file,
          fileName: file.fileName,
          statusAtPost: file.status,
          submissionId: file.submission.id,
        });
      }
    }

    const recipients = await this.collectRecipients(request, mentionIds);
    const fileHint =
      referencedFileIds.length === 1
        ? ' (file tagged)'
        : referencedFileIds.length > 1
          ? ` (${referencedFileIds.length} files tagged)`
          : '';
    await this.notifications.emit({
      recipients,
      type: 'discussion.message',
      title: 'New message on a request',
      body: `${dto.body.slice(0, 120)}${fileHint}`.slice(0, 140),
      entityType: 'request',
      entityId: requestId,
      link: `/requests/${requestId}?tab=discussion`,
      excludeUserId: user.userId,
    });

    await this.em.persistAndFlush(message);
    return this.getMessage(message.id);
  }

  async list(
    requestId: string,
    query: MessageListQueryDto,
    user: AuthenticatedUser,
  ): Promise<Paginated<MessageResponseDto>> {
    const request = await this.em.findOne(RequestEntity, this.requestWhere(requestId, user));
    if (!request) throw new NotFoundException('Request not found');

    const { page, pageSize, limit, offset } = pageParams(query);
    const [rows, total] = await this.em.findAndCount(
      DiscussionMessageEntity,
      { request: requestId } as FilterQuery<DiscussionMessageEntity>,
      { populate: MESSAGE_POPULATE as unknown as never, orderBy: { createdAt: 'asc', id: 'asc' }, limit, offset },
    );
    return paginated(
      await Promise.all(rows.map((m) => this.toDto(m))),
      total,
      page,
      pageSize,
    );
  }

  async edit(messageId: string, dto: EditMessageDto, user: AuthenticatedUser): Promise<MessageResponseDto> {
    const message = await this.em.findOne(DiscussionMessageEntity, this.messageWhere(messageId, user), {
      populate: ['author'],
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.author.id !== user.userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }
    message.body = dto.body;
    message.editedAt = new Date();
    await this.em.flush();
    return this.getMessage(messageId);
  }

  async markRead(requestId: string, dto: MarkReadDto, user: AuthenticatedUser): Promise<{ ok: true }> {
    const request = await this.em.findOne(RequestEntity, this.requestWhere(requestId, user));
    if (!request) throw new NotFoundException('Request not found');
    let read = await this.em.findOne(DiscussionReadEntity, { request: requestId, user: user.userId });
    if (!read) {
      read = this.em.create(DiscussionReadEntity, {
        request,
        user: this.em.getReference(UserEntity, user.userId),
      });
    }
    read.lastReadMessage = dto.lastReadMessageId
      ? this.em.getReference(DiscussionMessageEntity, dto.lastReadMessageId)
      : read.lastReadMessage ?? null;
    read.updatedAt = new Date();
    await this.em.flush();
    return { ok: true };
  }

  private async loadMessageScoped(messageId: string, user: AuthenticatedUser): Promise<DiscussionMessageEntity> {
    const message = await this.em.findOne(DiscussionMessageEntity, this.messageWhere(messageId, user), {
      populate: ['request'],
    });
    if (!message) throw new NotFoundException('Message not found');
    return message;
  }

  async presignAttachment(messageId: string, dto: AttachmentPresignDto, user: AuthenticatedUser) {
    const message = await this.loadMessageScoped(messageId, user);
    return this.storage.presignUpload({
      keyPrefix: `discussions/${message.request.id}`,
      fileName: dto.fileName,
      contentType: dto.contentType,
    });
  }

  async confirmAttachment(
    messageId: string,
    dto: AttachmentConfirmDto,
    user: AuthenticatedUser,
  ): Promise<MessageResponseDto> {
    const message = await this.loadMessageScoped(messageId, user);
    this.em.create(DiscussionAttachmentEntity, {
      message,
      storageKey: dto.storageKey,
      fileName: dto.fileName,
      mimeType: dto.mimeType ?? null,
      sizeBytes: dto.sizeBytes ?? null,
    });
    await this.em.flush();
    return this.getMessage(messageId);
  }

  async createMultipart(messageId: string, dto: MultipartCreateDto, user: AuthenticatedUser) {
    const message = await this.loadMessageScoped(messageId, user);
    if (dto.sizeBytes != null && dto.sizeBytes > UPLOAD_MAX_BYTES) {
      throw new BadRequestException(
        `File exceeds maximum size of ${Math.floor(UPLOAD_MAX_BYTES / (1024 * 1024))} MB`,
      );
    }
    return this.storage.createMultipart({
      keyPrefix: `discussions/${message.request.id}`,
      fileName: dto.fileName,
      contentType: dto.contentType,
    });
  }

  async signMultipartParts(
    messageId: string,
    uploadId: string,
    dto: MultipartSignPartsDto,
    user: AuthenticatedUser,
  ) {
    const message = await this.loadMessageScoped(messageId, user);
    if (!dto.storageKey.includes(`discussions/${message.request.id}`)) {
      throw new BadRequestException('Invalid storage key for this message');
    }
    const parts = await Promise.all(
      dto.partNumbers.map(async (partNumber) => {
        const { url } = await this.storage.presignPart(dto.storageKey, uploadId, partNumber);
        return { partNumber, url };
      }),
    );
    return { parts };
  }

  async completeMultipart(
    messageId: string,
    uploadId: string,
    dto: MultipartCompleteDto,
    user: AuthenticatedUser,
  ): Promise<MessageResponseDto> {
    const message = await this.loadMessageScoped(messageId, user);
    if (dto.sizeBytes > UPLOAD_MAX_BYTES) {
      throw new BadRequestException(
        `File exceeds maximum size of ${Math.floor(UPLOAD_MAX_BYTES / (1024 * 1024))} MB`,
      );
    }
    if (!dto.storageKey.includes(`discussions/${message.request.id}`)) {
      throw new BadRequestException('Invalid storage key for this message');
    }
    await this.storage.completeMultipart(dto.storageKey, uploadId, dto.parts);
    const head = await this.storage.head(dto.storageKey);
    if (!head) throw new BadRequestException('Uploaded object not found');
    if (dto.sizeBytes > 0 && head.sizeBytes !== dto.sizeBytes) {
      throw new BadRequestException(
        `Uploaded size mismatch (expected ${dto.sizeBytes}, got ${head.sizeBytes})`,
      );
    }
    return this.confirmAttachment(
      messageId,
      {
        storageKey: dto.storageKey,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: head.sizeBytes,
      },
      user,
    );
  }

  async abortMultipart(
    messageId: string,
    uploadId: string,
    dto: MultipartAbortDto,
    user: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    await this.loadMessageScoped(messageId, user);
    await this.storage.abortMultipart(dto.storageKey, uploadId);
    return { ok: true };
  }
}
