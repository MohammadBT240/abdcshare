import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { ROLE_NAMES } from '@abdcshare/shared';
import { RoleEntity } from './infrastructure/persistence/role.entity';
import { RoleResponseDto } from './presentation/dto/role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly em: EntityManager) {}

  /** Only current domain roles — excludes legacy leftovers like Auditor. */
  async list(): Promise<RoleResponseDto[]> {
    const rows = await this.em.find(
      RoleEntity,
      { roleName: { $in: [...ROLE_NAMES] } },
      { orderBy: { id: 'asc' } },
    );
    return rows.map((r) => ({ id: r.id, roleName: r.roleName }));
  }
}
