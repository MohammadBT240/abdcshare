import type { FilterQuery } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';
import {
  inferRequestStageName,
  REQUEST_STAGE,
  SubmissionStatus,
} from '@abdcshare/shared';
import { batchAcceptedFileCounts } from '../../common/metrics/accepted-file-counts';
import { RequestEntity } from './infrastructure/persistence/request.entity';
import { RequestStageEntity } from '../request-stages/infrastructure/persistence/request-stage.entity';
import { RequestHistoryEntity } from './infrastructure/persistence/request-history.entity';
import { ClientSubmissionEntity } from '../submissions/infrastructure/persistence/client-submission.entity';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';

const STAGE_CHANGED = 'StageChanged';

/**
 * Recompute and persist request.stage from submissions / file review / status.
 * Writes StageChanged history when the name changes (no notifications).
 */
export async function syncInferredRequestStage(
  em: EntityManager,
  requestId: string,
  opts: { actorId?: string | null } = {},
): Promise<RequestStageEntity | null> {
  const request = await em.findOne(
    RequestEntity,
    { id: requestId },
    { populate: ['stage', 'status'] },
  );
  if (!request) return null;

  const [acceptedMap, submissions] = await Promise.all([
    batchAcceptedFileCounts(em, [requestId]),
    em.find(
      ClientSubmissionEntity,
      {
        request: requestId,
        status: { $ne: SubmissionStatus.Draft },
      } as FilterQuery<ClientSubmissionEntity>,
      { populate: ['files.replacesFile'] },
    ),
  ]);

  let hasStaffReviewActivity = false;
  for (const submission of submissions) {
    if (
      submission.status === SubmissionStatus.Accepted ||
      submission.status === SubmissionStatus.Returned
    ) {
      hasStaffReviewActivity = true;
    }
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
      if (
        f.status === SubmissionStatus.UnderReview ||
        f.status === SubmissionStatus.Returned ||
        f.status === SubmissionStatus.Accepted
      ) {
        hasStaffReviewActivity = true;
        break;
      }
    }
    if (hasStaffReviewActivity) break;
  }

  const targetName = inferRequestStageName({
    statusName: request.status?.name,
    expectedDocumentCount: request.expectedDocumentCount ?? 1,
    acceptedFileCount: acceptedMap.get(requestId) ?? 0,
    hasNonDraftSubmission: submissions.length > 0,
    hasStaffReviewActivity,
  });

  let stage = await em.findOne(RequestStageEntity, {
    name: targetName,
    isActive: true,
  });
  if (!stage) {
    stage =
      (await em.findOne(RequestStageEntity, { name: targetName })) ??
      (await em.findOne(RequestStageEntity, {
        name: REQUEST_STAGE.NotStarted,
      }));
  }
  if (!stage) return null;

  const fromValue = request.stage?.name ?? null;
  if (fromValue === stage.name) return stage;

  request.stage = stage;
  em.create(RequestHistoryEntity, {
    request,
    actor: opts.actorId
      ? em.getReference(UserEntity, opts.actorId)
      : null,
    eventType: STAGE_CHANGED,
    module: 'requests',
    fromValue,
    toValue: stage.name,
    note: 'Inferred from activity',
  });
  return stage;
}
