import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import { type Paginated } from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import { RequestClassEntity } from './infrastructure/persistence/request-class.entity';
import type {
  CreateRequestClassDto,
  RequestClassListQueryDto,
  UpdateRequestClassDto,
} from './presentation/dto/request-class.dto';
import { RequestClassResponseDto } from './presentation/dto/request-class.dto';

@Injectable()
export class RequestClassesService {
  constructor(private readonly em: EntityManager) {}

  private toDto(f: RequestClassEntity): RequestClassResponseDto {
    return {
      id: f.id,
      code: f.code ?? null,
      name: f.name,
      description: f.description ?? null,
      isActive: f.isActive,
    };
  }

  async create(dto: CreateRequestClassDto): Promise<RequestClassResponseDto> {
    if (await this.em.findOne(RequestClassEntity, { name: dto.name })) {
      throw new ConflictException('A request class with this name already exists');
    }
    if (dto.code && (await this.em.findOne(RequestClassEntity, { code: dto.code }))) {
      throw new ConflictException('A request class with this code already exists');
    }
    const requestClass = this.em.create(RequestClassEntity, {
      code: dto.code ?? null,
      name: dto.name,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
    });
    await this.em.persistAndFlush(requestClass);
    return this.toDto(requestClass);
  }

  async list(query: RequestClassListQueryDto): Promise<Paginated<RequestClassResponseDto>> {
    const where: Record<string, unknown> = {};
    if (query.isActive != null) where.isActive = query.isActive === 'true';
    if (query.q) where.$or = [{ name: { $ilike: `%${query.q}%` } }, { code: { $ilike: `%${query.q}%` } }];

    const { page, pageSize, limit, offset } = pageParams(query);
    const [rows, total] = await this.em.findAndCount(RequestClassEntity, where as FilterQuery<RequestClassEntity>, {
      orderBy: { name: 'asc', id: 'asc' },
      limit,
      offset,
    });
    return paginated(rows.map((f) => this.toDto(f)), total, page, pageSize);
  }

  async getOne(id: number): Promise<RequestClassResponseDto> {
    const requestClass = await this.em.findOne(RequestClassEntity, { id });
    if (!requestClass) throw new NotFoundException('Request class not found');
    return this.toDto(requestClass);
  }

  async update(id: number, dto: UpdateRequestClassDto): Promise<RequestClassResponseDto> {
    const requestClass = await this.em.findOneOrFail(RequestClassEntity, { id });
    if (dto.name != null && dto.name !== requestClass.name) {
      if (await this.em.findOne(RequestClassEntity, { name: dto.name, id: { $ne: id } })) {
        throw new ConflictException('A request class with this name already exists');
      }
      requestClass.name = dto.name;
    }
    if (dto.code !== undefined) {
      if (dto.code && (await this.em.findOne(RequestClassEntity, { code: dto.code, id: { $ne: id } }))) {
        throw new ConflictException('A request class with this code already exists');
      }
      requestClass.code = dto.code ?? null;
    }
    if (dto.description !== undefined) requestClass.description = dto.description ?? null;
    if (dto.isActive != null) requestClass.isActive = dto.isActive;
    await this.em.flush();
    return this.toDto(requestClass);
  }

  async deactivate(id: number): Promise<RequestClassResponseDto> {
    return this.update(id, { isActive: false });
  }
}
