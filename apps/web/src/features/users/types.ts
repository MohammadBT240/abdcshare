import type { PageMeta } from '@abdcshare/api-client';

export interface UserRecord {
  id: string;
  firstName: string;
  middleName?: string | null;
  surname: string;
  fullName: string;
  email: string;
  role: string;
  partnerDesignation?: 'PrincipalPartner' | 'Partner' | null;
  departmentId?: number | null;
  phoneNumber?: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

export interface UserListResponse {
  data: UserRecord[];
  meta: PageMeta;
}

export interface RoleRecord {
  id: number;
  roleName: string;
}

export interface DepartmentRecord {
  id: number;
  name: string;
  isActive: boolean;
}

export interface LookupRecord {
  id: number;
  name: string;
  isActive: boolean;
}

export interface ClientOption {
  id: string;
  name: string;
}
