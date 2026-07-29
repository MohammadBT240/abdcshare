import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { RoleEntity } from './infrastructure/persistence/role.entity';
import { RoleResponseDto } from './presentation/dto/role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly em: EntityManager) {}

  async list(): Promise<RoleResponseDto[]> {
    const rows = await this.em.find(RoleEntity, {}, { orderBy: { id: 'asc' } });
    return rows.map((r) => ({ id: r.id, roleName: r.roleName }));
  }
}
