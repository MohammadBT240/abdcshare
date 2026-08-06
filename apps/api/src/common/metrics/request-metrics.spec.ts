import {
  computeRequestProgressPercent,
  inferRequestStageName,
  isRequestDone,
  isRequestOverdue,
  REQUEST_STAGE,
  statusProgressPercent,
  weightedProgressPercent,
} from '@abdcshare/shared';

describe('request-metrics (shared)', () => {
  describe('isRequestDone', () => {
    it('treats Accepted and Closed as done', () => {
      expect(isRequestDone('Accepted')).toBe(true);
      expect(isRequestDone('Closed')).toBe(true);
    });

    it('treats complete/done aliases as done', () => {
      expect(isRequestDone('Complete')).toBe(true);
      expect(isRequestDone('Done')).toBe(true);
    });

    it('does not treat Open/Returned as done', () => {
      expect(isRequestDone('Open')).toBe(false);
      expect(isRequestDone('Returned')).toBe(false);
      expect(isRequestDone('Pending Client')).toBe(false);
    });
  });

  describe('isRequestOverdue', () => {
    const noon = (isoDate: string) => {
      const d = new Date(isoDate);
      d.setHours(12, 0, 0, 0);
      return d;
    };

    it('marks past-due Open as overdue', () => {
      const now = noon('2026-08-04');
      expect(isRequestOverdue(noon('2026-08-03'), 'Open', now)).toBe(true);
    });

    it('does not mark due-today as overdue', () => {
      const now = noon('2026-08-04');
      expect(isRequestOverdue(noon('2026-08-04'), 'Open', now)).toBe(false);
    });

    it('does not mark Accepted past-due as overdue', () => {
      const now = noon('2026-08-04');
      expect(isRequestOverdue(noon('2026-08-01'), 'Accepted', now)).toBe(false);
    });
  });

  describe('computeRequestProgressPercent', () => {
    it('ignores done status and uses accepted / expected only', () => {
      expect(computeRequestProgressPercent(21, 0, 'Accepted')).toBe(0);
      expect(computeRequestProgressPercent(5, 0, 'Closed')).toBe(0);
      expect(computeRequestProgressPercent(4, 1, 'Accepted')).toBe(25);
    });

    it('computes accepted / expected capped at 100', () => {
      expect(computeRequestProgressPercent(21, 16, 'Open')).toBe(76);
      expect(computeRequestProgressPercent(4, 6, 'Open')).toBe(100);
    });
  });

  describe('statusProgressPercent', () => {
    it('is 100% when every request is done', () => {
      expect(
        statusProgressPercent([
          { statusName: 'Accepted' },
          { statusName: 'Closed' },
        ]),
      ).toBe(100);
    });

    it('treats Accepted as complete even when docs are incomplete', () => {
      expect(
        statusProgressPercent([
          { statusName: 'Accepted' },
        ]),
      ).toBe(100);
    });

    it('averages done vs open requests equally', () => {
      expect(
        statusProgressPercent([
          { statusName: 'Accepted' },
          { statusName: 'Open' },
        ]),
      ).toBe(50);
    });

    it('ignores empty caller lists', () => {
      expect(statusProgressPercent([])).toBe(0);
    });
  });

  describe('weightedProgressPercent', () => {
    it('weights by expected docs across requests (status ignored)', () => {
      expect(
        weightedProgressPercent([
          { expectedDocumentCount: 21, acceptedFileCount: 16, statusName: 'Open' },
        ]),
      ).toBe(76);
      expect(
        weightedProgressPercent([
          { expectedDocumentCount: 3, acceptedFileCount: 2, statusName: 'Accepted' },
        ]),
      ).toBe(67);
    });

    it('ignores empty caller lists', () => {
      expect(weightedProgressPercent([])).toBe(0);
    });
  });

  describe('inferRequestStageName', () => {
    it('returns Not Started with no submissions', () => {
      expect(
        inferRequestStageName({
          statusName: 'Open',
          expectedDocumentCount: 5,
          acceptedFileCount: 0,
          hasNonDraftSubmission: false,
          hasStaffReviewActivity: false,
        }),
      ).toBe(REQUEST_STAGE.NotStarted);
    });

    it('returns Submitted when client responded but staff has not reviewed', () => {
      expect(
        inferRequestStageName({
          statusName: 'Open',
          expectedDocumentCount: 5,
          acceptedFileCount: 0,
          hasNonDraftSubmission: true,
          hasStaffReviewActivity: false,
        }),
      ).toBe(REQUEST_STAGE.Submitted);
    });

    it('returns In Progress when staff has review activity', () => {
      expect(
        inferRequestStageName({
          statusName: 'Open',
          expectedDocumentCount: 21,
          acceptedFileCount: 10,
          hasNonDraftSubmission: true,
          hasStaffReviewActivity: true,
        }),
      ).toBe(REQUEST_STAGE.InProgress);
    });

    it('returns Reviewed when status is Accepted or enough files accepted', () => {
      expect(
        inferRequestStageName({
          statusName: 'Accepted',
          expectedDocumentCount: 21,
          acceptedFileCount: 0,
          hasNonDraftSubmission: true,
          hasStaffReviewActivity: true,
        }),
      ).toBe(REQUEST_STAGE.Reviewed);
      expect(
        inferRequestStageName({
          statusName: 'Open',
          expectedDocumentCount: 10,
          acceptedFileCount: 10,
          hasNonDraftSubmission: true,
          hasStaffReviewActivity: true,
        }),
      ).toBe(REQUEST_STAGE.Reviewed);
    });
  });
});
