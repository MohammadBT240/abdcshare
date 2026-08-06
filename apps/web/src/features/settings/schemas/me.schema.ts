import { z } from 'zod';

export const updateMeSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  middleName: z.string().max(100).optional(),
  surname: z.string().min(1, 'Surname is required').max(100),
  titleId: z.string().optional(),
  genderId: z.string().optional(),
  maritalStatusId: z.string().optional(),
  phoneNumber: z.string().max(20).optional(),
  officialAddress: z.string().optional(),
  residentialAddress: z.string().optional(),
});

export type UpdateMeFormValues = z.infer<typeof updateMeSchema>;
