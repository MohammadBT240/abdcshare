import { PartnerReportAccessService } from './partner-report-access.service';
import { PartnerReportReporterEntity } from './infrastructure/persistence/partner-report-reporter.entity';

describe('PartnerReportAccessService', () => {
  it('returns true when the user is on the allow-list', async () => {
    const em = {
      findOne: jest.fn(async () => ({ user: { id: 's1' } })),
    };
    const service = new PartnerReportAccessService(em as never);
    await expect(service.isAllowedReporter('s1')).resolves.toBe(true);
    expect(em.findOne).toHaveBeenCalledWith(PartnerReportReporterEntity, { user: 's1' });
  });

  it('returns false when the user is not on the allow-list', async () => {
    const em = { findOne: jest.fn(async () => null) };
    const service = new PartnerReportAccessService(em as never);
    await expect(service.isAllowedReporter('s2')).resolves.toBe(false);
  });
});
