import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { SubmissionsService } from './submissions.service';
import {
  CreateSubmissionDto,
  ReviewSubmissionDto,
  SubmissionListQueryDto,
  SubmissionListResponseDto,
  SubmissionResponseDto,
} from './presentation/dto/submission.dto';

@ApiTags('submissions')
@ApiBearerAuth()
@Controller()
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  /** Client responds to a request. */
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

  /** Staff accepts or returns a pending submission. */
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
