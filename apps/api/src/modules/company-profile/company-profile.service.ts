import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, FilterQuery } from '@mikro-orm/postgresql';
import type { Paginated } from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import { STORAGE, type StoragePort } from '../../common/storage/storage.port';
import { isNativePreviewable, isOfficeMime } from '../../common/storage/preview.util';
import { FilePreviewStatus } from '@abdcshare/shared';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import { CompanyProfileEntity } from './infrastructure/persistence/company-profile.entity';
import {
  COMPANY_PROFILE_MAX_BYTES,
  COMPANY_PROFILE_MIME_TYPES,
} from './company-profile.constants';
import type {
  CompanyProfileDownloadDto,
  CompanyProfileListQueryDto,
  CompanyProfilePreviewDto,
  CompanyProfileResponseDto,
  RenameCompanyProfileDto,
} from './presentation/dto/company-profile.dto';

export type UploadedCompanyProfileFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class CompanyProfileService {
  constructor(
    private readonly em: EntityManager,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

  private toDto(p: CompanyProfileEntity): CompanyProfileResponseDto {
    return {
      id: p.id,
      name: p.name,
      fileName: p.fileName,
      mimeType: p.mimeType ?? null,
      sizeBytes: p.sizeBytes ?? null,
      isActive: p.isActive,
      createdById: p.createdBy?.id ?? null,
      createdByName: p.createdBy?.fullName ?? null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  private validateFile(file: UploadedCompanyProfileFile | undefined): UploadedCompanyProfileFile {
    if (!file?.buffer?.length) {
      throw new BadRequestException('A file is required');
    }
    if (!COMPANY_PROFILE_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Use a PDF, DOC, or DOCX file');
    }
    if (file.size > COMPANY_PROFILE_MAX_BYTES) {
      throw new BadRequestException('File must be 100 MB or smaller');
    }
    return file;
  }

  private validateName(name: string | undefined): string {
    const trimmed = name?.trim() ?? '';
    if (!trimmed) throw new BadRequestException('Name is required');
    if (trimmed.length > 255) throw new BadRequestException('Name must be 255 characters or fewer');
    return trimmed;
  }

  async list(query: CompanyProfileListQueryDto): Promise<Paginated<CompanyProfileResponseDto>> {
    const { page, pageSize, limit, offset } = pageParams(query);
    const where: FilterQuery<CompanyProfileEntity> = { isActive: true };
    if (query.q?.trim()) {
      where.name = { $ilike: `%${query.q.trim()}%` };
    }
    const [rows, total] = await this.em.findAndCount(CompanyProfileEntity, where, {
      populate: ['createdBy'],
      orderBy: { createdAt: 'desc', id: 'asc' },
      limit,
      offset,
    });
    return paginated(rows.map((r) => this.toDto(r)), total, page, pageSize);
  }

  async get(id: string): Promise<CompanyProfileResponseDto> {
    const row = await this.em.findOne(
      CompanyProfileEntity,
      { id, isActive: true },
      { populate: ['createdBy'] },
    );
    if (!row) throw new NotFoundException('Company profile not found');
    return this.toDto(row);
  }

  async create(
    name: string | undefined,
    file: UploadedCompanyProfileFile | undefined,
    userId: string,
  ): Promise<CompanyProfileResponseDto> {
    const validName = this.validateName(name);
    const validFile = this.validateFile(file);
    const { storageKey } = await this.storage.upload({
      keyPrefix: 'company-profiles',
      fileName: validFile.originalname,
      contentType: validFile.mimetype,
      body: validFile.buffer,
    });
    const row = this.em.create(CompanyProfileEntity, {
      name: validName,
      storageKey,
      fileName: validFile.originalname,
      mimeType: validFile.mimetype,
      sizeBytes: validFile.size,
      isActive: true,
      createdBy: this.em.getReference(UserEntity, userId),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await this.em.persistAndFlush(row);
    await this.em.populate(row, ['createdBy']);
    return this.toDto(row);
  }

  async rename(id: string, dto: RenameCompanyProfileDto): Promise<CompanyProfileResponseDto> {
    const row = await this.em.findOne(
      CompanyProfileEntity,
      { id, isActive: true },
      { populate: ['createdBy'] },
    );
    if (!row) throw new NotFoundException('Company profile not found');
    row.name = this.validateName(dto.name);
    await this.em.flush();
    return this.toDto(row);
  }

  async replaceFile(
    id: string,
    file: UploadedCompanyProfileFile | undefined,
  ): Promise<CompanyProfileResponseDto> {
    const row = await this.em.findOne(
      CompanyProfileEntity,
      { id, isActive: true },
      { populate: ['createdBy'] },
    );
    if (!row) throw new NotFoundException('Company profile not found');
    const validFile = this.validateFile(file);
    const { storageKey } = await this.storage.upload({
      keyPrefix: 'company-profiles',
      fileName: validFile.originalname,
      contentType: validFile.mimetype,
      body: validFile.buffer,
    });
    row.storageKey = storageKey;
    row.fileName = validFile.originalname;
    row.mimeType = validFile.mimetype;
    row.sizeBytes = validFile.size;
    await this.em.flush();
    return this.toDto(row);
  }

  async download(id: string): Promise<CompanyProfileDownloadDto> {
    const row = await this.em.findOne(CompanyProfileEntity, { id, isActive: true });
    if (!row) throw new NotFoundException('Company profile not found');
    const url = await this.storage.presignDownload(row.storageKey, row.fileName);
    return { url };
  }

  async preview(id: string): Promise<CompanyProfilePreviewDto> {
    const row = await this.em.findOne(CompanyProfileEntity, { id, isActive: true });
    if (!row) throw new NotFoundException('Company profile not found');

    if (isNativePreviewable(row.mimeType, row.fileName)) {
      const url = await this.storage.presignDownload(row.storageKey, row.fileName, {
        disposition: 'inline',
      });
      return { url, mode: 'native', previewStatus: FilePreviewStatus.Ready };
    }

    if (isOfficeMime(row.mimeType, row.fileName)) {
      const sourceUrl = await this.storage.presignDownload(row.storageKey, row.fileName, {
        disposition: 'inline',
      });
      // Office Online can only fetch publicly reachable HTTPS objects (e.g. R2), not local storage.
      if (/^https:\/\//i.test(sourceUrl) && !/localhost|127\.0\.0\.1/i.test(sourceUrl)) {
        return {
          url: `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(sourceUrl)}`,
          mode: 'converted',
          previewStatus: FilePreviewStatus.Ready,
        };
      }
    }

    return {
      url: null,
      mode: 'unavailable',
      previewStatus: FilePreviewStatus.None,
      reason: 'unsupported',
    };
  }

  async softDelete(id: string): Promise<void> {
    const row = await this.em.findOne(CompanyProfileEntity, { id, isActive: true });
    if (!row) throw new NotFoundException('Company profile not found');
    row.isActive = false;
    await this.em.flush();
  }
}
