import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { ReviewsService } from './reviews.service';
import {
  DecideReviewDto,
  ReviewListQueryDto,
  ReviewListResponseDto,
  ReviewResponseDto,
  SubmitReviewDto,
} from './presentation/dto/review.dto';

@ApiTags('reviews')
@ApiBearerAuth()
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post()
  @RequirePermission('review:submit')
  submit(
    @Body() dto: SubmitReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReviewResponseDto> {
    return this.reviews.submit(dto, user);
  }

  @Get()
  @RequirePermission('review:decide')
  list(
    @Query() query: ReviewListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReviewListResponseDto> {
    return this.reviews.list(query, user);
  }

  @Get(':id')
  @RequirePermission('review:submit')
  getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReviewResponseDto> {
    return this.reviews.getOne(id, user);
  }

  @Post(':id/decide')
  @RequirePermission('review:decide')
  decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReviewResponseDto> {
    return this.reviews.decide(id, dto, user);
  }
}
