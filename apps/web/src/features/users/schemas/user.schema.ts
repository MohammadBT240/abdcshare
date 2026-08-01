import { z } from 'zod';

export const PARTNER_DESIGNATIONS = ['none', 'Partner', 'PrincipalPartner'] as const;

export const createUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  middleName: z.string().max(100).optional(),
  surname: z.string().min(1, 'Surname is required').max(100),
  email: z.string().email('Enter a valid email'),
  roleId: z.string().min(1, 'Select a role'),
  partnerDesignation: z.enum(PARTNER_DESIGNATIONS),
  titleId: z.string().optional(),
  genderId: z.string().optional(),
  maritalStatusId: z.string().optional(),
  departmentId: z.string().optional(),
  clientId: z.string().optional(),
  phoneNumber: z.string().max(20).optional(),
  officialAddress: z.string().max(250).optional(),
  residentialAddress: z.string().max(250).optional(),
});

export type CreateUserFormValues = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  middleName: z.string().max(100).optional(),
  surname: z.string().min(1, 'Surname is required').max(100),
  email: z.string().email('Enter a valid email'),
  roleId: z.string().min(1, 'Select a role'),
  partnerDesignation: z.enum(PARTNER_DESIGNATIONS),
  titleId: z.string().optional(),
  genderId: z.string().optional(),
  maritalStatusId: z.string().optional(),
  departmentId: z.string().optional(),
  phoneNumber: z.string().max(20).optional(),
  officialAddress: z.string().max(250).optional(),
  residentialAddress: z.string().max(250).optional(),
  isActive: z.boolean(),
});

export type UpdateUserFormValues = z.infer<typeof updateUserSchema>;

/** Roles for create/edit and list filters.
 *  Client portal accounts live under Clients — not listed here.
 *  Excludes legacy Auditor.
 */
export const CREATABLE_ROLE_NAMES = [
  'Platform Admin',
  'Super Admin',
  'Staff',
  'Guest',
] as const;

export type CreatableRoleName = (typeof CREATABLE_ROLE_NAMES)[number];

/** Same set as creatable — used by the users list role filter. */
export const FILTERABLE_ROLE_NAMES = CREATABLE_ROLE_NAMES;