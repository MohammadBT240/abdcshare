import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ROLE_NAMES, type PageMeta } from '@abdcshare/shared';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class CreateHelpArticleDto {
  @ApiProperty() @IsUUID() categoryId!: string;
  @ApiProperty() @IsString() @MaxLength(255) title!: string;
  @ApiProperty() @IsString() @MaxLength(255) slug!: string;
  @ApiProperty({ description: 'Tiptap/ProseMirror document JSON.' }) @IsObject() bodyJson!: Record<string, unknown>;
  @ApiProperty({ description: 'editor.getText() plain-text extract, for search.' }) @IsString() bodyText!: string;
  @ApiPropertyOptional({ enum: ROLE_NAMES, isArray: true })
  @IsOptional() @IsArray() @IsIn(ROLE_NAMES, { each: true }) visibleToRoles?: string[];
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) order?: number;
}

export class UpdateHelpArticleDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() bodyJson?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsString() bodyText?: string;
  @ApiPropertyOptional({ enum: ROLE_NAMES, isArray: true })
  @IsOptional() @IsArray() @IsIn(ROLE_NAMES, { each: true }) visibleToRoles?: string[];
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) order?: number;
}

export class HelpArticleListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiPropertyOptional({ enum: ['draft', 'published'] })
  @IsOptional() @IsIn(['draft', 'published']) status?: 'draft' | 'published';
}

export class HelpArticleResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() categoryId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() bodyJson!: Record<string, unknown>;
  @ApiProperty({ type: [String] }) visibleToRoles!: string[];
  @ApiProperty({ enum: ['draft', 'published'] }) status!: 'draft' | 'published';
  @ApiProperty() order!: number;
  @ApiProperty() updatedAt!: Date;
  @ApiPropertyOptional() publishedAt?: Date | null;
}

export class HelpArticleSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() categoryId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ enum: ['draft', 'published'] }) status!: 'draft' | 'published';
  @ApiProperty() order!: number;
}

export class HelpArticleListResponseDto {
  @ApiProperty({ type: [HelpArticleSummaryDto] }) data!: HelpArticleSummaryDto[];
  @ApiProperty() meta!: PageMeta;
}

export class HelpCategoryWithArticlesDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() order!: number;
  @ApiPropertyOptional() icon?: string | null;
  @ApiProperty({ type: [HelpArticleSummaryDto] }) articles!: HelpArticleSummaryDto[];
}
