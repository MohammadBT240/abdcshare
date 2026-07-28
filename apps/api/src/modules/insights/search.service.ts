import { Injectable } from '@nestjs/common';
import { EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import { engagementScopeWhere, resolveScope } from '../../common/security/access-scope';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { EngagementEntity } from '../engagements/infrastructure/persistence/engagement.entity';
import { RequestEntity } from '../requests/infrastructure/persistence/request.entity';
import { DocumentEntity } from '../documents/infrastructure/persistence/document.entity';
import { ClientEntity } from '../clients/infrastructure/persistence/client.entity';

export interface SearchHit {
  id: string;
  label: string;
  sublabel?: string | null;
}
export interface SearchResults {
  engagements: SearchHit[];
  requests: SearchHit[];
  documents: SearchHit[];
  clients: SearchHit[];
}

const LIMIT = 5;

/** Cross-entity quick search, scoped to what the caller may see. */
@Injectable()
export class SearchService {
  constructor(private readonly em: EntityManager) {}

  async search(q: string, user: AuthenticatedUser): Promise<SearchResults> {
    const term = q.trim();
    const empty: SearchResults = { engagements: [], requests: [], documents: [], clients: [] };
    if (term.length < 2) return empty;

    const scope = resolveScope(user);
    const eng = engagementScopeWhere(scope);
    const like = { $ilike: `%${term}%` };

    const engagements = await this.em.find(
      EngagementEntity,
      { $or: [{ title: like }, { referenceCode: like }], ...eng } as FilterQuery<EngagementEntity>,
      { populate: ['client'], limit: LIMIT, orderBy: { createdAt: 'desc' } },
    );

    const requests = await this.em.find(
      RequestEntity,
      { description: like, ...(Object.keys(eng).length ? { engagement: eng } : {}) } as FilterQuery<RequestEntity>,
      { limit: LIMIT, orderBy: { createdAt: 'desc' } },
    );

    // Documents are internal-only (clients have no document access).
    const documents =
      scope.kind === 'client'
        ? []
        : await this.em.find(
            DocumentEntity,
            { title: like, ...(Object.keys(eng).length ? { engagement: eng } : {}) } as FilterQuery<DocumentEntity>,
            { limit: LIMIT, orderBy: { createdAt: 'desc' } },
          );

    // Client directory is admin-only (client:view).
    const clients =
      scope.kind === 'all'
        ? await this.em.find(
            ClientEntity,
            { $or: [{ name: like }, { companyName: like }] } as FilterQuery<ClientEntity>,
            { limit: LIMIT, orderBy: { name: 'asc' } },
          )
        : [];

    return {
      engagements: engagements.map((e) => ({
        id: e.id,
        label: `${e.referenceCode} — ${e.title}`,
        sublabel: e.client?.name ?? null,
      })),
      requests: requests.map((r) => ({ id: r.id, label: r.description.slice(0, 80) })),
      documents: documents.map((d) => ({ id: d.id, label: d.title, sublabel: d.category })),
      clients: clients.map((c) => ({ id: c.id, label: c.name, sublabel: c.companyName ?? null })),
    };
  }
}
