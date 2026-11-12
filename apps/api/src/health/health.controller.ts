import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { JobsService, type OpsHealth } from '../modules/ops/jobs.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly jobs: JobsService) {}

  /** Liveness: the API process answers. */
  @Public()
  @Get()
  check(): { status: string; ts: string } {
    return { status: 'ok', ts: new Date().toISOString() };
  }

  /**
   * Operations check for uptime monitors (S4): outbox backlog/failures, Redis, clamd + signature age.
   * 503 when degraded. No data beyond counts and ages.
   */
  @Public()
  @Get('ops')
  async ops(@Res({ passthrough: true }) res: Response): Promise<OpsHealth> {
    const health = await this.jobs.opsHealth();
    if (health.status !== 'ok') res.status(503);
    return health;
  }
}
