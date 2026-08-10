import type { FilterQuery } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';
import { SubmissionStatus } from '@abdcshare/shared';
import { ClientSubmissionEntity } from '../../modules/submissions/infrastructure/persistence/client-submission.entity';

/** Accepted current (non-superseded) submission files per request. */
export async function batchAcceptedFileCounts(
  em: EntityManager,
  requestIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const id of requestIds) counts.set(id, 0);
  if (requestIds.length === 0) return counts;

  const submissions = await em.find(
    ClientSubmissionEntity,
    {
      request: { $in: requestIds },
      status: { $ne: SubmissionStatus.Draft },
    } as FilterQuery<ClientSubmissionEntity>,
    { populate: ['files.replacesFile', 'request'] },
  );

  for (const submission of submissions) {
    const files = submission.files.isInitialized()
      ? submission.files.getItems()
      : [];
    const superseded = new Set(
      files
        .map((f) => f.replacesFile?.id)
        .filter((id): id is string => Boolean(id)),
    );
    const accepted = files.filter(
      (f) => !superseded.has(f.id) && f.status === SubmissionStatus.Accepted,
    ).length;
    const requestId = submission.request.id;
    counts.set(requestId, (counts.get(requestId) ?? 0) + accepted);
  }
  return counts;
}

export type FileSubmissionCounts = {
  uploaded: number;
  awaitingReview: number;
  underReview: number;
  returned: number;
  accepted: number;
};

/** Current non-draft, non-superseded files by file status (engagement-wide). */
export async function countCurrentFilesByStatus(
  em: EntityManager,
  engagementId: string,
): Promise<FileSubmissionCounts> {
  const counts: FileSubmissionCounts = {
    uploaded: 0,
    awaitingReview: 0,
    underReview: 0,
    returned: 0,
    accepted: 0,
  };

  const submissions = await em.find(
    ClientSubmissionEntity,
    {
      request: { engagement: engagementId },
      status: { $ne: SubmissionStatus.Draft },
    } as FilterQuery<ClientSubmissionEntity>,
    { populate: ['files.replacesFile'] },
  );

  for (const submission of submissions) {
    const files = submission.files.isInitialized()
      ? submission.files.getItems()
      : [];
    const superseded = new Set(
      files
        .map((f) => f.replacesFile?.id)
        .filter((id): id is string => Boolean(id)),
    );
    for (const f of files) {
      if (superseded.has(f.id)) continue;
      counts.uploaded += 1;
      if (f.status === SubmissionStatus.Pending) counts.awaitingReview += 1;
      else if (f.status === SubmissionStatus.UnderReview) counts.underReview += 1;
      else if (f.status === SubmissionStatus.Returned) counts.returned += 1;
      else if (f.status === SubmissionStatus.Accepted) counts.accepted += 1;
    }
  }
  return counts;
}
