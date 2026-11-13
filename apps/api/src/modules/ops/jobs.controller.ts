import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { JobsService } from './jobs.service';

/** `/admin/jobs` (S4): queue + outbox visibility and audited re-drive. Platform Admin only. */
@ApiTags('ops')
@ApiBearerAuth()
@Controller('admin/jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  @RequirePermission('system:jobs')
  overview() {
    return this.jobs.overview();
  }

  @Post('outbox/:id/redrive')
  @HttpCode(200)
  @RequirePermission('system:jobs')
  redrive(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobs.redriveOutbox(id);
  }
}
