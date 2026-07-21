import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import type { PageMeta } from '@abdcshare/shared';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class PostMessageDto {
  @ApiProperty() @IsString() body!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() parentMessageId?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) mentionUserIds?: string[];
}

export class EditMessageDto {
  @ApiProperty() @IsString() body!: string;
}

export class MarkReadDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() lastReadMessageId?: string;
}

export class AttachmentPresignDto {
  @ApiProperty() @IsString() @MaxLength(255) fileName!: string;
  @ApiProperty() @IsString() @MaxLength(150) contentType!: string;
}

export class AttachmentConfirmDto {
  @ApiProperty() @IsString() storageKey!: string;
  @ApiProperty() @IsString() @MaxLength(255) fileName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) mimeType?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sizeBytes?: number;
}

export class MessageListQueryDto extends PaginationQueryDto {}

export class DiscussionAttachmentDto {
  @ApiProperty() id!: string;
  @ApiProperty() fileName!: string;
  @ApiPropertyOptional() mimeType?: string | null;
  @ApiPropertyOptional() sizeBytes?: number | null;
}

export class MessageResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() authorId!: string;
  @ApiPropertyOptional() authorName?: string | null;
  @ApiPropertyOptional() parentMessageId?: string | null;
  @ApiProperty() body!: string;
  @ApiProperty({ type: [String] }) mentionUserIds!: string[];
  @ApiProperty({ type: [DiscussionAttachmentDto] }) attachments!: DiscussionAttachmentDto[];
  @ApiPropertyOptional() editedAt?: Date | null;
  @ApiProperty() createdAt!: Date;
}

export class MessageListResponseDto {
  @ApiProperty({ type: [MessageResponseDto] }) data!: MessageResponseDto[];
  @ApiProperty() meta!: PageMeta;
}
