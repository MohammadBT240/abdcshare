import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import { type Paginated } from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import { DepartmentEntity } from './infrastructure/persistence/department.entity';
import type {
  CreateDepartmentDto,
  DepartmentListQueryDto,
  UpdateDepartmentDto,
} from './presentation/dto/department.dto';
import { DepartmentResponseDto } from './presentation/dto/department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly em: EntityManager) {}

  private toDto(d: DepartmentEntity): DepartmentResponseDto {
    return { id: d.id, name: d.name, isActive: d.isActive };
  }

  async create(dto: CreateDepartmentDto): Promise<DepartmentResponseDto> {
    if (await this.em.findOne(DepartmentEntity, { name: dto.name })) {
      throw new ConflictException('A department with this name already exists');
    }
    const dept = this.em.create(DepartmentEntity, { name: dto.name, isActive: dto.isActive ?? true });
    await this.em.persistAndFlush(dept);
    return this.toDto(dept);
  }

  async list(query: DepartmentListQueryDto): Promise<Paginated<DepartmentResponseDto>> {
    const where: Record<string, unknown> = {};
    if (query.isActive != null) where.isActive = query.isActive === 'true';
    if (query.q) where.name = { $ilike: `%${query.q}%` };

    const { page, pageSize, limit, offset } = pageParams(query);
    const [rows, total] = await this.em.findAndCount(
      DepartmentEntity,
      where as FilterQuery<DepartmentEntity>,
      { orderBy: { name: 'asc', id: 'asc' }, limit, offset },
    );
    return paginated(rows.map((d) => this.toDto(d)), total, page, pageSize);
  }

  async getOne(id: number): Promise<DepartmentResponseDto> {
    const dept = await this.em.findOne(DepartmentEntity, { id });
    if (!dept) throw new NotFoundException('Department not found');
    return this.toDto(dept);
  }

  async update(id: number, dto: UpdateDepartmentDto): Promise<DepartmentResponseDto> {
    const dept = await this.em.findOneOrFail(DepartmentEntity, { id });
    if (dto.name != null && dto.name !== dept.name) {
      if (await this.em.findOne(DepartmentEntity, { name: dto.name, id: { $ne: id } })) {
        throw new ConflictException('A department with this name already exists');
      }
      dept.name = dto.name;
    }
    if (dto.isActive != null) dept.isActive = dto.isActive;
    await this.em.flush();
    return this.toDto(dept);
  }

  async deactivate(id: number): Promise<DepartmentResponseDto> {
    return this.update(id, { isActive: false });
  }
}
