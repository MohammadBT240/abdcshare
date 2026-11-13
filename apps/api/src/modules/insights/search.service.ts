import { Injectable } from '@nestjs/common';
import { EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import { engagementScopeWhere, resolveScope } from '../../common/security/access-scope';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { EngagementEntity } from '../engagements/infrastructure/persistence/engagement.entity';
import { RequestEntity } from '../requests/infrastructure/persistence/request.entity';
import { DocumentEntity } from '../documents/infrastructure/persistence/document.entity';
import { ClientEntity } from '../clients/infrastructure/persistence/client.entity';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import { hasPermission } from '@abdcshare/shared';
import { libraryScopeSql, visibleCollectionSql, type LibraryViewer } from '../library/library-access';

export interface SearchHit {
  id: string;
  label: string;
  sublabel?: string | null;
  /** Where the hit opens in the web app. */
  href?: string;
}
export interface SearchResults {
  engagements: SearchHit[];
  requests: SearchHit[];
  documents: SearchHit[];
  clients: SearchHit[];
  /** Library items and collections (S3) — same visibility rule as the library itself. */
  library: SearchHit[];
}

const LIMIT = 5;

/** Cross-entity quick search, scoped to what the caller may see. */
@Injectable()
export class SearchService {
  constructor(private readonly em: EntityManager) {}

  async search(q: string, user: AuthenticatedUser): Promise<SearchResults> {
    const term = q.trim();
    const empty: SearchResults = { engagements: [], requests: [], documents: [], clients: [], library: [] };
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
            { limit: LIMIT, orderBy: { createdAt: 'desc' }, populate: ['engagement'] },
          );

    const library = hasPermission(user.role, 'library:view', user.partnerDesignation)
      ? await this.library(term, user)
      : [];

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
        href: `/engagements/${e.id}`,
      })),
      requests: requests.map((r) => ({ id: r.id, label: r.description.slice(0, 80), href: `/requests/${r.id}` })),
      documents: documents.map((d) => ({
        id: d.id,
        label: d.title,
        sublabel: d.category,
        href: d.engagement ? `/engagements/${d.engagement.id}?tab=documents` : undefined,
      })),
      clients: clients.map((c) => ({
        id: c.id,
        label: c.name,
        sublabel: c.companyName ?? null,
        href: `/admin/clients/${c.id}`,
      })),
      library,
    };
  }

  /** Published library items (metadata full-text) + collections, under the library's visibility rule. */
  private async library(term: string, user: AuthenticatedUser): Promise<SearchHit[]> {
    const row = await this.em.findOne(UserEntity, { id: user.userId }, { fields: ['id', 'department'] });
    const viewer: LibraryViewer = {
      userId: user.userId,
      departmentId: row?.department?.id ?? null,
      isCurator: hasPermission(user.role, 'library:curate', user.partnerDesignation),
    };
    const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const scope = libraryScopeSql('i', viewer);
    const items = await this.em.execute<{ id: string; title: string; category: string }[]>(
      `select i.id, i.title, c.name as category
         from library_items i join library_categories c on c.id = i.category_id
        where i.status = 'Published' and ${scope.sql}
          and (i.search_vector @@ websearch_to_tsquery('english', ?) or i.title ilike ?)
        order by ts_rank(i.search_vector, websearch_to_tsquery('english', ?)) desc, i.published_at desc nulls last
        limit ?`,
      [...scope.params, term, like, term, LIMIT],
    );
    const cscope = visibleCollectionSql('lc', viewer);
    const collections = await this.em.execute<{ id: string; title: string; type: string }[]>(
      `select lc.id, lc.title, lc.type from library_collections lc
        where lc.status = 'Active' and ${cscope.sql} and lc.title ilike ?
        order by lc.starts_on desc nulls last limit 3`,
      [...cscope.params, like],
    );
    return [
      ...items.map((i) => ({ id: i.id, label: i.title, sublabel: i.category, href: `/library/${i.id}` })),
      ...collections.map((c) => ({
        id: c.id,
        label: c.title,
        sublabel: `${c.type} collection`,
        href: `/library/collections/${c.id}`,
      })),
    ];
  }
}
