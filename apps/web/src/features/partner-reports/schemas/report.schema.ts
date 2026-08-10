import { z } from 'zod';

const engagementUpdateSchema = z.object({
  clientEngagement: z.string().trim().min(1).max(255),
  update: z.string().trim().min(1),
  status: z.enum(['OnTrack', 'Watch', 'AtRisk', 'NewWin']),
});

const decisionSchema = z.object({
  decision: z.string().trim().min(1),
  priority: z.enum(['Urgent', 'ThisPeriod', 'ForInformation']),
});

const billingItemSchema = z.object({
  description: z.string().trim().max(255),
  amount: z.string().trim().max(40),
  amountReceived: z.string().trim().max(40),
});

export const savePartnerReportSchema = z.object({
  reportingOfficerName: z.string().trim().min(1).max(150),
  department: z.string().trim().min(1).max(150),
  periodType: z.enum(['Weekly', 'Monthly', 'Quarterly', 'AdHoc']),
  periodLabel: z.string().trim().max(60).optional().or(z.literal('')),
  executiveSummary: z.string().optional().or(z.literal('')),
  currency: z.enum(['NGN', 'USD', '']).optional(),
  billingItems: z.array(billingItemSchema).max(100),
  remark: z.string().max(500).optional().or(z.literal('')),
  peopleCapacity: z.string().optional().or(z.literal('')),
  outlook: z.string().optional().or(z.literal('')),
  engagementUpdates: z.array(engagementUpdateSchema).max(50),
  decisions: z.array(decisionSchema).max(50),
});

export type SavePartnerReportFormValues = z.infer<typeof savePartnerReportSchema>;

export const emptyReportValues: SavePartnerReportFormValues = {
  reportingOfficerName: '',
  department: '',
  periodType: 'Weekly',
  periodLabel: '',
  executiveSummary: '',
  currency: '',
  billingItems: [],
  remark: '',
  peopleCapacity: '',
  outlook: '',
  engagementUpdates: [],
  decisions: [],
};
