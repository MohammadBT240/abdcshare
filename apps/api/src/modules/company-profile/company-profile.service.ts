import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import type { Paginated } from '@abdcshare/shared';
import { FilePreviewStatus } from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import { STORAGE, type StoragePort } from '../../common/storage/storage.port';
import { isNativePreviewable, isOfficeMime } from '../../common/storage/preview.util';
import type {
  MultipartAbortDto,
  MultipartCompleteDto,
  MultipartCreateDto,
  MultipartSignPartsDto,
} from '../../common/storage/multipart.dto';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import { CompanyProfileEntity } from './infrastructure/persistence/company-profile.entity';
import {
  COMPANY_PROFILE_MAX_BYTES,
  COMPANY_PROFILE_MIME_TYPES,
} from './company-profile.constants';
import type {
  CompanyProfileConfirmDto,
  CompanyProfileDownloadDto,
  CompanyProfileListQueryDto,
  CompanyProfilePresignDto,
  CompanyProfilePreviewDto,
  CompanyProfileResponseDto,
  CreateCompanyProfileDto,
  PresignedUploadResponseDto,
  RenameCompanyProfileDto,
} from './presentation/dto/company-profile.dto';

const KEY_PREFIX = 'company-profiles';

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
      fileName: p.fileName ?? null,
      mimeType: p.mimeType ?? null,
      sizeBytes: p.sizeBytes ?? null,
      isActive: p.isActive,
      createdById: p.createdBy?.id ?? null,
      createdByName: p.createdBy?.fullName ?? null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  private validateName(name: string | undefined): string {
    const trimmed = name?.trim() ?? '';
    if (!trimmed) throw new BadRequestException('Name is required');
    if (trimmed.length > 255) throw new BadRequestException('Name must be 255 characters or fewer');
    return trimmed;
  }

  private assertKeyForProfile(storageKey: string): void {
    if (!storageKey.includes(KEY_PREFIX)) {
      throw new BadRequestException('Invalid storage key for this company profile');
    }
  }

  private validateUploadMeta(fileName: string, mimeType: string | undefined, sizeBytes: number): void {
    const mime = mimeType || '';
    if (!COMPANY_PROFILE_MIME_TYPES.has(mime)) {
      throw new BadRequestException('Use a PDF, DOC, or DOCX file');
    }
    if (sizeBytes > COMPANY_PROFILE_MAX_BYTES) {
      throw new BadRequestException('File must be 100 MB or smaller');
    }
    void fileName;
  }

  private async findActive(id: string): Promise<CompanyProfileEntity> {
    const row = await this.em.findOne(
      CompanyProfileEntity,
      { id, isActive: true },
      { populate: ['createdBy'] },
    );
    if (!row) throw new NotFoundException('Company profile not found');
    return row;
  }

  private async findComplete(id: string): Promise<CompanyProfileEntity> {
    const row = await this.findActive(id);
    if (!row.storageKey || !row.fileName) {
      throw new NotFoundException('Company profile not found');
    }
    return row;
  }

  async list(query: CompanyProfileListQueryDto): Promise<Paginated<CompanyProfileResponseDto>> {
    const { page, pageSize, limit, offset } = pageParams(query);
    const where: FilterQuery<CompanyProfileEntity> = {
      isActive: true,
      storageKey: { $ne: null },
    };
    if (query.q?.trim()) {
      where.name = { $ilike: `%${query.q.trim()}%` };
    }
    const [rows, total] = await this.em.findAndCount(CompanyProfileEntity, where, {
      populate: ['createdBy'],
      orderBy: { createdAt: 'desc', id: 'asc' },
      limit,
      offset,
    });
    return paginated(
      rows.map((r) => this.toDto(r)),
      total,
      page,
      pageSize,
    );
  }

  async get(id: string): Promise<CompanyProfileResponseDto> {
    return this.toDto(await this.findComplete(id));
  }

  /** Create a draft profile (name only). File is attached via Uppy confirm. */
  async createDraft(dto: CreateCompanyProfileDto, userId: string): Promise<CompanyProfileResponseDto> {
    const row = this.em.create(CompanyProfileEntity, {
      name: this.validateName(dto.name),
      storageKey: null,
      fileName: null,
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
    const row = await this.findComplete(id);
    row.name = this.validateName(dto.name);
    await this.em.flush();
    return this.toDto(row);
  }

  async presignUpload(id: string, dto: CompanyProfilePresignDto): Promise<PresignedUploadResponseDto> {
    await this.findActive(id);
    if (!COMPANY_PROFILE_MIME_TYPES.has(dto.contentType)) {
      throw new BadRequestException('Use a PDF, DOC, or DOCX file');
    }
    const presigned = await this.storage.presignUpload({
      keyPrefix: KEY_PREFIX,
      fileName: dto.fileName,
      contentType: dto.contentType,
    });
    return { ...presigned };
  }

  async createMultipart(id: string, dto: MultipartCreateDto) {
    await this.findActive(id);
    if (!COMPANY_PROFILE_MIME_TYPES.has(dto.contentType)) {
      throw new BadRequestException('Use a PDF, DOC, or DOCX file');
    }
    if (dto.sizeBytes != null && dto.sizeBytes > COMPANY_PROFILE_MAX_BYTES) {
      throw new BadRequestException('File must be 100 MB or smaller');
    }
    return this.storage.createMultipart({
      keyPrefix: KEY_PREFIX,
      fileName: dto.fileName,
      contentType: dto.contentType,
    });
  }

  async signMultipartParts(id: string, uploadId: string, dto: MultipartSignPartsDto) {
    await this.findActive(id);
    this.assertKeyForProfile(dto.storageKey);
    const parts = await Promise.all(
      dto.partNumbers.map(async (partNumber) => {
        const { url } = await this.storage.presignPart(dto.storageKey, uploadId, partNumber);
        return { partNumber, url };
      }),
    );
    return { parts };
  }

  async completeMultipart(
    id: string,
    uploadId: string,
    dto: MultipartCompleteDto,
  ): Promise<CompanyProfileResponseDto> {
    await this.findActive(id);
    this.assertKeyForProfile(dto.storageKey);
    if (dto.sizeBytes > COMPANY_PROFILE_MAX_BYTES) {
      throw new BadRequestException('File must be 100 MB or smaller');
    }
    await this.storage.completeMultipart(dto.storageKey, uploadId, dto.parts);
    const head = await this.storage.head(dto.storageKey);
    if (!head) throw new BadRequestException('Uploaded object not found');
    if (dto.sizeBytes > 0 && head.sizeBytes !== dto.sizeBytes) {
      throw new BadRequestException(
        `Uploaded size mismatch (expected ${dto.sizeBytes}, got ${head.sizeBytes})`,
      );
    }
    return this.confirmUpload(id, {
      storageKey: dto.storageKey,
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      sizeBytes: head.sizeBytes,
    });
  }

  async abortMultipart(id: string, uploadId: string, dto: MultipartAbortDto): Promise<{ ok: true }> {
    await this.findActive(id);
    this.assertKeyForProfile(dto.storageKey);
    await this.storage.abortMultipart(dto.storageKey, uploadId);
    return { ok: true };
  }

  async confirmUpload(id: string, dto: CompanyProfileConfirmDto): Promise<CompanyProfileResponseDto> {
    const row = await this.findActive(id);
    this.assertKeyForProfile(dto.storageKey);
    const head = await this.storage.head(dto.storageKey);
    if (!head) throw new BadRequestException('Uploaded object not found');
    const sizeBytes = dto.sizeBytes != null && dto.sizeBytes > 0 ? dto.sizeBytes : head.sizeBytes;
    if (dto.sizeBytes != null && dto.sizeBytes > 0 && head.sizeBytes !== dto.sizeBytes) {
      throw new BadRequestException(
        `Uploaded size mismatch (expected ${dto.sizeBytes}, got ${head.sizeBytes})`,
      );
    }
    const mimeType = dto.mimeType || '';
    this.validateUploadMeta(dto.fileName, mimeType, sizeBytes);

    row.storageKey = dto.storageKey;
    row.fileName = dto.fileName;
    row.mimeType = mimeType;
    row.sizeBytes = sizeBytes;
    await this.em.flush();
    return this.toDto(row);
  }

  async download(id: string): Promise<CompanyProfileDownloadDto> {
    const row = await this.findComplete(id);
    const url = await this.storage.presignDownload(row.storageKey!, row.fileName!);
    return { url };
  }

  async preview(id: string): Promise<CompanyProfilePreviewDto> {
    const row = await this.findComplete(id);

    const fileName = row.fileName ?? undefined;
    if (isNativePreviewable(row.mimeType, fileName)) {
      const url = await this.storage.presignDownload(row.storageKey!, row.fileName!, {
        disposition: 'inline',
      });
      return { url, mode: 'native', previewStatus: FilePreviewStatus.Ready };
    }

    if (isOfficeMime(row.mimeType, fileName)) {
      const sourceUrl = await this.storage.presignDownload(row.storageKey!, row.fileName!, {
        disposition: 'inline',
      });
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

  /** Hard-delete drafts; soft-delete completed profiles. */
  async remove(id: string): Promise<void> {
    const row = await this.em.findOne(CompanyProfileEntity, { id, isActive: true });
    if (!row) throw new NotFoundException('Company profile not found');
    if (!row.storageKey) {
      await this.em.removeAndFlush(row);
      return;
    }
    row.isActive = false;
    await this.em.flush();
  }
}
