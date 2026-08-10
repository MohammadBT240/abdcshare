import { z } from 'zod';

export const inviteReporterSchema = z.object({
  email: z.string().email('Enter a valid email'),
  fullName: z.string().trim().min(2, 'Name is required').max(150),
  title: z
    .enum(['Partner', 'Director', 'HeadOfDepartment', 'ManagingConsultant', ''])
    .optional(),
});

export type InviteReporterFormValues = z.infer<typeof inviteReporterSchema>;
