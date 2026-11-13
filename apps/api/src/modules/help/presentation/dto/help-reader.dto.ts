import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class HelpSearchResultDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() summary?: string | null;
  @ApiProperty() category!: string;
  @ApiPropertyOptional({ description: 'Body excerpt; matches are wrapped in ⟦ ⟧ (render as <mark>).' })
  snippet?: string | null;
}

export class HelpFeedbackDto {
  @ApiProperty() @IsBoolean() helpful!: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) comment?: string | null;
}

export class HelpFeedbackCommentDto {
  @ApiProperty() comment!: string;
  @ApiProperty() helpful!: boolean;
  @ApiProperty() by!: string;
  @ApiProperty() at!: Date;
}

export class HelpFeedbackStatsDto {
  @ApiProperty() articleId!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() title!: string;
  @ApiProperty() helpful!: number;
  @ApiProperty() notHelpful!: number;
  @ApiPropertyOptional() lastAt?: Date | null;
  @ApiProperty({ type: [HelpFeedbackCommentDto] }) comments!: HelpFeedbackCommentDto[];
}
