import { z } from 'zod';

export const createUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  middleName: z.string().max(100).optional(),
  surname: z.string().min(1, 'Surname is required').max(100),
  email: z.string().email('Enter a valid email'),
  roleId: z.string().min(1, 'Select a role'),
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
  fullName: z.string().min(1).max(200),
  roleId: z.string().min(1, 'Select a role'),
  departmentId: z.string().optional(),
  isActive: z.boolean(),
});

export type UpdateUserFormValues = z.infer<typeof updateUserSchema>;
