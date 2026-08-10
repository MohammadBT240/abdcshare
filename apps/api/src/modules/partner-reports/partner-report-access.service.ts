import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { PartnerReportReporterEntity } from './infrastructure/persistence/partner-report-reporter.entity';

/** Shared allow-list lookup for PermissionsGuard and /auth/me. */
@Injectable()
export class PartnerReportAccessService {
  constructor(private readonly em: EntityManager) {}

  async isAllowedReporter(userId: string): Promise<boolean> {
    const row = await this.em.findOne(PartnerReportReporterEntity, { user: userId });
    return row != null;
  }
}
