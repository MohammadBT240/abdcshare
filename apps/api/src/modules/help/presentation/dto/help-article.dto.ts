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
import { type PageMeta } from '@abdcshare/shared';
import { HELP_VISIBILITY_TOKENS } from '../../sync/help-content';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class CreateHelpArticleDto {
  @ApiProperty() @IsUUID() categoryId!: string;
  @ApiProperty() @IsString() @MaxLength(255) title!: string;
  @ApiProperty() @IsString() @MaxLength(255) slug!: string;
  @ApiProperty({ description: 'Tiptap/ProseMirror document JSON.' }) @IsObject() bodyJson!: Record<string, unknown>;
  @ApiProperty({ description: 'editor.getText() plain-text extract, for search.' }) @IsString() bodyText!: string;
  @ApiPropertyOptional({ description: 'One line shown under the title and in search results.' })
  @IsOptional() @IsString() @MaxLength(300) summary?: string | null;
  @ApiPropertyOptional({ enum: HELP_VISIBILITY_TOKENS, isArray: true, description: 'Roles or partner designations; empty = everyone.' })
  @IsOptional() @IsArray() @IsIn(HELP_VISIBILITY_TOKENS as string[], { each: true }) visibleToRoles?: string[];
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) order?: number;
}

export class UpdateHelpArticleDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() bodyJson?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsString() bodyText?: string;
  @ApiPropertyOptional({ description: 'One line shown under the title and in search results.' })
  @IsOptional() @IsString() @MaxLength(300) summary?: string | null;
  @ApiPropertyOptional({ enum: HELP_VISIBILITY_TOKENS, isArray: true, description: 'Roles or partner designations; empty = everyone.' })
  @IsOptional() @IsArray() @IsIn(HELP_VISIBILITY_TOKENS as string[], { each: true }) visibleToRoles?: string[];
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) order?: number;
}

export class HelpArticleListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiPropertyOptional({ enum: ['draft', 'published'] })
  @IsOptional() @IsIn(['draft', 'published']) status?: 'draft' | 'published';
}

export class HelpArticleSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() categoryId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() slug!: string;
  @ApiPropertyOptional() summary?: string | null;
  @ApiProperty({ enum: ['draft', 'published'] }) status!: 'draft' | 'published';
  @ApiProperty() order!: number;
  @ApiProperty({ enum: ['default', 'custom'] }) source!: 'default' | 'custom';
  @ApiProperty({ description: 'Built-in article changed in the app (the sync keeps the edits).' }) edited!: boolean;
  @ApiProperty() updatedAt!: Date;
}

export class HelpArticleCategoryRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
}

export class HelpArticleResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() categoryId!: string;
  @ApiProperty({ type: HelpArticleCategoryRefDto }) category!: HelpArticleCategoryRefDto;
  @ApiProperty() title!: string;
  @ApiProperty() slug!: string;
  @ApiPropertyOptional() summary?: string | null;
  @ApiProperty({ enum: ['default', 'custom'] }) source!: 'default' | 'custom';
  @ApiProperty() edited!: boolean;
  @ApiProperty({ type: [HelpArticleSummaryDto] }) related!: HelpArticleSummaryDto[];
  @ApiPropertyOptional({ description: "The viewer's own 'Was this helpful?' answer." }) myFeedback?: boolean | null;
  @ApiProperty() bodyJson!: Record<string, unknown>;
  @ApiProperty({ type: [String] }) visibleToRoles!: string[];
  @ApiProperty({ enum: ['draft', 'published'] }) status!: 'draft' | 'published';
  @ApiProperty() order!: number;
  @ApiProperty() updatedAt!: Date;
  @ApiPropertyOptional() publishedAt?: Date | null;
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
  @ApiPropertyOptional() description?: string | null;
  @ApiProperty({ type: [HelpArticleSummaryDto] }) articles!: HelpArticleSummaryDto[];
}
