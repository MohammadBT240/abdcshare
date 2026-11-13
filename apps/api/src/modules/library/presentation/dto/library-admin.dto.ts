import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, Length, Matches } from 'class-validator';

export class LibraryDuplicateQueryDto {
  @ApiProperty({ description: 'SHA-256 of the file, hex (computed in the browser).' })
  @IsString() @Length(64, 64) @Matches(/^[0-9a-fA-F]{64}$/) hash!: string;
}

export class LibraryDuplicateDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() category!: string;
  @ApiProperty() uploadedBy!: string;
  @ApiPropertyOptional({ nullable: true }) publishedAt!: Date | null;
}

export class LibraryDuplicateGroupDto {
  @ApiProperty() hash!: string;
  @ApiProperty() items!: { id: string; title: string; status: string; uploadedBy: string; createdAt: Date }[];
}

export class LibraryTransferDto {
  @ApiProperty({ description: 'The new owner — an active internal user who can contribute.' })
  @IsUUID() userId!: string;
}

export class LibraryTransferAllDto {
  @ApiProperty() @IsUUID() fromUserId!: string;
  @ApiProperty() @IsUUID() toUserId!: string;
}

export class LibraryTransferResultDto {
  @ApiProperty() items!: number;
  @ApiProperty() collections!: number;
}

export class LibraryAttentionItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() status!: string;
  @ApiProperty() uploadedBy!: { id: string; name: string };
  @ApiPropertyOptional({ nullable: true, description: 'Scan signature / error, or preview error code.' })
  detail!: string | null;
  @ApiProperty({ type: [String] }) departments!: string[];
  @ApiProperty() updatedAt!: Date;
}

export class LibraryAttentionDto {
  @ApiProperty() ownerDeactivated!: { id: string; name: string; items: number; collections: number }[];
  @ApiProperty({ type: [LibraryAttentionItemDto] }) orphanedRestricted!: LibraryAttentionItemDto[];
  @ApiProperty({ type: [LibraryAttentionItemDto] }) quarantined!: LibraryAttentionItemDto[];
  @ApiProperty({ type: [LibraryAttentionItemDto] }) scanErrors!: LibraryAttentionItemDto[];
  @ApiProperty({ type: [LibraryAttentionItemDto] }) failedPreviews!: LibraryAttentionItemDto[];
  @ApiProperty() openReports!: number;
}
