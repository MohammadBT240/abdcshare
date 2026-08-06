import type { RequestListItem } from '@/features/requests/hooks/use-requests';

export interface RequestClassGroup {
  classId: number;
  className: string;
  requests: RequestListItem[];
}

export interface RequestEngagementGroup {
  engagementId: string;
  engagementTitle: string;
  engagementReferenceCode: string;
  phase: RequestListItem['phase'] | null;
  classes: RequestClassGroup[];
}

export interface RequestClientGroup {
  clientId: string;
  clientName: string;
  requestCount: number;
  engagementCount: number;
  engagements: RequestEngagementGroup[];
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

/** Nest flat request rows into Client → Engagement → Class → leaves. */
export function groupRequestsByClientEngagementClass(
  rows: RequestListItem[],
): RequestClientGroup[] {
  const clients = new Map<
    string,
    {
      clientId: string;
      clientName: string;
      engagements: Map<
        string,
        {
          engagementId: string;
          engagementTitle: string;
          engagementReferenceCode: string;
          phase: RequestListItem['phase'] | null;
          classes: Map<number, RequestClassGroup>;
        }
      >;
    }
  >();

  for (const row of rows) {
    const clientId = row.clientId || '__unknown__';
    const clientName = row.clientName || 'Unknown client';
    let client = clients.get(clientId);
    if (!client) {
      client = { clientId, clientName, engagements: new Map() };
      clients.set(clientId, client);
    }

    let engagement = client.engagements.get(row.engagementId);
    if (!engagement) {
      engagement = {
        engagementId: row.engagementId,
        engagementTitle: row.engagementTitle || 'Untitled engagement',
        engagementReferenceCode: row.engagementReferenceCode || '',
        phase: row.phase ?? null,
        classes: new Map(),
      };
      client.engagements.set(row.engagementId, engagement);
    }

    const classId = row.requestClassId;
    let classGroup = engagement.classes.get(classId);
    if (!classGroup) {
      classGroup = {
        classId,
        className: row.requestClassName || 'Unclassified',
        requests: [],
      };
      engagement.classes.set(classId, classGroup);
    }
    classGroup.requests.push(row);
  }

  return [...clients.values()]
    .map((client) => {
      const engagements = [...client.engagements.values()]
        .map((eng) => ({
          engagementId: eng.engagementId,
          engagementTitle: eng.engagementTitle,
          engagementReferenceCode: eng.engagementReferenceCode,
          phase: eng.phase,
          classes: [...eng.classes.values()].sort((a, b) =>
            compareText(a.className, b.className),
          ),
        }))
        .sort((a, b) => compareText(a.engagementTitle, b.engagementTitle));

      const requestCount = engagements.reduce(
        (sum, eng) =>
          sum + eng.classes.reduce((cSum, cls) => cSum + cls.requests.length, 0),
        0,
      );

      return {
        clientId: client.clientId,
        clientName: client.clientName,
        requestCount,
        engagementCount: engagements.length,
        engagements,
      } satisfies RequestClientGroup;
    })
    .sort((a, b) => compareText(a.clientName, b.clientName));
}
