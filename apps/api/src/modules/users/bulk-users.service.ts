import { Injectable } from '@nestjs/common';
import { EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { EVENT } from '@abdcshare/shared';
import { parseCsv, toCsv } from '../../common/utils/csv';
import { OutboxService } from '../outbox/outbox.service';
import { UserEntity } from './infrastructure/persistence/user.entity';
import { RoleEntity } from '../roles/infrastructure/persistence/role.entity';
import { DepartmentEntity } from '../departments/infrastructure/persistence/department.entity';
import { TitleEntity } from '../reference/infrastructure/persistence/titles.entity';
import {
  BulkImportJobEntity,
  BulkImportKind,
  BulkImportStatus,
} from './infrastructure/persistence/bulk-import-job.entity';

export const BULK_USER_COLUMNS = [
  'title', 'firstName', 'middleName', 'surname', 'email', 'role',
  'department', 'phoneNumber', 'officialAddress', 'residentialAddress',
] as const;

interface RowResult {
  row: number;
  data: Record<string, string>;
  errors: string[];
}
interface PreviewResult {
  total: number;
  valid: number;
  invalid: number;
  rows: RowResult[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class BulkUsersService {
  constructor(
    private readonly em: EntityManager,
    private readonly outbox: OutboxService,
  ) {}

  /** CSV template (header row + one example) for download. */
  template(): string {
    const example = {
      title: 'Mr', firstName: 'Jane', middleName: '', surname: 'Doe',
      email: 'jane.doe@example.com', role: 'Staff', department: 'Assurance',
      phoneNumber: '08000000000', officialAddress: '', residentialAddress: '',
    };
    return toCsv([example], [...BULK_USER_COLUMNS]);
  }

  private async validate(csv: string): Promise<RowResult[]> {
    const rows = parseCsv(csv);
    const roles = new Map((await this.em.find(RoleEntity, {})).map((r) => [r.roleName.toLowerCase(), r]));
    const depts = new Map((await this.em.find(DepartmentEntity, {})).map((d) => [d.name.toLowerCase(), d]));
    const emails = rows.map((r) => (r.email ?? '').toLowerCase()).filter(Boolean);
    const existing = new Set(
      (await this.em.find(UserEntity, { email: { $in: emails } })).map((u) => u.email),
    );
    const seen = new Set<string>();

    return rows.map((data, i): RowResult => {
      const errors: string[] = [];
      const email = (data.email ?? '').toLowerCase();
      if (!data.firstName) errors.push('firstName is required');
      if (!data.surname) errors.push('surname is required');
      if (!email) errors.push('email is required');
      else if (!EMAIL_RE.test(email)) errors.push('email is invalid');
      else if (existing.has(email)) errors.push('email already exists');
      else if (seen.has(email)) errors.push('duplicate email in file');
      if (email) seen.add(email);
      if (!data.role) errors.push('role is required');
      else if (!roles.has(data.role.toLowerCase())) errors.push(`unknown role "${data.role}"`);
      if (data.department && !depts.has(data.department.toLowerCase())) {
        errors.push(`unknown department "${data.department}"`);
      }
      return { row: i + 1, data, errors };
    });
  }

  /** Validate without persisting users; record a Validated job for auditability. */
  async preview(csv: string, actorId: string): Promise<PreviewResult & { jobId: string }> {
    const results = await this.validate(csv);
    const valid = results.filter((r) => r.errors.length === 0).length;
    const job = this.em.create(BulkImportJobEntity, {
      kind: BulkImportKind.Users,
      status: BulkImportStatus.Validated,
      totalRows: results.length,
      validRows: valid,
      errorRows: results.length - valid,
      result: results,
      createdBy: this.em.getReference(UserEntity, actorId),
    });
    await this.em.persistAndFlush(job);
    return { jobId: job.id, total: results.length, valid, invalid: results.length - valid, rows: results };
  }

  /** Import valid rows; invalid rows are skipped and reported. */
  async import(csv: string, actorId: string): Promise<PreviewResult & { jobId: string; imported: number }> {
    const results = await this.validate(csv);
    const roles = new Map((await this.em.find(RoleEntity, {})).map((r) => [r.roleName.toLowerCase(), r]));
    const depts = new Map((await this.em.find(DepartmentEntity, {})).map((d) => [d.name.toLowerCase(), d]));
    const titles = new Map((await this.em.find(TitleEntity, {})).map((t) => [t.name.toLowerCase(), t]));

    let imported = 0;
    for (const r of results) {
      if (r.errors.length) continue;
      const d = r.data;
      // Valid rows guarantee these are present; extract as typed strings.
      const firstName = d.firstName ?? '';
      const middleName = d.middleName || null;
      const surname = d.surname ?? '';
      const email = (d.email ?? '').toLowerCase();
      const role = roles.get((d.role ?? '').toLowerCase());
      if (!role) continue; // defensive — validation already guaranteed this
      const tempPassword = randomBytes(9).toString('base64url');
      const user = this.em.create(UserEntity, {
        role,
        department: d.department ? (depts.get(d.department.toLowerCase()) ?? null) : null,
        title: d.title ? (titles.get(d.title.toLowerCase()) ?? null) : null,
        firstName,
        middleName,
        surname,
        fullName: [firstName, middleName, surname].filter(Boolean).join(' '),
        email,
        phoneNumber: d.phoneNumber || null,
        officialAddress: d.officialAddress || null,
        residentialAddress: d.residentialAddress || null,
        passwordHash: await bcrypt.hash(tempPassword, 12),
        mustChangePassword: true,
        isActive: true,
      });
      this.outbox.enqueue(EVENT.UserCreated, { userId: user.id, email, tempPassword });
      imported++;
    }
    const valid = results.filter((r) => r.errors.length === 0).length;
    const job = this.em.create(BulkImportJobEntity, {
      kind: BulkImportKind.Users,
      status: BulkImportStatus.Imported,
      totalRows: results.length,
      validRows: valid,
      errorRows: results.length - valid,
      result: results,
      createdBy: this.em.getReference(UserEntity, actorId),
      completedAt: new Date(),
    });
    this.em.persist(job);
    await this.em.flush();
    return { jobId: job.id, imported, total: results.length, valid, invalid: results.length - valid, rows: results };
  }

  /** Export all users (optionally filtered by role/active) as CSV. */
  async exportCsv(filter: { roleId?: number; isActive?: boolean }): Promise<string> {
    const where: Record<string, unknown> = {};
    if (filter.roleId) where.role = filter.roleId;
    if (filter.isActive != null) where.isActive = filter.isActive;
    const users = await this.em.find(UserEntity, where as FilterQuery<UserEntity>, {
      populate: ['role', 'department'],
      orderBy: { createdAt: 'desc' },
      limit: 10000,
    });
    const headers = ['firstName', 'middleName', 'surname', 'email', 'role', 'department', 'phoneNumber', 'isActive'];
    const rows = users.map((u) => ({
      firstName: u.firstName,
      middleName: u.middleName ?? '',
      surname: u.surname,
      email: u.email,
      role: u.role.roleName,
      department: u.department?.name ?? '',
      phoneNumber: u.phoneNumber ?? '',
      isActive: u.isActive,
    }));
    return toCsv(rows, headers);
  }
}
