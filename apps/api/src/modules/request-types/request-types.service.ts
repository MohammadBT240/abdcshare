import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import { type Paginated } from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import { RequestTypeEntity } from './infrastructure/persistence/request-type.entity';
import { RequestClassEntity } from '../request-classes/infrastructure/persistence/request-class.entity';
import type {
  CreateRequestTypeDto,
  RequestTypeListQueryDto,
  UpdateRequestTypeDto,
} from './presentation/dto/request-type.dto';
import { RequestTypeResponseDto } from './presentation/dto/request-type.dto';

@Injectable()
export class RequestTypesService {
  constructor(private readonly em: EntityManager) {}

  private toDto(rt: RequestTypeEntity): RequestTypeResponseDto {
    return {
      id: rt.id,
      requestClassId: rt.requestClass.id,
      requestClassName: rt.requestClass.name ?? null,
      name: rt.name,
      expectedDocuments: rt.expectedDocuments,
      isActive: rt.isActive,
    };
  }

  /** Enforce the (requestClass, name) uniqueness before hitting the DB constraint. */
  private async assertUnique(requestClassId: number, name: string, excludeId?: number): Promise<void> {
    const where: Record<string, unknown> = { requestClass: requestClassId, name };
    if (excludeId != null) where.id = { $ne: excludeId };
    if (await this.em.findOne(RequestTypeEntity, where as FilterQuery<RequestTypeEntity>)) {
      throw new ConflictException('A request type with this name already exists for the request class');
    }
  }

  private async requestClassRef(requestClassId: number): Promise<RequestClassEntity> {
    const requestClass = await this.em.findOne(RequestClassEntity, { id: requestClassId });
    if (!requestClass) throw new NotFoundException('Request class not found');
    return requestClass;
  }

  async create(dto: CreateRequestTypeDto): Promise<RequestTypeResponseDto> {
    const requestClass = await this.requestClassRef(dto.requestClassId);
    await this.assertUnique(dto.requestClassId, dto.name);
    const rt = this.em.create(RequestTypeEntity, {
      requestClass,
      name: dto.name,
      expectedDocuments: dto.expectedDocuments ?? 1,
      isActive: dto.isActive ?? true,
    });
    await this.em.persistAndFlush(rt);
    return this.toDto(rt);
  }

  async list(query: RequestTypeListQueryDto): Promise<Paginated<RequestTypeResponseDto>> {
    const where: Record<string, unknown> = {};
    if (query.requestClassId) where.requestClass = query.requestClassId;
    if (query.isActive != null) where.isActive = query.isActive === 'true';
    if (query.q) where.name = { $ilike: `%${query.q}%` };

    const { page, pageSize, limit, offset } = pageParams(query);
    const [rows, total] = await this.em.findAndCount(
      RequestTypeEntity,
      where as FilterQuery<RequestTypeEntity>,
      { populate: ['requestClass'], orderBy: { name: 'asc', id: 'asc' }, limit, offset },
    );
    return paginated(rows.map((rt) => this.toDto(rt)), total, page, pageSize);
  }

  async getOne(id: number): Promise<RequestTypeResponseDto> {
    const rt = await this.em.findOne(RequestTypeEntity, { id }, { populate: ['requestClass'] });
    if (!rt) throw new NotFoundException('Request type not found');
    return this.toDto(rt);
  }

  async update(id: number, dto: UpdateRequestTypeDto): Promise<RequestTypeResponseDto> {
    const rt = await this.em.findOneOrFail(RequestTypeEntity, { id }, { populate: ['requestClass'] });
    const nextRequestClassId = dto.requestClassId ?? rt.requestClass.id;
    const nextName = dto.name ?? rt.name;
    if (dto.requestClassId != null || dto.name != null) {
      await this.assertUnique(nextRequestClassId, nextName, id);
    }
    if (dto.requestClassId != null && dto.requestClassId !== rt.requestClass.id) {
      rt.requestClass = await this.requestClassRef(dto.requestClassId);
    }
    if (dto.name != null) rt.name = dto.name;
    if (dto.expectedDocuments != null) rt.expectedDocuments = dto.expectedDocuments;
    if (dto.isActive != null) rt.isActive = dto.isActive;
    await this.em.flush();
    return this.toDto(rt);
  }

  async deactivate(id: number): Promise<RequestTypeResponseDto> {
    return this.update(id, { isActive: false });
  }
}
