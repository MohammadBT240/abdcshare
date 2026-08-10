export interface MeProfile {
  id: string;
  titleId?: number | null;
  firstName: string;
  middleName?: string | null;
  surname: string;
  fullName: string;
  email: string;
  role: string;
  partnerDesignation?: string | null;
  departmentId?: number | null;
  genderId?: number | null;
  maritalStatusId?: number | null;
  phoneNumber?: string | null;
  officialAddress?: string | null;
  residentialAddress?: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
}
